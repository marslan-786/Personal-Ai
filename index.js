require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 DB Connected'))
  .catch(err => console.error('❌ DB Error:', err));

// اسکیما میں ٹائٹل (Title) کا اضافہ
const chatSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    title: { type: String, default: 'New Chat' },
    messages: [{ role: String, content: String, timestamp: { type: Date, default: Date.now } }]
});
const Chat = mongoose.model('Chat', chatSchema);

// 1. تمام چیٹس کی لسٹ حاصل کرنا (سائیڈ بار کے لیے)
app.get('/api/history', async (req, res) => {
    try {
        const history = await Chat.find({}, 'sessionId title').sort({ _id: -1 });
        res.json(history);
    } catch (e) { res.status(500).send(e.message); }
});

// 2. مخصوص چیٹ لوڈ کرنا
app.get('/api/chat/:sessionId', async (req, res) => {
    try {
        const chat = await Chat.findOne({ sessionId: req.params.sessionId });
        res.json(chat);
    } catch (e) { res.status(500).send(e.message); }
});

// 3. مین چیٹ اینڈ پوائنٹ (اسٹریمنگ کے ساتھ)
app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) {
            // پہلی بار چیٹ کا ٹائٹل پہلے میسج سے بنانا
            const title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
            userChat = new Chat({ sessionId, title, messages: [] });
        }

        userChat.messages.push({ role: 'user', content: message });

        const systemPrompt = {
            role: 'system',
            content: "تمہارا نام 'Pro Coder' ہے۔ تم ایک نہایت ذہین اردو ڈویلپر ہو۔ ہمیشہ درست اردو املا استعمال کرو۔"
        };

        const historyForAI = [systemPrompt, ...userChat.messages.map(msg => ({
            role: msg.role, content: msg.content
        }))];

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: "llama3.1:8b",
            messages: historyForAI,
            stream: true,
            options: { num_ctx: 32768 }
        }, { responseType: 'stream' });

        let fullReply = "";
        aiResponse.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const json = JSON.parse(line);
                    if (json.message && json.message.content) {
                        const content = json.message.content;
                        fullReply += content;
                        res.write(content);
                    }
                } catch (e) { }
            }
        });

        aiResponse.data.on('end', async () => {
            userChat.messages.push({ role: 'assistant', content: fullReply });
            await userChat.save();
            res.end();
        });
    } catch (error) { res.status(500).end("Error"); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server on ${PORT}`));
