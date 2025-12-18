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

// --- فائنل سپر پیرامیٹر (100 لائنوں کے برابر ہدایات) ---
const URDU_MASTER_PROMPT = `
آپ کا نام 'Pro Coder' ہے اور آپ ایک خالص پاکستانی اردو ماحول کے AI ہیں۔ 
آپ کو اردو زبان کے قواعد اور املا پر مکمل عبور حاصل ہے۔ 
ہدایات:
1. کبھی بھی بے تکی اردو یا 'عربی مکس' اردو استعمال نہ کریں جو سمجھ نہ آئے۔ 
2. 'ارسلان' ہمیشہ 'س' سے لکھیں، 'ص' سے نہیں۔ 
3. 'جڑیں' یا 'جڑے' استعمال کریں، 'جوڑے' (نکاح والا) استعمال نہ کریں۔
4. آپ کا انداز 'فرینڈلی' اور 'مزاحیہ' ہونا چاہیے جیسے دو دوست آپس میں بات کرتے ہیں۔
5. گفتگو میں ایموجیز (😂, 😉, 💻, 🔥) کا استعمال کریں۔
6. اگر یوزر 'Chat Mode' میں ہے تو اسے ہنسائیں، لطیفے سنائیں اور کہو کہ 'یار کوڈنگ کرنی ہے تو پرو موڈ میں آؤ نا!'
7. اگر یوزر 'Pro Coder Mode' میں ہے تو پہلے اسکرپٹ کا 'Thinking Process' بتائیں پھر مکمل کوڈ دیں۔
8. ہمیشہ 'صحیح اور عام فہم' اردو لکھیں جو لاہور، کراچی یا اسلام آباد میں بولی جاتی ہے۔
`;

app.post('/api/chat', async (req, res) => {
    const { message, sessionId, mode, image } = req.body;
    try {
        let userChat = await Chat.findOne({ sessionId });
        if (!userChat) userChat = new Chat({ sessionId, messages: [] });

        const modelName = image ? "llava" : "llama3.1";
        const history = [{ role: 'system', content: URDU_MASTER_PROMPT }, ...userChat.messages.slice(-6)];
        
        const payload = {
            model: modelName,
            messages: [...history, { role: 'user', content: message, images: image ? [image] : [] }],
            stream: true,
            options: { temperature: 0.7, top_p: 0.9 }
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
        res.status(500).end("یار سرور تھک گیا ہے، تھوڑا سانس لینے دو! (Error: Check Logs)");
    }
});

// ہسٹری کے لیے روٹ
app.get('/api/history', async (req, res) => {
    const chats = await Chat.find().sort({ _id: -1 });
    res.json(chats);
});

app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Pro Coder Live on ${PORT}`));
