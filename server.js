const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

// Загрузка данных из файла (если есть)
let data = { users: {}, posts: [] };
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.log('Ошибка загрузки data.json — стартуем пустыми');
  }
}
const users = data.users;
const posts = data.posts;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Регистрация — теперь не будет "занято" после рестарта
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Заполни поля' });
  if (users ) return res.json({ success: false, error: 'Юзернейм занят' });

  users = { password, balance: 1000, verified: false, premiumUntil: null };
  saveData();
  res.json({ success: true });
});

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!users || users .password !== password) {
    return res.json({ success: false, error: 'Неверно' });
  }
  res.json({ success: true, username });
});

// Посты — все
app.get('/posts', (req, res) => res.json(posts));

// Создать пост
app.post('/posts', (req, res) => {
  const { username, text } = req.body;
  if (!users ) return res.json({ success: false, error: 'Войди сначала' });

  posts.unshift({ id: Date.now(), username, text, likes: 0, comments: [] });
  saveData();
  res.json({ success: true });
});

// Сохранить данные в файл
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ users, posts }, null, 2));
}

app.listen(PORT, () => console.log(`Работает на ${PORT}`));
