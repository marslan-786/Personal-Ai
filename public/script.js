const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const historyList = document.getElementById('history-list');
const modeSelector = document.getElementById('mode-selector');

let sessionId = localStorage.getItem('active_id') || "User-" + Math.floor(Math.random() * 9999);
let currentImageBase64 = null;

window.onload = loadHistory;

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }

function handleFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => { currentImageBase64 = e.target.result.split(',')[1]; };
        reader.readAsDataURL(file);
    }
}

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = data.map(chat => `
        <div onclick="loadChat('${chat.sessionId}')" class="p-2 bg-gray-800 rounded mb-1 cursor-pointer truncate">
            ${chat.messages[0]?.content || "New Session"}
        </div>
    `).join('');
}

async function loadChat(id) {
    sessionId = id;
    localStorage.setItem('active_id', id);
    chatWindow.innerHTML = '<div class="text-center text-xs text-gray-500">Loading chat...</div>';
    const res = await fetch(`/api/chat/${id}`);
    const data = await res.json();
    chatWindow.innerHTML = '';
    if (data && data.messages) {
        data.messages.forEach(msg => appendBubble(msg.role === 'user' ? 'user' : 'bot', msg.content));
    }
    toggleSidebar();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !currentImageBase64) return;

    appendBubble('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';

    const botDiv = appendBubble('bot', `<div class="flex gap-1 py-2"><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay:0.2s"></span><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay:0.4s"></span></div><div class="bot-text"></div>`);
    const botTextDiv = botDiv.querySelector('.bot-text');

    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, mode: modeSelector.value, image: currentImageBase64 })
    });

    const reader = response.body.getReader();
    let fullText = "";
    botDiv.querySelector('.flex').remove();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += new TextDecoder().decode(value);
        botTextDiv.innerHTML = marked.parse(fullText);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    loadHistory();
}

function appendBubble(role, content) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
    div.innerHTML = content;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}
