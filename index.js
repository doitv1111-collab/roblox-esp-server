const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); // Dùng để gọi API GitHub

// --- CẤU HÌNH ---
// Lấy Token từ biến môi trường (Render)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; 
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // <== CẦN THÊM CÁI NÀY TRÊN RENDER

// Cấu hình GitHub Repo
const REPO_OWNER = 'doitv1111-collab'; // Tên chủ sở hữu
const REPO_NAME = 'roblox-esp-server'; // Tên Repo
const FILE_PATH = 'users.json'; // Tên file lưu dữ liệu

const CHANNEL_ID = '1451566877833957510'; 
const LOG_CHANNEL_ID = '1438465474177536020';
const DEV_IDS = ['1258654878750740543']; 

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const app = express();
const PORT = process.env.PORT || 3000; 
app.use(bodyParser.json());

// --- QUẢN LÝ DỮ LIỆU ---
let activeUsers = {};
let userMap = {};

// Hàm lấy dữ liệu từ GitHub
async function fetchUsersFromGithub() {
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        const res = await axios.get(url, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        
        // GitHub trả về content dạng Base64 -> Cần decode
        const content = Buffer.from(res.data.content, 'base64').toString('utf8');
        userMap = JSON.parse(content);
        console.log(`✅ Đã load ${Object.keys(userMap).length} user từ GitHub.`);
        return res.data.sha; // Trả về SHA để dùng cho việc update
    } catch (error) {
        console.error('⚠️ Không thể đọc file từ GitHub (Có thể chưa tạo file users.json):', error.response?.status);
        return null;
    }
}

// Hàm lưu dữ liệu lên GitHub
async function saveUsersToGithub(newMap) {
    if (!GITHUB_TOKEN) return false;
    
    try {
        const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
        
        // 1. Lấy SHA hiện tại của file (bắt buộc để update)
        let currentSha = null;
        try {
            const getRes = await axios.get(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
            currentSha = getRes.data.sha;
        } catch (e) { /* File chưa tồn tại thì sha = null -> Tạo mới */ }

        // 2. Upload nội dung mới
        const contentBase64 = Buffer.from(JSON.stringify(newMap, null, 4)).toString('base64');
        
        await axios.put(url, {
            message: "🤖 Bot update users via !link",
            content: contentBase64,
            sha: currentSha
        }, {
            headers: { Authorization: `token ${GITHUB_TOKEN}` }
        });
        
        console.log("💾 Đã lưu dữ liệu lên GitHub thành công!");
        return true;
    } catch (error) {
        console.error('❌ Lỗi lưu GitHub:', error.response?.data || error.message);
        return false;
    }
}

// Load dữ liệu khi khởi động
fetchUsersFromGithub();

// --- API SERVER ---
app.post('/api/heartbeat', async (req, res) => {
    const { username } = req.body;
    if (username) {
        if (!activeUsers[username]) await sendLog(username, 'online');
        activeUsers[username] = Date.now();
        const onlineUsers = Object.keys(activeUsers).filter(u => u !== username);
        res.json({ users: onlineUsers });
    } else {
        res.status(400).json({ error: 'Missing username' });
    }
});

// Xóa user offline
setInterval(async () => {
    const now = Date.now();
    for (const user in activeUsers) {
        if (now - activeUsers[user] > 30000) {
            delete activeUsers[user];
            await sendLog(user, 'offline');
        }
    }
}, 10000);

async function sendLog(username, status) {
    try {
        const channel = await client.channels.fetch(LOG_CHANNEL_ID);
        if (!channel) return;
        
        const cleanName = username.trim().toLowerCase();
        let mention = userMap[cleanName] ? `(<@${userMap[cleanName]}>)` : '';
        
        let content = status === 'online' 
            ? `🟢 **${username}** ${mention} đã online` 
            : `🔴 **${username}** ${mention} đã offline`;
            
        await channel.send(content);
    } catch (err) { console.error(err); }
}

// --- DISCORD COMMANDS ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!online') {
        const users = Object.keys(activeUsers);
        if (users.length === 0) return message.reply('❌ Không có ai online.');
        let msg = `🟢 **Online (${users.length}):**\n`;
        users.forEach(u => {
            const id = userMap[u.toLowerCase()];
            msg += `- **${u}** ${id ? `<@${id}>` : ''}\n`;
        });
        message.reply(msg);
    }

    if (message.content.startsWith('!link')) {
        if (!DEV_IDS.includes(message.author.id)) return message.reply('⛔ Không có quyền.');
        
        const args = message.content.split(' ');
        if (args.length < 2) return message.reply('❌ Dùng: `!link [Roblox] [DiscordID]`');
        
        const rName = args[1].toLowerCase();
        const dId = args[2] || message.author.id;
        
        // Update local
        userMap[rName] = dId;
        message.reply(`⏳ Đang lưu **${args[1]}** -> <@${dId}> lên GitHub...`);
        
        // Update GitHub
        const success = await saveUsersToGithub(userMap);
        if (success) message.channel.send('✅ Đã lưu vĩnh viễn vào Database!');
        else message.channel.send('❌ Lỗi lưu GitHub (Kiểm tra Token).');
    }
    
    if (message.content.startsWith('!unlink')) {
        if (!DEV_IDS.includes(message.author.id)) return message.reply('⛔ Không có quyền.');
        const rName = message.content.split(' ')[1]?.toLowerCase();
        if (userMap[rName]) {
            delete userMap[rName];
            await saveUsersToGithub(userMap);
            message.reply(`🗑️ Đã xóa link: **${rName}**`);
        } else message.reply('⚠️ Không tìm thấy.');
    }
    
    // Lệnh này force update từ GitHub về lại Bot (nếu sửa tay trên web)
    if (message.content === '!sync') {
        await fetchUsersFromGithub();
        message.reply('� Đã đồng bộ dữ liệu mới nhất từ GitHub.');
    }
});

app.get('/', (req, res) => res.send('Server Running'));
client.once('ready', () => {
    console.log(`Bot Online: ${client.user.tag}`);
    app.listen(PORT, () => console.log(`Server port ${PORT}`));
});

client.login(DISCORD_TOKEN);