const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const users = {};

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Заполни поля' });
  if (users ) return res.json({ success: false, error: 'Занято' });

  users = { password, balance: 1000, verified: false, premiumUntil: null };
  res.json({ success: true });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users || users .password !== password) {
    return res.json({ success: false, error: 'Неверно' });
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log('Сервер запущен на ' + PORT);
});
