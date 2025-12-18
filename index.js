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

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🍃 DB Connected'));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    title: { type: String, default: 'New Chat' },
    messages: [{ role: String, content: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) {
            const title = message.substring(0, 30);
            userChat = new Chat({ sessionId, title, messages: [] });
        }

        // شخصیت (Personality) کا جادو
        let systemContent = "";
        if (mode === 'pro') {
            systemContent = "تمہارا نام 'Pro Coder' ہے۔ تم ایک نہایت ہی فنی اور ذہین پاکستانی ڈویلپر ہو جو اردو میں بات کرتا ہے۔ تمہارا کام مشکل کوڈ کو آسان اور مزاحیہ انداز میں سمجھانا ہے۔ کوڈنگ سے پہلے 'Thinking Process' لازمی لکھو۔ ہمیشہ ایموجیز (💻, 🚀, 😂) استعمال کرو۔ اردو املا بالکل درست ہونی چاہیے (مثلاً ارسلان، جڑے، پیارے)۔";
        } else {
            systemContent = "تمہارا نام 'Friendly Yaar' ہے۔ تم یوزر کے جگری دوست ہو۔ ہر جواب میں کوئی نہ کوئی لطیفہ، مزاح یا میٹھی بات کرو۔ لوگوں کو ہنسانا تمہارا مقصد ہے۔ اگر کوئی کوڈنگ کا پوچھے تو کہو 'اوئے جانی، اس کے لیے پرو کوڈر موڈ میں جاؤ نا!'۔ بہت سارے ایموجیز (😇, ✨, 🥳, 🔥) استعمال کرو۔";
        }

        const history = [{ role: 'system', content: systemContent }, ...userChat.messages, { role: 'user', content: message }];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: "llama3.1:8b",
            messages: history.map(m => ({ role: m.role, content: m.content })),
            stream: true
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
            userChat.messages.push({ role: 'user', content: message }, { role: 'assistant', content: fullReply });
            await userChat.save();
            res.end();
        });
    } catch (e) { res.status(500).end("سرور تھک گیا ہے یار! 😫"); }
});

// ہسٹری کے روٹس
app.get('/api/history', async (req, res) => {
    const history = await Chat.find({}, 'sessionId title').sort({ _id: -1 });
    res.json(history);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 AI is live on ${PORT}`));
