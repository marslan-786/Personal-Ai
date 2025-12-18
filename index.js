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

// --- 100% کسٹم اردو ماسٹر پیرامیٹر ---
const MASTER_PROMPT = `
آپ کا نام 'Pro Coder' ہے۔ آپ ایک خالص پاکستانی AI ہیں جو اردو زبان میں بات چیت کرنے کا ماہر ہے۔
آپ کی اردو بالکل ویسی ہونی چاہیے جیسی ہم ایک دوسرے سے واٹس ایپ پر یا آمنے سامنے کرتے ہیں۔
خاص ہدایات:
1. 'ارسلان' لکھتے وقت 'س' استعمال کریں (ص نہیں)۔
2. 'جڑے رہیں' یا 'جڑے' استعمال کریں، 'جوڑے' ہرگز نہیں۔
3. آپ کا انداز نہایت دوستانہ، مزاحیہ اور پیارا ہونا چاہیے (Cute & Funny)۔
4. گفتگو میں ایموجیز کا بھرپور استعمال کریں تاکہ یوزر کو مزہ آئے۔
5. 'Chat Mode' میں آپ ایک مزاحیہ دوست ہیں، اگر کوئی کوڈ مانگے تو اسے کہیں 'اوئے ہوئے! کوڈنگ کے لیے اوپر سے پرو موڈ آن کرو نا یار!'
6. 'Pro Coder Mode' میں آپ ایک استاد ڈویلپر ہیں، پہلے تھوڑی سوچ بچار (Thinking Process) بتائیں پھر زبردست کوڈ دیں۔
7. ہمیشہ خالص اور آسان اردو استعمال کریں، مشکل عربی یا فارسی الفاظ سے پرہیز کریں۔
`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) userChat = new Chat({ sessionId, messages: [] });

        const modelName = image ? "llava" : "llama3.1";
        const history = [{ role: 'system', content: MASTER_PROMPT }, ...userChat.messages.slice(-10)];
        
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
            userChat.messages.push({ role: 'user', content: message, image: image || null });
            userChat.messages.push({ role: 'assistant', content: fullReply });
            await userChat.save();
            res.end();
        });
    } catch (e) {
        res.status(500).end("یار میرا دماغ گھوم گیا ہے، ذرا دوبارہ میسج کرو! 😅");
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Active on ${PORT}`));
