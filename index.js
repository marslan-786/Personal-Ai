require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🍃 Memory DB Active'));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

app.post('/api/chat', upload.single('file'), async (req, res) => {
    const { message, sessionId, mode } = req.body;
    const file = req.file;

    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });

        // شخصیت کا جادو (Personality Logic)
        let systemMsg = "";
        if (mode === 'pro') {
            systemMsg = "Tumhara naam 'Pro Coder' hai. Tum aik senior developer ho lekin bohot funny aur friendly ho. Har baat mazaq aur emojis ke saath samjhao. Coding se pehle deep analysis (Thinking) karo. Urdu bilkul natural aur cute honi chahiye! 😉🚀";
        } else {
            systemMsg = "Tumhara naam 'Chulbul AI' hai. Tum aik bohot cute aur mazahiya dost ho. Coding ki baatein mat karo, bas doston ki tarah gap-shap lagao, jokes sunao aur emojis bhar bhar ke use karo. Agar koi code mange to kaho 'Oye hero, Pro Coder mode mein jaao!'. 😂✨";
        }

        let modelName = file ? "llava:8b" : "llama3.1:8b";
        let payload = {
            model: modelName,
            messages: [{ role: 'system', content: systemMsg }, ...userChat.messages, { role: 'user', content: message }],
            stream: true
        };

        // اگر تصویر ہے تو اسے Base64 میں بدلیں
        if (file) {
            const imgBase64 = fs.readFileSync(file.path, { encoding: 'base64' });
            payload.messages[payload.messages.length - 1].images = [imgBase64];
            fs.unlinkSync(file.path); // عارضی فائل ڈیلیٹ کریں
        }

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, payload, { responseType: 'stream' });

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

    } catch (e) { res.status(500).end("Server error, yaar!"); }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Engine on ${PORT}`));
