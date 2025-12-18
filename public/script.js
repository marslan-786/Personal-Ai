const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const actionBtn = document.getElementById('action-btn');
const actionIcon = document.getElementById('action-icon');
let abortController = null;

// Textarea Auto-height
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Mobile-friendly: Enter does NOT send, only button sends
// (Removed keydown send logic as per your request)

async function handleAction() {
    if (abortController) {
        abortController.abort(); // Stop generating
        return;
    }
    sendMessage();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';

    // UI Change: Send to Stop
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
            body: JSON.stringify({ message: text, sessionId: "session-123", mode: document.getElementById('mode-selector').value }),
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        let botText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dots) dots.remove();

            botText += new TextDecoder().decode(value);
            // Rendered word-by-word feel
            botTextDiv.innerHTML = marked.parse(botText);
            
            // 🔥 Automatic Scroll to bottom
            chatBox.scrollTo(0, chatBox.scrollHeight);
            
            applyCodeFixes(botTextDiv);
        }
    } catch (e) {
        if (e.name === 'AbortError') botTextDiv.innerHTML += " *[Stopped by user]*";
        else botTextDiv.innerHTML = "Error!";
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
    div.innerHTML = `<div class="max-w-[85%] p-4 rounded-2xl ${role === 'user' ? 'bg-green-700 shadow-lg' : 'bg-gray-800 border border-gray-700 shadow-md'}">${text}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTo(0, chatBox.scrollHeight);
    return div;
}

function applyCodeFixes(container) {
    container.querySelectorAll('pre').forEach(block => {
        hljs.highlightAll();
    });
}
