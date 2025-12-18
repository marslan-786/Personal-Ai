const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const sidebar = document.getElementById('sidebar');

let abortController = null;
let selectedImageBase64 = null;
let sessionId = "S-" + Math.floor(Math.random() * 10000);

window.onload = loadHistory;

function toggleSidebar() { sidebar.classList.toggle('active'); }

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('preview-box').style.display = 'block';
            selectedImageBase64 = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
}

function clearPreview() {
    selectedImageBase64 = null;
    document.getElementById('preview-box').style.display = 'none';
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

chatContainer.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-btn');
    btn.style.display = (chatContainer.scrollHeight - chatContainer.scrollTop > 800) ? 'flex' : 'none';
});

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    document.getElementById('history-list').innerHTML = data.map(chat => `<div class="p-2 bg-gray-800 rounded mb-1 truncate text-xs">${chat.messages[0]?.content || "Image Chat"}</div>`).join('');
}

async function handleAction() {
    if (abortController) { abortController.abort(); return; }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

    let userHTML = selectedImageBase64 ? `<img src="data:image/png;base64,${selectedImageBase64}" class="chat-img">` : "";
    userHTML += `<div>${text || "Analyze Image"}</div>`;
    appendBubble('user', userHTML);

    const imgData = selectedImageBase64;
    userInput.value = '';
    userInput.style.height = 'auto';
    clearPreview();

    abortController = new AbortController();
    actionIcon.className = "fas fa-stop";
    actionBtn.classList.replace("bg-green-600", "bg-red-600");

    const botDiv = appendBubble('bot', `<div class="dot-bounce"><span></span><span></span><span></span></div><div class="bot-text"></div>`);
    const botTextDiv = botDiv.querySelector('.bot-text');
    const dots = botDiv.querySelector('.dot-bounce');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId, mode: document.getElementById('mode-selector').value, image: imgData }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        let fullReply = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dots) dots.remove();
            fullReply += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(fullReply);
            scrollToBottom();
            
            // کوڈ بلاک میں کاپی بٹن لگانا
            formatCodeBlocks(botTextDiv);
        }
        loadHistory();
    } catch (e) {
        botTextDiv.innerHTML = e.name === 'AbortError' ? "Stopped." : "Error connection! 😫";
    } finally {
        resetBtn();
    }
}

function formatCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(block => {
        if (block.parentElement.classList.contains('code-wrapper')) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';
        const lang = block.querySelector('code').className.split('-')[1] || 'code';
        
        const header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = `<span>${lang.toUpperCase()}</span><span class="cursor-pointer" onclick="copyCode(this)"><i class="far fa-copy"></i> Copy</span>`;
        
        block.parentNode.insertBefore(wrapper, block);
        wrapper.appendChild(header);
        wrapper.appendChild(block);
        hljs.highlightAll();
    });
}

window.copyCode = (btn) => {
    const code = btn.parentElement.nextElementSibling.innerText;
    navigator.clipboard.writeText(code);
    btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
    setTimeout(() => btn.innerHTML = '<i class="far fa-copy"></i> Copy', 2000);
};

function resetBtn() {
    abortController = null;
    actionIcon.className = "fas fa-paper-plane";
    actionBtn.classList.replace("bg-red-600", "bg-green-600");
}

function appendBubble(role, html) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
    div.innerHTML = html;
    chatContainer.appendChild(div);
    scrollToBottom();
    return div;
}
