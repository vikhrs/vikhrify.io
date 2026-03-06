const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// --- МОДЕЛИ ДАННЫХ (БАЗА) ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    name: String,
    password: { type: String, required: true },
    avatar: String,
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    verified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    role: { type: String, default: 'user' } // 'admin' или 'user'
});

const PostSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);

// --- СИСТЕМА МУЛЬТИАККАУНТОВ И АВТОРИЗАЦИИ ---
app.post('/api/register', async (req, res) => {
    const { username, name, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const user = await User.create({ username, name, password: hashedPassword });
        const token = jwt.sign({ id: user._id, role: user.role }, 'SECRET_KEY');
        res.json({ message: "Welcome to Vikhrify !", token, user });
    } catch (e) { res.status(400).json({ error: "Username занят" }); }
});

// --- REAL-TIME ЧАТЫ И ЛЕНТА ---
io.on('connection', (socket) => {
    socket.on('join', (userId) => socket.join(userId));

    socket.on('send_msg', async (data) => {
        // Логика шифрования должна быть здесь (AES-256)
        io.to(data.to).emit('new_msg', { from: data.from, text: data.text });
    });

    socket.on('publish_post', async (data) => {
        const post = await Post.create({ author: data.userId, content: data.text });
        const fullPost = await post.populate('author');
        io.emit('feed_update', fullPost); // Мгновенно у всех в ленте
    });
});

// --- АДМИН-ПАНЕЛЬ (КОНТРОЛЬ ТЕРРОРИЗМА И КОНТЕНТА) ---
app.get('/api/admin/stats', async (req, res) => {
    // Проверка токена админа...
    const usersCount = await User.countDocuments();
    const postsCount = await Post.countDocuments();
    res.json({ usersCount, postsCount });
});

app.post('/api/admin/verify', async (req, res) => {
    await User.findOneAndUpdate({ username: req.body.username }, { verified: true });
    res.json({ success: true });
});

server.listen(3000, () => console.log('Vikhrify Server Running on Port 3000'));
