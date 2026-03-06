import express from 'express';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// База данных в памяти
let db = { users: [], posts: [], chats: [] };

async function load() {
    try {
        db.users = JSON.parse(await fs.readFile(join(__dirname, 'users.json'), 'utf8'));
        db.posts = JSON.parse(await fs.readFile(join(__dirname, 'posts.json'), 'utf8'));
        db.chats = JSON.parse(await fs.readFile(join(__dirname, 'chats.json'), 'utf8'));
    } catch (e) { db = { users: [], posts: [], chats: [] }; }
}
await load();

async function save() {
    await fs.writeFile(join(__dirname, 'users.json'), JSON.stringify(db.users, null, 2));
    await fs.writeFile(join(__dirname, 'posts.json'), JSON.stringify(db.posts, null, 2));
    await fs.writeFile(join(__dirname, 'chats.json'), JSON.stringify(db.chats, null, 2));
}

// Регистрация с проверкой уникальности
app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    if (db.users.find(u => u.username === username)) {
        return res.json({ success: false, error: "Этот юзернейм занят!" });
    }
    const newUser = { id: Date.now(), name, username, password, followers: 0, isVerified: false };
    db.users.push(newUser);
    await save();
    res.json({ success: true, user: newUser });
});

// Логин
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username && u.password === password);
    if (!user) return res.json({ success: false });
    res.json({ success: true, user });
});

// Посты
app.post('/api/posts', async (req, res) => {
    const post = { ...req.body, createdAt: new Date() };
    db.posts.push(post);
    await save();
    res.json({ success: true });
});

// Получение всех данных для автообновления
app.get('/api/all', (req, res) => {
    res.json(db);
});

// Админ-действия (бан/накрутка)
app.post('/api/admin/action', async (req, res) => {
    const { userId, type, value } = req.body;
    const user = db.users.find(u => u.id === Number(userId));
    if (user) {
        if (type === 'ban') user.isBlocked = value;
        if (type === 'boost') user.followers = (user.followers || 0) + value;
        await save();
    }
    res.json({ success: true });
});

app.listen(3000, () => console.log('Сервер запущен на порту 3000'));
