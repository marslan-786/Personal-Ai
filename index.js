require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const multer = require('multer'); // فائل اپ لوڈ کے لیے
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const upload = multer({ dest: 'uploads/' }); // عارضی فولڈر

app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🍃 DB Active'));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    mode: { type: String, default: 'chat' }, // chat یا pro
    messages: [{ role: String, content: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) userChat = new Chat({ sessionId, messages: [] });

        // موڈ کے حساب سے سسٹم پرامپٹ (System Prompt)
        let systemContent = "";
        if (mode === 'pro') {
            systemContent = "تمہارا نام 'Pro Coder' ہے۔ تم ایک سینئر ڈیولپر ہو۔ کسی بھی کوڈ کو لکھنے سے پہلے اس کا گہرا تجزیہ (Analysis) کرو اور پہلے 'Thinking Process' بیان کرو۔ اردو املا (ارسلان، جڑے) درست رکھو۔";
        } else {
            systemContent = "تمہارا نام 'Friendly AI' ہے۔ تم مزاحیہ اور خوش اخلاق ہو۔ کوڈنگ سے پرہیز کرو، اگر کوئی کوڈ مانگے تو کہو 'بھائی، پرو کوڈر موڈ میں جاؤ'۔ اردو فرینڈلی اور مزاحیہ ہونی چاہیے۔";
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
    } catch (e) { res.status(500).end("Error"); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Engine on ${PORT}`));
