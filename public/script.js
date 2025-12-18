const chatBox = document.getElementById('chat-box');
const userInput = document.getElementById('user-input');
let sessionId = Date.now().toString(); // عارضی سیشن آئی ڈی

// Enter Key سپورٹ
userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    userInput.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, sessionId })
        });
        
        const data = await response.json();
        appendMessage('bot', data.reply);
    } catch (error) {
        appendMessage('bot', "❌ معذرت، سرور سے رابطہ نہیں ہو سکا۔");
    }
}

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
    
    // Markdown Parsing & Syntax Highlighting
    const htmlContent = marked.parse(text);
    
    msgDiv.innerHTML = `
        <div class="max-w-[80%] p-4 rounded-2xl ${role === 'user' ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'} shadow-lg">
            ${htmlContent}
        </div>
    `;
    
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // کوڈ بلاکس میں کاپی بٹن شامل کرنا
    msgDiv.querySelectorAll('pre').forEach(block => {
        if (!block.querySelector('.copy-btn')) {
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            btn.onclick = () => {
                navigator.clipboard.writeText(block.querySelector('code').innerText);
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
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
    appendMessage('bot', "نئی چیٹ شروع ہو گئی ہے۔ میں آپ کی کیا مدد کر سکتا ہوں؟");
}
