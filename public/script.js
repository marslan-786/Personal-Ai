const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const sidebar = document.getElementById('sidebar');
const scrollBtn = document.getElementById('scroll-btn');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');

let abortController = null;
let selectedImageBase64 = null;
let sessionId = "session-" + Math.random().toString(36).substr(2, 9);

function toggleSidebar() { sidebar.classList.toggle('active'); }

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            imagePreviewContainer.style.display = 'block';
            selectedImageBase64 = e.target.result.split(',')[1];
        }
        reader.readAsDataURL(file);
    }
}

function clearPreview() {
    selectedImageBase64 = null;
    imagePreviewContainer.style.display = 'none';
}

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// سکرول بٹن دکھانے کا لاجک
chatBox.addEventListener('scroll', () => {
    if (chatBox.scrollHeight - chatBox.scrollTop > 800) scrollBtn.style.display = 'block';
    else scrollBtn.style.display = 'none';
});

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

async function handleAction() {
    if (abortController) { abortController.abort(); return; }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

    // یوزر کا میسج دکھانا (بشمول امیج)
    let userMsgHTML = "";
    if (selectedImageBase64) userMsgHTML += `<img src="data:image/png;base64,${selectedImageBase64}" class="msg-img">`;
    userMsgHTML += `<div>${text || "Analyzed Image"}</div>`;
    appendMessage('user', userMsgHTML);

    const currentImage = selectedImageBase64;
    userInput.value = '';
    userInput.style.height = 'auto';
    clearPreview();

    abortController = new AbortController();
    actionIcon.className = "fas fa-stop";
    actionBtn.classList.replace("bg-green-600", "bg-red-600");

    const botMsgDiv = appendMessage('bot', `<div class="dot-bounce"><span></span><span></span><span></span></div><div class="bot-text"></div>`);
    const botTextDiv = botMsgDiv.querySelector('.bot-text');
    const dots = botMsgDiv.querySelector('.dot-bounce');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: text, sessionId, 
                mode: document.getElementById('mode-selector').value,
                image: currentImage 
            }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        let botText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dots) dots.remove();

            botText += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(botText);
            scrollToBottom();
            hljs.highlightAll();
        }
    } catch (e) {
        if (e.name === 'AbortError') botTextDiv.innerHTML += " [Stopped]";
        else botTextDiv.innerHTML = "Server connection lost! 😫";
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
    div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `<div class="max-w-[85%] p-4 rounded-2xl ${role === 'user' ? 'bg-green-700' : 'bg-gray-800 border border-gray-700'}">${html}</div>`;
    chatBox.appendChild(div);
    scrollToBottom();
    return div;
}
