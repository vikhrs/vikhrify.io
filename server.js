const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname));
app.use(express.json());

let posts = [];
let stories = [];
const privateMsgs = {};
const users = new Map();           // socket.id → данные
const registeredUsers = new Set();

io.on('connection', (socket) => {
  socket.on('loginWithEmail', (email) => {
    registeredUsers.add(email);
    users.set(socket.id, { email, premium: false, verified: false, vxr: 500 });
    broadcastUsers();
    socket.emit('postsUpdate', posts);
    socket.emit('storiesUpdate', stories);
    if (email === 'admin@vikhrify.ru') socket.emit('adminStats', getAdminStats());
  });

  socket.on('buyPremium', (method) => {
    const user = users.get(socket.id);
    if (!user) return;
    let success = method === 'vxr' ? user.vxr >= 299 : true;
    if (success) {
      if (method === 'vxr') user.vxr -= 299;
      user.premium = true;
      user.verified = true;
      socket.emit('premiumActivated', { vxr: user.vxr, verified: true, email: user.email });
      broadcastUsers();
    }
  });

  // ... (все остальные обработчики постов, чата, историй — те же, что были раньше, я их не менял для краткости)

  socket.on('disconnect', () => {
    users.delete(socket.id);
    broadcastUsers();
  });
});

function getAdminStats() {
  return {
    totalRegistered: registeredUsers.size,
    online: users.size,
    premium: Array.from(users.values()).filter(u => u.premium).length,
    verified: Array.from(users.values()).filter(u => u.verified).length
  };
}

function broadcastUsers() {
  const list = Array.from(users.values()).map(u => ({ email: u.email, premium: u.premium, verified: u.verified }));
  io.emit('usersList', list);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Vikhrify запущен: http://localhost:${PORT}`));
