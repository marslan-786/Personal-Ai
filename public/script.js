const chatWindow = document.getElementById('chat-window');
const userInput = document.getElementById('user-input');
const historyList = document.getElementById('history-list');
const plusMenu = document.getElementById('plus-menu');
const previewBox = document.getElementById('preview-box');
const fileNameDisplay = document.getElementById('file-name-display');

let sessionId = localStorage.getItem('active_id') || "S-" + Math.floor(Math.random() * 9999);
let attachedImage = null;
let attachedFileText = null;

window.onload = () => { loadHistory(); if(localStorage.getItem('active_id')) loadChat(sessionId); };

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }
function toggleMenu() { plusMenu.style.display = plusMenu.style.display === 'block' ? 'none' : 'block'; }
function closeMenu() { plusMenu.style.display = 'none'; }

function handleImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedImage = e.target.result.split(',')[1];
            previewBox.style.display = 'block';
            fileNameDisplay.innerText = "📸 Image attached";
        };
        reader.readAsDataURL(file);
    }
}

function handleFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            attachedFileText = e.target.result;
            previewBox.style.display = 'block';
            fileNameDisplay.innerText = "📄 " + file.name;
        };
        reader.readAsText(file);
    }
}

function clearAttachments() {
    attachedImage = null;
    attachedFileText = null;
    previewBox.style.display = 'none';
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !attachedImage && !attachedFileText) return;

    let userHTML = attachedImage ? `<img src="data:image/png;base64,${attachedImage}" class="w-full rounded mb-2">` : "";
    userHTML += `<div>${text}</div>`;
    appendBubble('user', userHTML);

    const dataToSend = {
        message: text,
        sessionId,
        mode: document.getElementById('mode-selector').value,
        image: attachedImage,
        fileText: attachedFileText
    };

    userInput.value = '';
    userInput.style.height = 'auto';
    clearAttachments();

    const botDiv = appendBubble('bot', '<div class="animate-pulse">Thinking...</div>');
    
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
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
        hljs.highlightAll();
    }
    loadHistory();
}

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = data.map(chat => `
        <div onclick="loadChat('${chat.sessionId}')" class="p-2 bg-gray-800 rounded mb-1 truncate cursor-pointer hover:bg-gray-700">
            ${chat.title}
        </div>
    `).join('');
}

async function loadChat(id) {
    sessionId = id;
    localStorage.setItem('active_id', id);
    chatWindow.innerHTML = '';
    const res = await fetch(`/api/chat/${id}`);
    const data = await res.json();
    data.messages.forEach(msg => appendBubble(msg.role === 'user' ? 'user' : 'bot', msg.content));
    if(window.innerWidth < 768) toggleSidebar();
}

function newChat() {
    sessionId = "S-" + Math.floor(Math.random() * 10000);
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
// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}
