const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
const sidebar = document.getElementById('sidebar');
const imagePreview = document.getElementById('image-preview');
let abortController = null;
let selectedImageBase64 = null;

// سائیڈ بار ٹوگل فنکشن
function toggleSidebar() {
    sidebar.classList.toggle('active');
}

// امیج پری ویو اور بیس 64 میں کنورٹ کرنا
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            imagePreview.style.display = 'block';
            selectedImageBase64 = e.target.result.split(',')[1];
        }
        reader.readAsDataURL(file);
    }
}

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

async function handleAction() {
    if (abortController) {
        abortController.abort();
        return;
    }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !selectedImageBase64) return;

    appendMessage('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';
    imagePreview.style.display = 'none';

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
                message: text || "Analyze this image", 
                sessionId: "user-1", 
                mode: document.getElementById('mode-selector').value,
                image: selectedImageBase64 
            }),
            signal: abortController.signal
        });

        selectedImageBase64 = null; // میسج بھیجنے کے بعد امیج صاف کریں

        const reader = response.body.getReader();
        let botText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dots) dots.remove();

            botText += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(botText);
            
            // سمارٹ سکرولنگ: میسج کو ان پٹ سے تھوڑا اوپر لانا
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch (e) {
        if (e.name === 'AbortError') botTextDiv.innerHTML += " [Stopped]";
        else botTextDiv.innerHTML = "Server Error! (Check logs)";
    } finally {
        resetActionBtn();
    }
}

function resetActionBtn() {
    abortController = null;
    actionIcon.className = "fas fa-paper-plane";
    actionBtn.classList.replace("bg-red-600", "bg-green-600");
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `<div class="max-w-[85%] p-4 rounded-2xl ${role === 'user' ? 'bg-green-700' : 'bg-gray-800 border border-gray-700'}">${text}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return div;
}

function applyCodeFixes(container) {
    container.querySelectorAll('pre').forEach(block => hljs.highlightAll());
}
