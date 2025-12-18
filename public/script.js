const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const historyList = document.getElementById('history-list');

let abortController = null;
let selectedImageBase64 = null;
let sessionId = localStorage.getItem('lastSession') || "S-" + Math.floor(Math.random() * 10000);

window.onload = () => {
    loadHistory();
    if(localStorage.getItem('lastSession')) loadChat(sessionId);
};

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }

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

function scrollToBottom() { chatWindow.scrollTop = chatWindow.scrollHeight; }

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = data.map(chat => `
        <div onclick="loadChat('${chat.sessionId}')" class="p-2 bg-gray-800 rounded mb-1 truncate text-[10px] cursor-pointer hover:bg-gray-700 transition border border-transparent hover:border-green-500">
            ${chat.messages[0]?.content.substring(0, 25) || "Image Analysis"}
        </div>
    `).join('');
}

async function loadChat(id) {
    sessionId = id;
    localStorage.setItem('lastSession', id);
    chatWindow.innerHTML = '<div class="text-center text-xs text-gray-500">Loading history...</div>';
    const res = await fetch(`/api/chat/${id}`);
    const data = await res.json();
    chatWindow.innerHTML = '';
    if (data && data.messages) {
        data.messages.forEach(msg => {
            let html = msg.image ? `<img src="data:image/png;base64,${msg.image}" class="chat-img">` : "";
            html += `<div>${msg.content}</div>`;
            appendBubble(msg.role === 'user' ? 'user' : 'bot', html);
        });
    }
    if (window.innerWidth < 768) toggleSidebar();
}

function newSession() {
    sessionId = "S-" + Math.floor(Math.random() * 10000);
    localStorage.setItem('lastSession', sessionId);
    chatWindow.innerHTML = '';
    if (window.innerWidth < 768) toggleSidebar();
}

async function handleAction() {
    if (abortController) { abortController.abort(); return; }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

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
            if (botDiv.querySelector('.dot-loading')) botDiv.querySelector('.dot-loading').remove();
            reply += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(reply);
            scrollToBottom();
            hljs.highlightAll();
        }
        loadHistory();
    } catch (e) {
        botTextDiv.innerHTML = e.name === 'AbortError' ? "Stopped." : "Connection Lost! 😫";
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
    chatWindow.appendChild(div);
    scrollToBottom();
    return div;
}
