import express from 'express';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '50mb' }));

let db = { users: [], posts: [] };

async function load() {
    try {
        db.users = JSON.parse(await fs.readFile(join(__dirname, 'users.json'), 'utf8'));
        db.posts = JSON.parse(await fs.readFile(join(__dirname, 'posts.json'), 'utf8'));
    } catch (e) { db = { users: [], posts: [], posts: [] }; }
}
await load();

async function save() {
    await fs.writeFile(join(__dirname, 'users.json'), JSON.stringify(db.users, null, 2));
    await fs.writeFile(join(__dirname, 'posts.json'), JSON.stringify(db.posts, null, 2));
}

// Регистрация с проверкой уникальности (только латиница)
app.post('/api/register', async (req, res) => {
    const { name, username, password } = req.body;
    const cleanUser = username.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (db.users.find(u => u.username === cleanUser)) {
        return res.json({ success: false, error: "Этот юзернейм занят!" });
    }
    const user = { id: Date.now(), name, username: cleanUser, password, followers: [], isVerified: false };
    db.users.push(user);
    await save();
    res.json({ success: true, user });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username.toLowerCase() && u.password === password);
    user ? res.json({ success: true, user }) : res.json({ success: false });
});

app.post('/api/admin/action', async (req, res) => {
    const { userId, type, value } = req.body;
    const u = db.users.find(x => x.id === userId);
    if(u && type === 'boost') u.followers.push(Date.now()); // Пример логики
    await save();
    res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(join(__dirname, 'admin.html')));
app.get('/api/all', (req, res) => res.json(db));

app.listen(3000, () => console.log('Vikhrify запущен!'));
