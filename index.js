require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('🍃 DB Connected');
    // صرف اپنی چیٹ کلیکشن کو ایک بار کلین کرنا
    await mongoose.connection.collection('chats').deleteMany({});
    console.log('🧹 Collection Cleaned for a fresh start');
}).catch(err => console.error('DB Error:', err));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String, image: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

// --- سسٹم پرامپٹ (زبان کی تبدیلی کے ساتھ) ---
const SYSTEM_INSTRUCTIONS = `
Your name is 'Pro Coder'. You are a genius AI friend.
CRITICAL RULES:
1. ALWAYS respond in the SAME language the user uses. If they speak Urdu, use Urdu. If they speak English, use English.
2. If in 'Chat Mode', be funny, use emojis, and be a cool friend. 
3. If in 'Pro Coder Mode', analyze the code deeply before providing it.
4. For Urdu: Use correct spellings like 'ارسلان' (with س) and 'جڑے'. 
5. Keep answers concise and fast.
`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });

        const modelName = image ? "llava" : "llama3.1";
        const history = [{ role: 'system', content: SYSTEM_INSTRUCTIONS }, ...userChat.messages.slice(-8)];
        
        // اسٹریمنگ رسپانس
        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: -1 // اے آئی کو ریم میں ہمیشہ ایکٹو رکھنے کے لیے
        }, { responseType: 'stream', timeout: 0 }); // ٹائم آؤٹ ختم کر دیا تاکہ جواب لازمی آئے

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        let fullReply = "";
        
        aiResponse.data.on('data', chunk => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const content = JSON.parse(line).message.content;
                    fullReply += content;
                    res.write(content);
                } catch (e) {}
            }
        });

        aiResponse.data.on('end', async () => {
            userChat.messages.push({ role: 'user', content: message, image: image || null });
            userChat.messages.push({ role: 'assistant', content: fullReply });
            await userChat.save();
            res.end();
        });
    } catch (e) {
        console.error("Error:", e.message);
        res.status(500).end("یار لگتا ہے سرور سو گیا ہے یا کنکشن ٹوٹ گیا ہے۔ دوبارہ کوشش کرو! 😅");
    }
});

// ہسٹری اے پی آئی واپس لگا دی
app.get('/api/history', async (req, res) => {
    const chats = await Chat.find().sort({ _id: -1 });
    res.json(chats);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Engine Live on ${PORT}`));
