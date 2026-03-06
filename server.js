import express from 'express';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

let db = { users: [], posts: [], chats: [] };

async function sync() {
    try {
        db.users = JSON.parse(await fs.readFile(join(__dirname, 'users.json'), 'utf8'));
        db.posts = JSON.parse(await fs.readFile(join(__dirname, 'posts.json'), 'utf8'));
        db.chats = JSON.parse(await fs.readFile(join(__dirname, 'chats.json'), 'utf8'));
    } catch { db = { users: [], posts: [], chats: [] }; }
}
sync();

async function commit() {
    await fs.writeFile(join(__dirname, 'users.json'), JSON.stringify(db.users, null, 2));
    await fs.writeFile(join(__dirname, 'posts.json'), JSON.stringify(db.posts, null, 2));
    await fs.writeFile(join(__dirname, 'chats.json'), JSON.stringify(db.chats, null, 2));
}

// АВТОРИЗАЦИЯ
app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    if (db.users.find(u => u.username === username)) return res.json({ err: "Ник занят" });
    const user = { id: Date.now(), name, username, password, isVerified: false, isBanned: false, followers: 0 };
    db.users.push(user);
    await commit();
    res.json({ user });
});

// АДМИНКА
app.get('/api/admin/data', (req, res) => res.json(db));
app.post('/api/admin/action', async (req, res) => {
    const { id, type, val } = req.body;
    const u = db.users.find(x => x.id === id);
    if(u) {
        if(type === 'verify') u.isVerified = val;
        if(type === 'ban') u.isBanned = val;
        await commit();
    }
    res.json({ success: true });
});

app.listen(3000, () => console.log('Vikhrify Professional Engine Online'));
