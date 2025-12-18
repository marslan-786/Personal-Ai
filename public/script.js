const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const sidebar = document.getElementById('sidebar');
const scrollBtn = document.getElementById('scroll-down-btn');

let abortController = null;
let selectedImageBase64 = null;
let sessionId = "Session-" + Math.floor(Math.random() * 9999);

window.onload = loadHistory;

function toggleSidebar() { sidebar.classList.toggle('active'); }

function handleFile(event) {
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
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

chatWindow.addEventListener('scroll', () => {
    scrollBtn.style.display = (chatWindow.scrollHeight - chatWindow.scrollTop > 800) ? 'flex' : 'none';
});

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    document.getElementById('history-list').innerHTML = data.map(chat => `
        <div class="p-2 bg-gray-800 rounded mb-1 truncate text-[10px] border border-gray-700">
            ${chat.messages[0]?.content.substring(0, 25) || "Image Analysis"}
        </div>
    `).join('');
}

async function handleAction() {
    if (abortController) { abortController.abort(); return; }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

    // یوزر کا میسج دکھانا
    let userHTML = selectedImageBase64 ? `<img src="data:image/png;base64,${selectedImageBase64}" class="chat-img">` : "";
    userHTML += `<div>${text || "Analyze this image"}</div>`;
    appendBubble('user', userHTML);

    const imgData = selectedImageBase64;
    userInput.value = '';
    userInput.style.height = 'auto';
    clearPreview();

    abortController = new AbortController();
    actionIcon.className = "fas fa-stop";
    actionBtn.classList.replace("bg-green-600", "bg-red-600");

    const botDiv = appendBubble('bot', `<div class="dot-loading flex gap-1 py-2"><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay:0.2s"></span><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay:0.4s"></span></div><div class="bot-text"></div>`);
    const botTextDiv = botDiv.querySelector('.bot-text');
    const dots = botDiv.querySelector('.dot-loading');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId, mode: document.getElementById('mode-selector').value, image: imgData }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        let reply = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dots) dots.remove();

            reply += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(reply);
            scrollToBottom();
            formatCode(botTextDiv);
        }
        loadHistory();
    } catch (e) {
        botTextDiv.innerHTML = e.name === 'AbortError' ? "Stopped." : "Connection Lost! 😫";
    } finally {
        resetBtn();
    }
}

function formatCode(container) {
    container.querySelectorAll('pre').forEach(block => {
        if (block.parentElement.classList.contains('code-wrap')) return;
        const wrap = document.createElement('div');
        wrap.className = 'code-wrap';
        const lang = block.querySelector('code').className.split('-')[1] || 'Code';
        const header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = `<span>${lang.toUpperCase()}</span><span class="cursor-pointer" onclick="copyC(this)"><i class="far fa-copy"></i> Copy</span>`;
        block.parentNode.insertBefore(wrap, block);
        wrap.appendChild(header); wrap.appendChild(block);
        hljs.highlightAll();
    });
}

window.copyC = (btn) => {
    const code = btn.parentElement.nextElementSibling.innerText;
    navigator.clipboard.writeText(code);
    btn.innerHTML = '<i class="fas fa-check text-green-500"></i> Copied';
    setTimeout(() => btn.innerHTML = '<i class="far fa-copy"></i> Copy', 2000);
}

function resetBtn() {
    abortController = null;
    actionIcon.className = "fas fa-paper-plane";
    actionBtn.classList.replace("bg-red-600", "bg-green-600");
}

function appendBubble(role, html) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
    div.innerHTML = html;
    chatWindow.appendChild(div);
    scrollToBottom();
    return div;
}
