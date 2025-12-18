const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const historyList = document.getElementById('history-list');
const contextMenu = document.getElementById('context-menu');

let sessionId = localStorage.getItem('active_id') || "S-" + Math.floor(Math.random() * 10000);
let targetSession = null; // ڈیلیٹ یا رینیم کے لیے

window.onload = () => {
    loadHistory();
    if(localStorage.getItem('active_id')) loadChat(sessionId);
};

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }

// --- لانگ پریس ہینڈلر ---
function attachLongPress(element, id) {
    let timer;
    element.addEventListener('touchstart', (e) => {
        timer = setTimeout(() => showMenu(e, id), 800);
    });
    element.addEventListener('touchend', () => clearTimeout(timer));
    element.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMenu(e, id);
    });
}

function showMenu(e, id) {
    targetSession = id;
    const x = e.touches ? e.touches[0].pageX : e.pageX;
    const y = e.touches ? e.touches[0].pageY : e.pageY;
    contextMenu.style.display = 'block';
    contextMenu.style.left = x + "px";
    contextMenu.style.top = y + "px";
}

document.addEventListener('click', () => contextMenu.style.display = 'none');

// --- ڈیلیٹ اور رینیم فنکشنز ---
async function deleteChatAction() {
    if(!confirm("Are you sure?")) return;
    await fetch(`/api/chat/${targetSession}`, { method: 'DELETE' });
    if(sessionId === targetSession) newChat();
    loadHistory();
}

async function renameChatPrompt() {
    const newName = prompt("Enter new name for this chat:");
    if(!newName) return;
    await fetch(`/api/chat/${targetSession}`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title: newName })
    });
    loadHistory();
}

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = '';
    data.forEach(chat => {
        const div = document.createElement('div');
        div.className = "chat-item truncate text-[11px] mb-1 " + (chat.sessionId === sessionId ? "border-green-500 text-green-400" : "");
        div.innerText = chat.title;
        div.onclick = () => loadChat(chat.sessionId);
        attachLongPress(div, chat.sessionId); // لانگ پریس اٹیچ کرنا
        historyList.appendChild(div);
    });
}

async function loadChat(id) {
    sessionId = id;
    localStorage.setItem('active_id', id);
    chatWindow.innerHTML = '<div class="text-center text-[10px] text-gray-500">Loading...</div>';
    const res = await fetch(`/api/chat/${id}`);
    const data = await res.json();
    chatWindow.innerHTML = '';
    data.messages.forEach(msg => {
        let html = msg.image ? `<img src="data:image/png;base64,${msg.image}" class="w-full rounded mb-2">` : "";
        html += `<div>${msg.content}</div>`;
        appendBubble(msg.role === 'user' ? 'user' : 'bot', html);
    });
    if(window.innerWidth < 768) toggleSidebar();
}

function newChat() {
    sessionId = "S-" + Math.floor(Math.random() * 10000);
    localStorage.setItem('active_id', sessionId);
    chatWindow.innerHTML = '';
    if(window.innerWidth < 768) toggleSidebar();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    appendBubble('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';

    const botDiv = appendBubble('bot', '<div class="animate-pulse">Thinking...</div>');
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, mode: document.getElementById('mode-selector').value })
    });

    const reader = response.body.getReader();
    let replyText = "";
    botDiv.innerHTML = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        replyText += new TextDecoder().decode(value);
        botDiv.innerHTML = marked.parse(replyText);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    loadHistory(); // لسٹ اپ ڈیٹ کریں
}

function appendBubble(role, html) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
    div.innerHTML = html;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}
