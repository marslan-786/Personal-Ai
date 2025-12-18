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

// --- فائنل ماسٹر پیرامیٹر: تھنکنگ اور ٹرانسلیشن ---
const MASTER_SYSTEM_PROMPT = `
You are 'Pro Coder', a highly advanced AI system.
STEP 1: ANALYZE input/images in English for 100% accuracy. Look at numbers (like speed test results) very carefully.
STEP 2: TRANSLATE the final result into perfect, natural Pakistani Urdu.
RULES:
- Use "Kya haal hai?" not weird Arabic translations.
- For Urdu spellings: 'Arsalan' uses 'س'.
- Be funny, witty, and loyal like a best friend.
- If user speaks English, keep it in English.
- OUTPUT ONLY THE FINAL URDU/ENGLISH RESPONSE. NO OBSERVATION TEXT.
`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });
        const modelName = image ? "llava" : "llama3.1";
        
        const history = [{ role: 'system', content: MASTER_SYSTEM_PROMPT }, ...userChat.messages.slice(-6)];

        // اسٹریمنگ کنکشن
        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: -1, // ریم میں ہمیشہ ایکٹو
            options: { num_ctx: 32768, temperature: 0.4 } // کم ٹمپریچر سے گرامر بہتر ہوتی ہے
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
        res.status(500).end("یار لگتا ہے انجن گرم ہو گیا ہے، دوبارہ میسج کرو! 😅");
    }
});

app.get('/api/history', async (req, res) => {
    const chats = await Chat.find().sort({ _id: -1 }).limit(10);
    res.json(chats);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Engine Ready`));
