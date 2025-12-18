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
    title: { type: String, default: "New Session" },
    messages: [{ role: String, content: String, image: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

const MASTER_PROMPT = `Your name is 'Pro Coder'. 
- Respond in the SAME language as the user. Default is English.
- Chat Mode: Fast, witty, direct scripts.
- Thinking Mode: Deep analysis, full step-by-step logic.
- Imaging: Analyze numbers/text precisely.`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) {
            // پہلی بار ٹائٹل میسج سے بنانا
            const title = message.substring(0, 25) + "...";
            userChat = new Chat({ sessionId, title, messages: [] });
        }

        const modelName = image ? "llava" : "gemma2:27b";
        const history = [{ role: 'system', content: MASTER_PROMPT }, ...userChat.messages.slice(-8)];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: "24h"
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        let fullReply = "";
        aiResponse.data.on('data', chunk => {
            try {
                const content = JSON.parse(chunk.toString().split('\n')[0]).message.content;
                fullReply += content;
                res.write(content);
            } catch (e) {}
        });

        aiResponse.data.on('end', async () => {
            userChat.messages.push({ role: 'user', content: message, image: image || null });
            userChat.messages.push({ role: 'assistant', content: fullReply });
            await userChat.save();
            res.end();
        });
    } catch (e) { res.status(500).end("Error! AI is resting."); }
});

// --- ہسٹری مینجمنٹ ---
app.get('/api/history', async (req, res) => {
    const chats = await Chat.find({}, 'sessionId title').sort({ _id: -1 });
    res.json(chats);
});

app.get('/api/chat/:id', async (req, res) => {
    const chat = await Chat.findOne({ sessionId: req.params.id });
    res.json(chat);
});

// چیٹ ڈیلیٹ کرنا
app.delete('/api/chat/:id', async (req, res) => {
    await Chat.deleteOne({ sessionId: req.params.id });
    res.json({ success: true });
});

// چیٹ کا نام بدلنا
app.patch('/api/chat/:id', async (req, res) => {
    await Chat.updateOne({ sessionId: req.params.id }, { title: req.body.title });
    res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Ready`));
