const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const sidebar = document.getElementById('sidebar');
const imagePreviewContainer = document.getElementById('image-preview-container');
const scrollBtn = document.getElementById('scroll-to-bottom');

let abortController = null;
let selectedImageBase64 = null;
let sessionId = "user-" + Math.random().toString(36).substr(2, 5);

function toggleSidebar() { sidebar.classList.toggle('active'); }

function autoGrow(element) {
    element.style.height = "5px";
    element.style.height = (element.scrollHeight) + "px";
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview').src = e.target.result;
            imagePreviewContainer.style.display = 'block';
            selectedImageBase64 = e.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
}

function clearPreview() {
    selectedImageBase64 = null;
    imagePreviewContainer.style.display = 'none';
}

function scrollToBottom() {
    chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
}

chatContainer.addEventListener('scroll', () => {
    if (chatContainer.scrollHeight - chatContainer.scrollTop > 1000) scrollBtn.style.display = 'flex';
    else scrollBtn.style.display = 'none';
});

async function handleAction() {
    if (abortController) { abortController.abort(); return; }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

    // یوزر ببل میں تصویر دکھانا
    let userContent = "";
    if (selectedImageBase64) {
        userContent += `<img src="data:image/png;base64,${selectedImageBase64}" class="msg-img">`;
    }
    userContent += `<div>${text}</div>`;
    appendMessage('user', userContent);

    const currentImage = selectedImageBase64;
    userInput.value = '';
    userInput.style.height = "auto";
    clearPreview();

    // اسٹاپ بٹن دکھانا
    abortController = new AbortController();
    actionIcon.className = "fas fa-stop";
    actionBtn.classList.replace("bg-green-600", "bg-red-600");

    const botMsgDiv = appendMessage('bot', `<div class="dot-bounce"><span class="dot"></span><span class="dot" style="animation-delay:0.2s"></span><span class="dot" style="animation-delay:0.4s"></span></div><div class="bot-text"></div>`);
    const botTextDiv = botMsgDiv.querySelector('.bot-text');
    const dots = botMsgDiv.querySelector('.dot-bounce');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId, mode: document.getElementById('mode-selector').value, image: currentImage }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        let botReply = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dots) dots.remove();
            botReply += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(botReply);
            scrollToBottom();
            hljs.highlightAll();
        }
    } catch (e) {
        if (e.name === 'AbortError') botTextDiv.innerHTML += " [Stopped]";
        else botTextDiv.innerHTML = "سرور تھک گیا ہے یار! دوبارہ ٹرائی کرو۔";
    } finally {
        resetActionBtn();
    }
}

function resetActionBtn() {
    abortController = null;
    actionIcon.className = "fas fa-paper-plane";
    actionBtn.classList.replace("bg-red-600", "bg-green-600");
}

function appendMessage(role, html) {
    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'user-msg' : 'bot-msg'}`;
    div.innerHTML = html;
    chatContainer.appendChild(div);
    scrollToBottom();
    return div;
}
