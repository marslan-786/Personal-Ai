require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log('🍃 DB Connected');
    // کلیکشن کلین کرنے کی ضرورت نہیں اگر آپ پرانی چیٹ رکھنا چاہتے ہیں، 
    // لیکن اگر بالکل فریش کرنا ہے تو نیچے والی لائن ان کمنٹ کر دیں:
    // await mongoose.connection.collection('chats').deleteMany({});
}).catch(err => console.error(err));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String, image: String }]
});
const Chat = mongoose.model('Chat', chatSchema);

// --- فائنل ماسٹر پیرامیٹر (Thinking vs Output) ---
const SUPER_PROMPT = `
You are 'Pro Coder', a highly advanced AI. 
DEFAULT LANGUAGE: English. 
LANGUAGE SWITCHING: Always detect the user's language. If they speak Urdu, reply in pure Urdu. If English, reply in English. NEVER mix languages unless requested.

CORE RULES:
1. INTERNAL THINKING: Analyze images and logic internally. Do NOT show phrases like "I was wrong" or "My observation is" unless asked. 
2. NO HALLUCINATION: Only talk about what is actually in the image. If you see a phone, talk about the phone. Do NOT mention internet speed unless the image is a Speedtest.
3. PERSONALITY: Be a loyal, professional, and slightly witty friend.
4. URDU QUALITY: Use natural Urdu (Arsalan with 'س'). 

RESPONSE FORMAT: Give ONLY the final answer. Keep your reasoning hidden.
`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId }) || new Chat({ sessionId, messages: [] });
        
        // اگر تصویر ہے تو Llava، ورنہ Llama 3.1
        const modelName = image ? "llava" : "llama3.1";
        const history = [{ role: 'system', content: SUPER_PROMPT }, ...userChat.messages.slice(-6)];

        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            keep_alive: -1,
            options: { temperature: 0.5, num_ctx: 32768 } // ٹمپریچر کم کیا تاکہ یہ سنجیدہ رہے
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
    } catch (e) { res.status(500).end("Server Busy! Try again."); }
});

app.get('/api/history', async (req, res) => {
    const chats = await Chat.find().sort({ _id: -1 }).limit(20);
    res.json(chats);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Active` ) );
