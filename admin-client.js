// admin-client.js (Frontend JS for admin.html)
let token = localStorage.getItem('admin-token'); // Assume separate login for admin

async function loadStats() {
  const res = await fetch('/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  document.getElementById('users-count').textContent = data.usersCount;
  document.getElementById('posts-count').textContent = data.postsCount;
}

async function adminSearchUser() {
  const username = document.getElementById('admin-search-username').value;
  const res = await fetch(`/admin/user/${username}`, { headers: { Authorization: `Bearer ${token}` } });
  const user = await res.json();
  const info = document.getElementById('admin-user-info');
  info.innerHTML = `<p>${user.name} @${user.username} Verified: ${user.verified} Blocked: ${user.blocked}</p>`;
  // Store current user id globally
  window.currentAdminUser = user._id;
}

async function toggleVerification() {
  await fetch(`/admin/toggle-verification/${window.currentAdminUser}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function toggleBlock() {
  await fetch(`/admin/toggle-block/${window.currentAdminUser}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

async function viewUserChats() {
  const res = await fetch(`/admin/user-chats/${window.currentAdminUser}`, { headers: { Authorization: `Bearer ${token}` } });
  const chats = await res.json();
  const chatsDiv = document.getElementById('user-chats');
  chatsDiv.innerHTML = '';
  chats.forEach(chat => {
    const div = document.createElement('div');
    div.innerHTML = '<h3>Chat:</h3>';
    chat.messages.forEach(msg => {
      div.innerHTML += `<p>Sender ${msg.sender}: ${msg.content}</p>`;
    });
    chatsDiv.appendChild(div);
  });
}

async function deleteAllPosts() {
  await fetch(`/admin/delete-posts/${window.currentAdminUser}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
}

loadStats();