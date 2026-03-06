// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const CryptoJS = require('crypto-js');
const webpush = require('web-push');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const SECRET_KEY = 'vikhrify_secret';
const ENCRYPTION_KEY = 'vikhrify_enc_key'; // For chat encryption (server-side, since admin can decrypt)

mongoose.connect('mongodb://localhost:27017/vikhrify', { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  name: String,
  username: { type: String, unique: true },
  password: String,
  avatar: String,
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  verified: { type: Boolean, default: false },
  blocked: { type: Boolean, default: false },
  accounts: [String] // For multi-accounts, store tokens or ids
});

const postSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String, // Encrypted
    timestamp: { type: Date, default: Date.now }
  }]
});

const User = mongoose.model('User', userSchema);
const Post = mongoose.model('Post', postSchema);
const Chat = mongoose.model('Chat', chatSchema);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Auth Middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin Middleware (assume admin is user with username 'admin')
const adminAuth = (req, res, next) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Not admin' });
  next();
};

// Routes
app.post('/register', async (req, res) => {
  const { name, username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ name, username, password: hashed });
  try {
    await user.save();
    const token = jwt.sign({ id: user._id, username }, SECRET_KEY);
    res.json({ token });
  } catch (err) {
    res.status(400).json({ error: 'Username taken' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user._id, username }, SECRET_KEY);
  res.json({ token });
});

app.post('/publish-post', auth, async (req, res) => {
  const { content } = req.body;
  const post = new Post({ author: req.user.id, content });
  await post.save();
  io.emit('new-post', post);
  res.json({ success: true });
});

app.get('/feed', auth, async (req, res) => {
  const posts = await Post.find().sort({ timestamp: -1 }).populate('author', 'name username');
  res.json(posts);
});

app.post('/follow', auth, async (req, res) => {
  const { targetId } = req.body;
  const user = await User.findById(req.user.id);
  const target = await User.findById(targetId);
  if (!user.following.includes(targetId)) {
    user.following.push(targetId);
    target.followers.push(req.user.id);
    await user.save();
    await target.save();
  }
  res.json({ success: true });
});

app.post('/message', auth, async (req, res) => {
  const { targetId, content } = req.body;
  const encrypted = CryptoJS.AES.encrypt(content, ENCRYPTION_KEY).toString();
  let chat = await Chat.findOne({ participants: { $all: [req.user.id, targetId] } });
  if (!chat) {
    chat = new Chat({ participants: [req.user.id, targetId] });
  }
  chat.messages.push({ sender: req.user.id, content: encrypted });
  await chat.save();
  const decrypted = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
  io.to(targetId).emit('new-message', { from: req.user.id, content: decrypted });
  res.json({ success: true });
});

app.get('/chats/:userId', auth, async (req, res) => {
  const chats = await Chat.find({ participants: req.user.id }).populate('participants', 'name username');
  res.json(chats.map(chat => ({
    id: chat._id,
    other: chat.participants.find(p => p._id.toString() !== req.user.id.toString()),
    lastMessage: chat.messages[chat.messages.length - 1] ? CryptoJS.AES.decrypt(chat.messages[chat.messages.length - 1].content, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8) : ''
  })));
});

app.get('/chat/:chatId', auth, async (req, res) => {
  const chat = await Chat.findById(req.params.chatId);
  if (!chat.participants.includes(req.user.id)) return res.status(403).json({ error: 'Access denied' });
  const messages = chat.messages.map(msg => ({
    ...msg._doc,
    content: CryptoJS.AES.decrypt(msg.content, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
  }));
  res.json(messages);
});

// Profile
app.get('/profile/:username', auth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username }).select('-password');
  const posts = await Post.find({ author: user._id });
  res.json({ ...user._doc, posts, followersCount: user.followers.length });
});

app.post('/update-profile', auth, upload.single('avatar'), async (req, res) => {
  const { name } = req.body;
  const user = await User.findById(req.user.id);
  user.name = name || user.name;
  if (req.file) user.avatar = `/uploads/${req.file.filename}`;
  await user.save();
  res.json({ success: true });
});

// Multi Accounts - Simple token storage
app.post('/add-account', auth, async (req, res) => {
  const { newToken } = req.body;
  const user = await User.findById(req.user.id);
  user.accounts.push(newToken);
  await user.save();
  res.json({ success: true });
});

// Admin Routes
app.get('/admin/stats', auth, adminAuth, async (req, res) => {
  const usersCount = await User.countDocuments();
  const postsCount = await Post.countDocuments();
  res.json({ usersCount, postsCount });
});

app.get('/admin/user/:username', auth, adminAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  res.json(user);
});

app.post('/admin/toggle-verification/:userId', auth, adminAuth, async (req, res) => {
  const user = await User.findById(req.params.userId);
  user.verified = !user.verified;
  await user.save();
  res.json({ success: true });
});

app.post('/admin/toggle-block/:userId', auth, adminAuth, async (req, res) => {
  const user = await User.findById(req.params.userId);
  user.blocked = !user.blocked;
  await user.save();
  res.json({ success: true });
});

app.get('/admin/user-chats/:userId', auth, adminAuth, async (req, res) => {
  const chats = await Chat.find({ participants: req.params.userId });
  const decryptedChats = chats.map(chat => ({
    ...chat._doc,
    messages: chat.messages.map(msg => ({
      ...msg._doc,
      content: CryptoJS.AES.decrypt(msg.content, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8)
    }))
  }));
  res.json(decryptedChats);
});

app.delete('/admin/delete-posts/:userId', auth, adminAuth, async (req, res) => {
  await Post.deleteMany({ author: req.params.userId });
  res.json({ success: true });
});

// Push Notifications Setup
const vapidKeys = {
  publicKey: 'BI3jIOqOR5KqNiagyLemVsLTDSqDx1U7SHzF2wV-BNxQ6phiZvGSzsl9-Y1rY4dGN6VqiRHKTpmk90y7xdLmUrw',
  privateKey: '6bwOWQfcDBux3Uu-4gSVZgraPRUqR5VA6FtvU9-76JM'
};
webpush.setVapidDetails('mailto:admin@vikhrify.com', vapidKeys.publicKey, vapidKeys.privateKey);

app.post('/subscribe', auth, (req, res) => {
  const subscription = req.body;
  // Store subscription in user model if needed
  res.status(201).json({});
});

// Socket.io for realtime
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(userId);
  });
});

// To send push
function sendPush(subscription, payload) {
  webpush.sendNotification(subscription, JSON.stringify(payload));
}

// Example usage in message route: after save, sendPush(targetSubscription, { title: 'New Message', body: content });

// Search User
app.get('/search/:username', auth, async (req, res) => {
  const users = await User.find({ username: { $regex: req.params.username, $options: 'i' } }).select('name username followers verified avatar');
  res.json(users.map(u => ({ ...u._doc, followersCount: u.followers.length })));
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

server.listen(3000, () => console.log('Server running on port 3000'));