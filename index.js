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

// --- سسٹم انسٹرکشنز (Dynamic Mode) ---
const getSystemPrompt = (mode, langType) => {
    let modeText = mode === 'pro' ? "Thinking/Pro Mode (Deep Analysis)" : "Fast Chat Mode (Concise & Quick)";
    return `Your name is 'Pro Coder'. Current Mode: ${modeText}.
    RULES:
    1. LANGUAGE: Respond ONLY in the language user uses. If Urdu, use ONLY Urdu. If English, use ONLY English. 
    2. NO BRACKETS: Never provide English translations in brackets like (How are you). 
    3. MODE BEHAVIOR: In Chat Mode, be extremely fast and direct. In Pro Mode, explain logic then give the script.
    4. ACCURACY: Look at images and files carefully. If it's a script file, analyze and fix bugs.`;
};

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image, fileText } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });
        
        const modelName = image ? "llava" : "gemma2:27b";
        let fullMessage = message;
        if (fileText) fullMessage = `Content of attached file:\n${fileText}\n\nUser Question: ${message}`;

        const history = [{ role: 'system', content: getSystemPrompt(mode) }, ...userChat.messages.slice(-8)];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: fullMessage, images: image ? [image] : [] }],
            stream: true,
            keep_alive: "24h",
            options: { temperature: mode === 'pro' ? 0.3 : 0.8 }
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        let fullReply = "";
        aiResponse.data.on('data', chunk => {
            try {
                const json = JSON.parse(chunk.toString().split('\n')[0]);
                const content = json.message.content;
                fullReply += content;
                res.write(content);
            } catch (e) {}
        });

        aiResponse.data.on('end', async () => {
            userChat.messages.push({ role: 'user', content: fullMessage, image: image || null });
            userChat.messages.push({ role: 'assistant', content: fullReply });
            if (userChat.messages.length <= 2) userChat.title = message.substring(0, 25);
            await userChat.save();
            res.end();
        });
    } catch (e) { res.status(500).end("Error! Try again."); }
});

// ہسٹری اور مینجمنٹ اینڈ پوائنٹس
app.get('/api/history', async (req, res) => { res.json(await Chat.find({}, 'sessionId title').sort({ _id: -1 })); });
app.get('/api/chat/:id', async (req, res) => { res.json(await Chat.findOne({ sessionId: req.params.id })); });
app.delete('/api/chat/:id', async (req, res) => { await Chat.deleteOne({ sessionId: req.params.id }); res.json({s:1}); });
app.patch('/api/chat/:id', async (req, res) => { await Chat.updateOne({ sessionId: req.params.id }, { title: req.body.title }); res.json({s:1}); });

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 System Live`));
