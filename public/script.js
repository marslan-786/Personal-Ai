const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const historyList = document.getElementById('history-list');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

let sessionId = localStorage.getItem('activeSession') || Date.now().toString();

// پیج لوڈ ہوتے ہی ہسٹری حاصل کریں
window.onload = () => {
    loadHistoryList();
    loadActiveChat();
};

function toggleSidebar() {
    sidebar.classList.toggle('sidebar-closed');
    overlay.classList.toggle('hidden');
}

async function loadHistoryList() {
    const res = await fetch('/api/history');
    const history = await res.json();
    historyList.innerHTML = history.map(item => `
        <div onclick="switchChat('${item.sessionId}')" class="p-3 rounded-lg hover:bg-gray-800 cursor-pointer truncate ${item.sessionId === sessionId ? 'bg-gray-800 text-green-400' : ''}">
            <i class="far fa-comment-alt mr-2"></i> ${item.title}
        </div>
    `).join('');
}

async function switchChat(id) {
    sessionId = id;
    localStorage.setItem('activeSession', id);
    if (window.innerWidth < 768) toggleSidebar();
    loadActiveChat();
    loadHistoryList();
}

async function loadActiveChat() {
    chatBox.innerHTML = '<div class="text-center text-gray-500 mt-10">چیٹ لوڈ ہو رہی ہے...</div>';
    const res = await fetch(`/api/chat/${sessionId}`);
    const data = await res.json();
    chatBox.innerHTML = '';
    if (data && data.messages) {
        data.messages.forEach(msg => appendMessage(msg.role, msg.content));
    }
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    appendMessage('user', text);
    userInput.value = '';

    const botMsgDiv = appendMessage('bot', `<div id="dots" class="dot-loading"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div><div class="bot-text"></div>`);
    const botTextDiv = botMsgDiv.querySelector('.bot-text');
    const dotsDiv = botMsgDiv.querySelector('#dots');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dotsDiv) dotsDiv.remove();
            botText += decoder.decode(value, { stream: true });
            botTextDiv.innerHTML = marked.parse(botText);
            chatBox.scrollTop = chatBox.scrollHeight;
            applyCodeFixes(botTextDiv);
        }
        loadHistoryList(); // ٹائٹل اپ ڈیٹ کرنے کے لیے
    } catch (e) { botTextDiv.innerHTML = "Error!"; }
}

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`;
    msgDiv.innerHTML = `<div class="max-w-[85%] p-4 rounded-2xl ${role === 'user' ? 'bg-green-700' : 'bg-gray-800 border border-gray-700'}">${role === 'bot' ? text : text}</div>`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}

function applyCodeFixes(container) {
    container.querySelectorAll('pre').forEach(block => {
        if (!block.querySelector('.copy-btn')) {
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            btn.onclick = () => {
                navigator.clipboard.writeText(block.querySelector('code').innerText);
                btn.innerHTML = 'Done!';
                setTimeout(() => btn.innerHTML = 'Copy', 2000);
            };
            block.appendChild(btn);
        }
    });
    hljs.highlightAll();
}

function newChat() {
    sessionId = Date.now().toString();
    localStorage.setItem('activeSession', sessionId);
    chatBox.innerHTML = '';
    loadHistoryList();
    if (window.innerWidth < 768) toggleSidebar();
}

userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
