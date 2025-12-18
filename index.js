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

// Chat Schema (یادداشت کا ڈھانچہ)
const chatSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    messages: [
        {
            role: String, // 'user' or 'assistant'
            content: String,
            timestamp: { type: Date, default: Date.now }
        }
    ]
});
const Chat = mongoose.model('Chat', chatSchema);

// --- AI CHAT LOGIC WITH MEMORY ---

app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;

    try {
        // 1. ڈیٹا بیس سے اس سیشن کی پرانی یادداشت تلاش کریں
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) {
            userChat = new Chat({ sessionId, messages: [] });
        }

        // 2. یوزر کا نیا میسج ہسٹری میں ڈالیں
        userChat.messages.push({ role: 'user', content: message });

        // 3. AI کو بھیجنے کے لیے پوری ہسٹری تیار کریں
        // چونکہ آپ کے پاس 32GB RAM ہے، ہم لمبی ہسٹری بھیج سکتے ہیں
        const historyForAI = userChat.messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // 4. Ollama (Llama 3.1) کو کال کریں
        const aiResponse = await axios.post(`${process.env.OLLAMA_URL}/api/chat`, {
            model: "llama3.1:8b",
            messages: historyForAI,
            stream: false,
            options: {
                num_ctx: 32768 // 32GB RAM کی وجہ سے ہم Context Window کو بڑا کر رہے ہیں
            }
        });

        const botReply = aiResponse.data.message.content;

        // 5. AI کا جواب بھی یادداشت (DB) میں محفوظ کریں
        userChat.messages.push({ role: 'assistant', content: botReply });
        await userChat.save();

        // 6. جواب واپس بھیجیں
        res.json({ reply: botReply });

    } catch (error) {
        console.error('❌ Chat Error:', error.message);
        res.status(500).json({ reply: "یار، سرور میں کچھ مسئلہ آ رہا ہے، لیکن میں یادداشت بچانے کی کوشش کر رہا ہوں۔" });
    }
});

// ہوم پیج روٹ
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AI Engine Started on Port ${PORT}`);
});
