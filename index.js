require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// امیج ڈیٹا ہینڈل کرنے کے لیے لیمٹ بڑھائی ہے
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URI).then(() => console.log('🍃 Database Connected'));

const chatSchema = new mongoose.Schema({
    sessionId: String,
    messages: [{ role: String, content: String, images: [String] }]
});
const Chat = mongoose.model('Chat', chatSchema);

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) userChat = new Chat({ sessionId, messages: [] });

        // ماڈل کا انتخاب: اگر تصویر ہے تو llava، ورنہ llama3.1
        const modelName = image ? "llava" : "llama3.1";
        
        let systemPrompt = mode === 'pro' 
            ? "تمہارا نام 'Ustad Coder' ہے۔ تم ایک نہایت ذہین، فرینڈلی اور مزاحیہ ڈویلپر ہو۔ اردو میں بات کرو اور ایموجیز استعمال کرو۔"
            : "تمہارا نام 'Guddu AI' ہے۔ تم بہت کیوٹ اور مزاحیہ اردو بولتے ہو۔ تم لوگوں کو ہنسانے کے ماہر ہو۔";

        const history = [{ role: 'system', content: systemPrompt }, ...userChat.messages.slice(-5)]; // آخری 5 میسجز میموری کے لیے
        
        const payload = {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true
        };

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
            userChat.messages.push({ role: 'user', content: message });
            userChat.messages.push({ role: 'assistant', content: fullReply });
            await userChat.save();
            res.end();
        });
    } catch (e) {
        console.error("Ollama Error:", e.message);
        res.status(500).end("یار، بیک اینڈ پر Ollama جواب نہیں دے رہا۔ لاگز چیک کریں!");
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on ${PORT}`));
