const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let posts = [];
let takenUsernames = new Set(); // уникальные никнеймы

io.on('connection', (socket) => {
  socket.on('setNickname', (nickname) => {
    if (takenUsernames.has(nickname)) {
      socket.emit('nicknameTaken');
      return;
    }
    takenUsernames.add(nickname);
    socket.nickname = nickname;
    socket.emit('nicknameAccepted', nickname);
    socket.emit('postsUpdate', posts);
  });

  socket.on('newPost', (text) => {
    if (!socket.nickname) return;
    const post = {
      id: Date.now(),
      username: socket.nickname,
      text,
      time: new Date().toLocaleTimeString('ru-RU')
    };
    posts.unshift(post);
    io.emit('postsUpdate', posts);
  });

  socket.on('disconnect', () => {
    if (socket.nickname) takenUsernames.delete(socket.nickname);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Vikhrify запущен: http://localhost:${PORT}`));
