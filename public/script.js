const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
const modeSelector = document.getElementById('mode-selector');

// ان پٹ فیلڈ کی اونچائی خودکار بڑھانا
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Enter سے سینڈ، Shift+Enter سے نئی لائن
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';
    userInput.style.height = 'auto';

    // لوڈنگ اینیمیشن
    const botMsgDiv = appendMessage('bot', `<div class="dot-loading"><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce"></span><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></span><span class="w-2 h-2 bg-green-500 rounded-full animate-bounce" style="animation-delay: 0.4s"></span></div><div class="bot-text"></div>`);
    const botTextDiv = botMsgDiv.querySelector('.bot-text');
    const dots = botMsgDiv.querySelector('.dot-loading');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId: "fixed-session", mode: modeSelector.value })
        });

        const reader = response.body.getReader();
        let botText = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (dots) dots.remove();
            botText += new TextDecoder().decode(value);
            botTextDiv.innerHTML = marked.parse(botText);
            
            // 🔥 آٹو اسکرول فکس
            chatBox.scrollTo(0, chatBox.scrollHeight);
            
            applyCodeFixes(botTextDiv);
        }
    } catch (e) { botTextDiv.innerHTML = "Error!"; }
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    div.innerHTML = `<div class="max-w-[85%] p-4 rounded-2xl ${role === 'user' ? 'bg-green-700' : 'bg-gray-800 border border-gray-700'}">${text}</div>`;
    chatBox.appendChild(div);
    chatBox.scrollTo(0, chatBox.scrollHeight);
    return div;
}

function applyCodeFixes(container) {
    container.querySelectorAll('pre').forEach(block => {
        hljs.highlightAll();
        // کاپی بٹن والا لاجک یہاں آئے گا (جو پہلے دیا تھا)
    });
}
