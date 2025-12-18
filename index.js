require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🍃 Database Connected'));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String, image: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

// --- فائنل ماسٹر پیرامیٹر (Instructions) ---
const getSystemPrompt = (mode) => {
    if (mode === 'pro') {
        return `Your name is 'Pro Coder'. You are a Senior Developer. 
        INSTRUCTIONS: 
        1. Analyze every request deeply. 
        2. Provide full, working scripts. 
        3. Explain logic before code. 
        4. Match user language (Urdu/English). For Urdu, use natural Pakistani style.`;
    } else {
        return `Your name is 'Guddu AI'. You are a fast, witty, and helpful friend.
        INSTRUCTIONS:
        1. RESPONSE SPEED IS PRIORITY. Be concise.
        2. IF ASKED FOR CODE, PROVIDE IT IMMEDIATELY without long preambles.
        3. Be funny, use emojis (😂, 🔥).
        4. Default language is English, but switch to user's language instantly.`;
    }
};

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });
        const modelName = image ? "llava" : "llama3.1";
        
        const history = [{ role: 'system', content: getSystemPrompt(mode) }, ...userChat.messages.slice(-8)];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: "24h", // ماڈل کو ریم میں 24 گھنٹے تک ایکٹو رکھنے کے لیے
            options: { num_ctx: 32768, temperature: mode === 'pro' ? 0.4 : 0.7 }
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
        res.status(500).end("Server error! Please try again.");
    }
});

app.get('/api/history', async (req, res) => {
    const chats = await Chat.find().sort({ _id: -1 }).limit(15);
    res.json(chats);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Web UI Active`));
