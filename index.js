require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 Memory Database: Connected & Active'))
  .catch(err => console.error('❌ Database Connection Error:', err));

// Chat Schema
const chatSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    messages: [
        {
            role: String,
            content: String,
            timestamp: { type: Date, default: Date.now }
        }
    ]
});
const Chat = mongoose.model('Chat', chatSchema);

// --- AI CHAT LOGIC (STREAMING & PERSONALITY) ---
app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) userChat = new Chat({ sessionId, messages: [] });

        userChat.messages.push({ role: 'user', content: message });

        // اے آئی کی شخصیت اور اردو املا کی درستی
        const systemPrompt = {
            role: 'system',
            content: "تمہارا نام 'Pro Coder' ہے۔ تم ایک نہایت ذہین اردو ڈویلپر ہو۔ ہمیشہ درست اردو املا استعمال کرو (مثلاً ارسلان 'س' سے لکھو 'ص' سے نہیں، اور 'جڑے' استعمال کرو 'جوڑے' نہیں)۔ جواب نہایت پیشہ ورانہ ہونا چاہیے۔"
        };

        const historyForAI = [systemPrompt, ...userChat.messages.map(msg => ({
            role: msg.role, content: msg.content
        }))];

        // اسٹریمنگ رسپانس کے لیے ہیڈرز
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

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
                        res.write(content); // فرنٹ اینڈ کو ایک ایک لفظ بھیجنا
                    }
                } catch (e) { }
            }
        });

        aiResponse.data.on('end', async () => {
            userChat.messages.push({ role: 'assistant', content: fullReply });
            await userChat.save();
            res.end();
        });

    } catch (error) {
        console.error('❌ AI Error:', error.message);
        res.status(500).end("سرور میں مسئلہ ہے۔");
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Pro Coder Engine Started on Port ${PORT}`);
});
