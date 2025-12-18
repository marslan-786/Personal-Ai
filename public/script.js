const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
let sessionId = Date.now().toString();

userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';

    // لوڈنگ اینیمیشن (تھری ڈاٹ) والا میسج دکھانا
    const botMsgDiv = appendMessage('bot', `
        <div id="dots" class="dot-loading">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
        <div class="bot-text"></div>
    `);
    
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
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // جیسے ہی پہلا لفظ آئے، ڈاٹس غائب کر دیں
            if (dotsDiv) dotsDiv.remove();

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            botTextDiv.innerHTML = marked.parse(fullText);
            
            // آٹو سکرول
            chatBox.scrollTop = chatBox.scrollHeight;
            
            // کوڈ ہائی لائٹنگ اور کاپی بٹن
            applyCodeEnhancements(botTextDiv);
        }
    } catch (error) {
        if (dotsDiv) dotsDiv.remove();
        botTextDiv.innerHTML = "❌ کنکشن کا مسئلہ ہے۔";
    }
}

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`;
    msgDiv.innerHTML = `
        <div class="max-w-[85%] p-4 rounded-2xl shadow-xl ${role === 'user' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'}">
            ${role === 'user' ? text : text}
        </div>
    `;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    return msgDiv;
}

function applyCodeEnhancements(container) {
    container.querySelectorAll('pre').forEach(block => {
        if (!block.querySelector('.copy-btn')) {
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            btn.onclick = () => {
                const code = block.querySelector('code').innerText;
                navigator.clipboard.writeText(code);
                btn.innerHTML = '<i class="fas fa-check"></i> Copied';
                setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i> Copy', 2000);
            };
            block.appendChild(btn);
        }
    });
    hljs.highlightAll();
}

function newChat() {
    chatBox.innerHTML = '';
    sessionId = Date.now().toString();
    appendMessage('bot', "سلام! میں **Pro Coder** ہوں۔ نئی چیٹ شروع ہو گئی ہے۔ میں آپ کی کیا مدد کر سکتا ہوں؟");
}
