const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const historyList = document.getElementById('history-list');
const previewBox = document.getElementById('preview-box');
const fileLabel = document.getElementById('file-label');

let sessionId = localStorage.getItem('active_id') || "S-" + Math.floor(Math.random() * 9999);
let attachedImg = null;
let attachedFile = null;
let attachedFileName = "";

window.onload = loadHistory;

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function toggleMenu() { document.getElementById('plus-menu').style.display = document.getElementById('plus-menu').style.display === 'block' ? 'none' : 'block'; }
function closeMenu() { document.getElementById('plus-menu').style.display = 'none'; }

function previewImg(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => { 
        attachedImg = e.target.result.split(',')[1];
        previewBox.classList.remove('hidden');
        fileLabel.innerText = "📸 Image: " + file.name;
    };
    reader.readAsDataURL(file);
}

function previewFile(event) {
    const file = event.target.files[0];
    attachedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        attachedFile = e.target.result;
        previewBox.classList.remove('hidden');
        fileLabel.innerText = "📄 File: " + file.name;
    };
    reader.readAsText(file);
}

function clearFiles() {
    attachedImg = null; attachedFile = null; attachedFileName = "";
    previewBox.classList.add('hidden');
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !attachedImg && !attachedFile) return;

    // چیٹ میں ویژول اٹیچمنٹ دکھانا
    let userHTML = "";
    if (attachedImg) userHTML += `<img src="data:image/png;base64,${attachedImg}" class="w-full rounded-lg mb-2 border border-gray-600">`;
    if (attachedFile) userHTML += `<div class="file-pill"><i class="fas fa-file-code"></i> ${attachedFileName} Attached</div>`;
    userHTML += `<div>${text || "Analyze this."}</div>`;
    
    appendBubble('user', userHTML);

    const payload = { 
        message: text, sessionId, 
        mode: document.getElementById('mode-selector').value,
        image: attachedImg, 
        fileText: attachedFile,
        fileName: attachedFileName
    };

    userInput.value = ''; userInput.style.height = 'auto';
    clearFiles();

    const botDiv = appendBubble('bot', '<div class="animate-pulse">Gemma is thinking...</div>');
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const reader = res.body.getReader();
    let reply = "";
    botDiv.innerHTML = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += new TextDecoder().decode(value);
        botDiv.innerHTML = marked.parse(reply);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        hljs.highlightAll();
    }
    loadHistory();
}

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = data.map(chat => `
        <div onclick="loadChat('${chat.sessionId}')" class="p-2 bg-gray-800 rounded mb-1 truncate text-[10px] cursor-pointer hover:bg-gray-700 border-l-2 border-transparent hover:border-green-500">
            ${chat.title}
        </div>
    `).join('');
}

async function loadChat(id) {
    sessionId = id; localStorage.setItem('active_id', id);
    chatWindow.innerHTML = '';
    const res = await fetch(`/api/chat/${id}`);
    const data = await res.json();
    data.messages.forEach(msg => appendBubble(msg.role === 'user' ? 'user' : 'bot', msg.content));
    if(window.innerWidth < 768) toggleSidebar();
}

function newChat() {
    sessionId = "S-" + Math.floor(Math.random() * 9999);
    localStorage.setItem('active_id', sessionId);
    chatWindow.innerHTML = '';
    if(window.innerWidth < 768) toggleSidebar();
}

function appendBubble(role, html) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
    div.innerHTML = html;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return div;
}
