const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const historyList = document.getElementById('history-list');
let abortController = null;
let selectedImageBase64 = null;
let sessionId = "S-" + Math.floor(Math.random() * 10000);

window.onload = () => { loadHistory(); };

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('active'); }

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            document.getElementById('image-preview-container').style.display = 'block';
            selectedImageBase64 = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
}

function clearPreview() {
    selectedImageBase64 = null;
    document.getElementById('image-preview-container').style.display = 'none';
}

function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function loadHistory() {
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = data.map(chat => `<div class="p-2 bg-gray-800 rounded mb-1 cursor-pointer truncate">${chat.messages[0]?.content.substring(0,25) || "New Chat"}</div>`).join('');
}

async function handleAction() {
    if (abortController) { abortController.abort(); return; }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

    let displayHTML = selectedImageBase64 ? `<img src="data:image/png;base64,${selectedImageBase64}" class="w-full rounded-lg mb-2">` : "";
    displayHTML += `<div>${text}</div>`;
    appendBubble('user', displayHTML);

    const imgToSend = selectedImageBase64;
    userInput.value = '';
    userInput.style.height = "auto";
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
            body: JSON.stringify({ message: text, sessionId, mode: document.getElementById('mode-selector').value, image: imgToSend }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        let replyText = "";
        botDiv.querySelector('.flex').remove(); // لوڈنگ ڈاٹس ہٹائیں

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            replyText += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(replyText);
            scrollToBottom();
            hljs.highlightAll();
        }
        loadHistory();
    } catch (e) {
        botTextDiv.innerHTML = e.name === 'AbortError' ? "Stopped." : "Error! Try again.";
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
