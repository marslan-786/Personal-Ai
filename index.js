require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection (For Long-term Memory)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🍃 Memory Database Connected'))
  .catch(err => console.error('❌ DB Error:', err));

// MongoDB Schema (چیٹ ہسٹری محفوظ کرنے کے لیے)
const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String }],
    createdAt: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);

// --- ROUTES ---

// 1. ہوم پیج لوڈ کرنا
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. AI سے بات کرنے کا مین اینڈ پوائنٹ
app.post('/api/chat', async (req, res) => {
    const { message, sessionId } = req.body;
    
    // یہاں ہم Ollama (Llama 3.1) کو کال کریں گے
    // اور ڈیٹا بیس سے پرانی میموری نکال کر اسے دیں گے
    res.json({ reply: "سرور ابھی سیٹ اپ ہو رہا ہے، اگلا قدم لاجک لکھنا ہے۔" });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AI Server running on port ${PORT}`);
});
