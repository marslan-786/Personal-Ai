require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🍃 DB Connected'));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String, image: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

// --- سسٹم انسٹرکشنز (Google Gemma 2 کے لیے خاص ہدایات) ---
const MASTER_INSTRUCTIONS = `
Your name is 'Pro Coder'. You are powered by Google's Gemma 2 (27B) model.
RULES:
1. Detect user language: If they speak Urdu, reply in natural Pakistani Urdu. If English, use English.
2. In 'Chat Mode', be fast, witty, and helpful.
3. In 'Pro Mode', provide deep logic and full scripts.
4. INTERNAL THINKING: Analyze results internally, output only the final polished answer.
5. IMAGE ANALYSIS: Look at numbers and text in images very carefully.
`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });
        
        // 🔥 یہاں ماڈل نیم فکس کر دیا ہے: اب llama3.1 کی جگہ gemma2:27b استعمال ہوگا
        const modelName = image ? "llava" : "gemma2:27b";
        
        const history = [{ role: 'system', content: MASTER_INSTRUCTIONS }, ...userChat.messages.slice(-10)];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: "24h" // ماڈل کو ریم (RAM) میں ہی رکھے گا
        }, { responseType: 'stream' });

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
        console.error("AI Error:", e.message);
        res.status(500).end("Server Busy! 😫"); 
    }
});

// ہسٹری اینڈ پوائنٹس
app.get('/api/history', async (req, res) => {
    const chats = await Chat.find({}, 'sessionId messages').sort({ _id: -1 }).limit(20);
    res.json(chats);
});

app.get('/api/chat/:id', async (req, res) => {
    const chat = await Chat.findOne({ sessionId: req.params.id });
    res.json(chat);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Web Ready with Gemma 2`));
