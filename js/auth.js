// ============================================================
// auth.js — Autentikasi (Username/Password + Google OAuth)
// Fix: mendukung GitHub Pages subfolder (contoh: /trotugasweb/)
// Fix: ganti sessionStorage → localStorage agar session tidak
//      hilang saat buka tab baru atau refresh langsung ke halaman
// ============================================================

// ====== KONFIGURASI AKUN ======
const ACCOUNTS = [
  { username: 'admin',  password: 'tro2024',   name: 'Administrator',  role: 'admin' },
  { username: 'user1',  password: 'riset123',  name: 'Pengguna Satu',   role: 'user'  },
  { username: 'dosen',  password: 'dosen2024', name: 'Dosen TRO',       role: 'admin' },
  { username: 'ahan',   password: 'ahan123',   name: 'Ahan',            role: 'user'  },
  { username: 'suci',   password: 'jelek123',  name: 'Suci',            role: 'user'  },
];

// ── Deteksi base path otomatis ──
function getBasePath() {
  const path = window.location.pathname;
  if (path.endsWith('.html')) {
    return path.substring(0, path.lastIndexOf('/') + 1);
  }
  return path.endsWith('/') ? path : path + '/';
}

function goTo(page) {
  window.location.href = getBasePath() + page;
}

// ── Cek session saat halaman dimuat ──
(function checkSession() {
  const filename = window.location.pathname.split('/').pop();
  // ✅ PERBAIKAN: nama file login adalah indeks.html (pakai k)
  const isLoginPage = filename === 'indeks.html' || filename === '' || filename === 'indeks';
  const session = getSession();
  if (session && isLoginPage) {
    goTo('dashboard.html');
  } else if (!session && !isLoginPage) {
    goTo('indeks.html');
  }
})();

// ============================================================
// Login Manual
// ============================================================
function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) { showAlert('Username dan password wajib diisi.'); return; }
  const account = ACCOUNTS.find(a => a.username === username && a.password === password);
  if (!account) { showAlert('Username atau password salah. Coba lagi.'); return; }
  saveSession({ name: account.name, username: account.username, role: account.role, avatar: null, loginMethod: 'manual' });
  goTo('dashboard.html');
}

document.addEventListener('DOMContentLoaded', () => {
  const pwd = document.getElementById('password');
  if (pwd) pwd.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  const usr = document.getElementById('username');
  if (usr) usr.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

// ============================================================
// Google OAuth
// ============================================================
function handleGoogleLogin(response) {
  const payload = parseJwt(response.credential);
  if (!payload || !payload.email) { showAlert('Login Google gagal. Coba lagi.'); return; }
  saveSession({ name: payload.name || payload.email, username: payload.email, role: 'user', avatar: payload.picture || null, loginMethod: 'google', email: payload.email });
  goTo('dashboard.html');
}

function triggerGoogleLogin() {
  if (typeof google === 'undefined' || !google.accounts) {
    showAlert('Google Sign-In belum siap. Pastikan Client ID sudah diisi dan koneksi internet aktif.');
    return;
  }
  google.accounts.id.prompt();
}

// ============================================================
// Session Management
// ✅ PERBAIKAN: pakai localStorage agar session bertahan
//    saat buka tab baru atau akses langsung via URL
// ============================================================
function saveSession(data) {
  localStorage.setItem('tro_session', JSON.stringify(data));
}

function getSession() {
  const raw = localStorage.getItem('tro_session');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function logout() {
  localStorage.removeItem('tro_session');
  if (typeof google !== 'undefined' && google.accounts) {
    try { google.accounts.id.disableAutoSelect(); } catch(e) {}
  }
  goTo('indeks.html');
}

// ============================================================
// Helpers
// ============================================================
function showAlert(msg) {
  const el = document.getElementById('alertMsg');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  } catch { return null; }
}

function renderUserInfo() {
  const session = getSession();
  if (!session) return;
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl) nameEl.textContent = session.name;
  if (roleEl) roleEl.textContent = session.role === 'admin' ? 'Administrator' : 'Pengguna';
  if (avatarEl && session.avatar) { avatarEl.src = session.avatar; avatarEl.style.display = 'block'; }
}
