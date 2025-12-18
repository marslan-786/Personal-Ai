require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🍃 DB Connected')).catch(err => console.error(err));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String, image: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

// --- موڈ کے حساب سے سسٹم پرامپٹ بنانا ---
const getSystemPrompt = (mode) => {
    if (mode === 'pro') {
        return `You are now in 'Thinking Mode' (Pro Coder). 
        1. Think deeply before answering. 
        2. Provide detailed explanations and full working scripts. 
        3. Acknowledge that you are currently in Pro/Thinking mode.
        4. Use natural Pakistani Urdu if the user speaks Urdu.`;
    } else {
        return `You are now in 'Fast Chat Mode' (Guddu AI). 
        1. Respond as FAST as possible. 
        2. Keep answers short, witty, and to the point. 
        3. Acknowledge that you are in Chat/Fast mode.
        4. Use emojis and be friendly.`;
    }
};

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });
        const modelName = image ? "llava" : "gemma2:27b";
        
        // اے آئی کو بتانا کہ وہ اس وقت کس موڈ میں ہے
        const currentInstruction = getSystemPrompt(mode);
        const history = [{ role: 'system', content: currentInstruction }, ...userChat.messages.slice(-6)];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: "24h",
            options: { 
                num_ctx: 32768, 
                temperature: mode === 'pro' ? 0.4 : 0.8, // چیٹ موڈ میں تھوڑا زیادہ کریٹیو اور فاسٹ
                top_p: 0.9 
            }
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
    } catch (e) { res.status(500).end("Server error! Please try again."); }
});

app.get('/api/history', async (req, res) => {
    const chats = await Chat.find({}, 'sessionId messages').sort({ _id: -1 }).limit(10);
    res.json(chats);
});

app.get('/api/chat/:id', async (req, res) => {
    const chat = await Chat.findOne({ sessionId: req.params.id });
    res.json(chat);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Ready`));
