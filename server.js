const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Настройка папок: теперь сервер видит всё внутри папки /public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// БАЗОВАЯ БД (Для примера используем массив, если нет MongoDB под рукой)
let posts = [];
let users = [];

// Роут для главной страницы
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Роут для админки
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ЛОГИКА REAL-TIME
io.on('connection', (socket) => {
    console.log('Пользователь в сети');

    // Когда кто-то публикует пост
    socket.on('publish_post', (data) => {
        const newPost = {
            id: Date.now(),
            username: data.username,
            content: data.content,
            verified: data.verified || false
        };
        posts.push(newPost);
        io.emit('feed_update', newPost); // Отправляем ВСЕМ сразу
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен! Заходи сюда: http://localhost:${PORT}`);
    console.log(`Админка тут: http://localhost:${PORT}/admin`);
});
