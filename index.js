require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('🍃 Database Connected');
    await mongoose.connection.collection('chats').deleteMany({});
    console.log('🧹 Fresh Start: Collection Cleaned');
}).catch(err => console.error(err));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String, image: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

// ---  Urdu Grammar & Vision Intelligence Parameter ---
const AI_MASTER_RULES = `
Role: You are 'Pro Coder', a genius Pakistani AI. 
Urdu Language Mastery:
1. Speak natural, colloquial Urdu (Roman/Script) like a human from Lahore or Karachi.
2. NEVER use direct Arabic translations. Use "Kya haal hai?" instead of weird phrases.
3. Spelling Fix: 'Arsalan' with 'س', 'Jurey rahain' for stay connected.
4. If the user speaks English, switch to English. Match the user's language 100%.

Vision Accuracy:
1. When analyzing images, look at NUMBERS extremely carefully. 
2. Double-check digits. If a Speedtest says 10.02 Mbps, do NOT say 110. Be precise.

Personality:
1. Be funny, friendly, and use emojis (😂, 🔥, ✅). 
2. In 'Chat Mode', act like a best friend. In 'Pro Mode', act like a Senior Developer.
`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });
        const modelName = image ? "llava" : "llama3.1";
        
        const history = [{ role: 'system', content: AI_MASTER_RULES }, ...userChat.messages.slice(-8)];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: -1, // ریم میں محفوظ رکھنے کے لیے
            options: { num_ctx: 32768, temperature: 0.6 }
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
    } catch (e) { res.status(500).end("Server Tired! 😫"); }
});

app.get('/api/history', async (req, res) => {
    const chats = await Chat.find().sort({ _id: -1 });
    res.json(chats);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Engine Ready on ${PORT}`));
