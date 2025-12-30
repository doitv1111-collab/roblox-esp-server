const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

// --- CẤU HÌNH ---
// Lấy Token từ biến môi trường. KHÔNG GHI TOKEN TRỰC TIẾP Ở ĐÂY NỮA!
const TOKEN = process.env.DISCORD_TOKEN; 
const CHANNEL_ID = '1451566877833957510'; // Kênh thông báo
const LOG_CHANNEL_ID = '1438465474177536020'; // Kênh log online

// Khởi tạo client bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Khởi tạo Express Server
const app = express();
const PORT = process.env.PORT || 3000; // Glitch sẽ tự cấp PORT
app.use(bodyParser.json());

// --- QUẢN LÝ DỮ LIỆU ---
let activeUsers = {};

// --- API HEARTBEAT ---
// Xóa user offline sau 30s và báo log
setInterval(async () => {
    const now = Date.now();
    for (const user in activeUsers) {
        if (now - activeUsers[user] > 30000) {
            delete activeUsers[user];
            await sendLog(user, 'offline');
        }
    }
}, 10000);

app.post('/api/heartbeat', async (req, res) => {
    const { username } = req.body;
    if (username) {
        if (!activeUsers[username]) {
            await sendLog(username, 'online');
        }
        activeUsers[username] = Date.now();
        
        // Trả về danh sách user đang online (trừ chính mình)
        const onlineUsers = Object.keys(activeUsers).filter(u => u !== username);
        res.json({ users: onlineUsers });
    } else {
        res.status(400).json({ error: 'Missing username' });
    }
});

async function sendLog(username, status) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (!channel) return;
        let content = status === 'online' ? `🟢 **${username}** đã online` : `🔴 **${username}** đã offline`;
        await channel.send(content);
    } catch (err) {
        console.error('Lỗi gửi log:', err);
    }
}

// --- KHỞI CHẠY ---
app.get('/', (req, res) => res.send('Server is running!')); // Để ping giữ server sống

client.once('ready', () => {
    console.log(`Bot Discord đã online: ${client.user.tag}`);
    app.listen(PORT, () => {
        console.log(`Server API đang chạy tại PORT: ${PORT}`);
    });
});

client.login(TOKEN);