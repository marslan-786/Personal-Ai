const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const previewBox = document.getElementById('preview-box');
const sidebar = document.getElementById('sidebar');
const historyList = document.getElementById('history-list');

let abortController = null;
let selectedImageBase64 = null;
let sessionId = "S-" + Math.floor(Math.random() * 100000);

window.onload = loadHistory;

function toggleSidebar() { sidebar.classList.toggle('active'); }

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            previewBox.style.display = 'block';
            selectedImageBase64 = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
}

function clearPreview() {
    selectedImageBase64 = null;
    previewBox.style.display = 'none';
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

chatContainer.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-btn');
    if (chatContainer.scrollHeight - chatContainer.scrollTop > 800) btn.style.display = 'flex';
    else btn.style.display = 'none';
});

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = data.map(chat => `
        <div class="p-3 bg-gray-800 rounded-lg border border-gray-700 truncate mb-2">
            ${chat.messages[0]?.content.substring(0, 30) || "Chat Session"}
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

    // یوزر ببل میں پکچر دکھانا
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

    const botDiv = appendBubble('bot', `<div class="flex gap-1 py-2"><div class="w-2 h-2 bg-green-500 rounded-full animate-bounce"></div><div class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay:0.2s"></div><div class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay:0.4s"></div></div><div class="bot-text"></div>`);
    const botTextDiv = botDiv.querySelector('.bot-text');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId, mode: document.getElementById('mode-selector').value, image: imgData }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        let fullReply = "";
        botDiv.querySelector('.flex').remove(); // ڈاٹس ہٹائیں

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullReply += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(fullReply);
            scrollToBottom();
            hljs.highlightAll();
        }
        loadHistory();
    } catch (e) {
        botTextDiv.innerHTML = e.name === 'AbortError' ? "Stopped." : "Error connection! 😫";
    } finally {
        resetBtn();
    }
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
    chatContainer.appendChild(div);
    scrollToBottom();
    return div;
}
