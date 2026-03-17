/* =====================================================================
   BALLANDOR — eFootball Tournament Manager
   Firebase Realtime Database — bdtracker-76b3b
   ===================================================================== */

// ─── HARDCODED FIREBASE CONFIG ───────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCstuLV0aS74w4wuZkSvo55WcOSEvgdRg8",
  authDomain: "bdtracker-76b3b.firebaseapp.com",
  databaseURL: "https://bdtracker-76b3b-default-rtdb.firebaseio.com",
  projectId: "bdtracker-76b3b",
  storageBucket: "bdtracker-76b3b.firebasestorage.app",
  messagingSenderId: "1018994404531",
  appId: "1:1018994404531:web:9416ec7cf51c92b0b654c6",
  measurementId: "G-FLJ6VFR5EZ"
};

// ─── AUTH STATE ─────────────────────────────────────────────────────
const AUTH = { role: null, userId: null, username: null }; // role: 'admin' | 'player' | 'viewer'

// Superadmin fallback (always works even if Firebase admins node is empty)
const SUPER_ADMIN = { username: 'admin', passwordHash: null }; // hash set on first use
const SUPER_ADMIN_DEFAULT_PWD = 'Ballandor@2026'; // changeable via Firebase

// SHA-256 via Web Crypto API
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Login tab switcher ──
function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.login-tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${tab}-btn`).classList.add('active');
  document.getElementById(`login-${tab}-pane`).classList.add('active');
  // populate player dropdown on vote tab
  if (tab === 'vote') populatePlayerLoginSelect();
}

function populatePlayerLoginSelect() {
  const sel = document.getElementById('player-login-select');
  const players = getPlayersArray().filter(p => !STATE.voters?.[p.id]?.submitted);
  sel.innerHTML = '<option value="">— Choose your name —</option>' +
    players.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
}

function togglePasswordVisibility() {
  const inp = document.getElementById('login-password');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ── Admin Login ──
async function doAdminLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('admin-login-btn');

  if (!username || !password) {
    errEl.textContent = 'Enter both username and password'; errEl.style.display = 'block'; return;
  }
  errEl.style.display = 'none';
  btn.innerHTML = '<span class="spin"></span> Checking…'; btn.disabled = true;

  const hash = await sha256(password);
  let success = false;

  // Check Firebase admins node first
  if (window._fb) {
    const { ref, get, db } = window._fb;
    try {
      const snap = await get(ref(db, `ballandor/admins/${btoa(username)}`));
      if (snap.exists() && snap.val().hash === hash) success = true;
    } catch(e) {}
  }

  // Fallback: check superadmin (stored hash or default password)
  if (!success) {
    const defaultHash = await sha256(SUPER_ADMIN_DEFAULT_PWD);
    // Also check if there's a stored superadmin hash in Firebase
    let storedSuperHash = null;
    if (window._fb) {
      try {
        const { ref, get, db } = window._fb;
        const snap = await get(ref(db, 'ballandor/superAdmin'));
        if (snap.exists()) storedSuperHash = snap.val().hash;
      } catch(e) {}
    }
    const superHash = storedSuperHash || defaultHash;
    if (username === 'admin' && hash === superHash) success = true;
  }

  btn.innerHTML = '🔑 Login as Admin'; btn.disabled = false;

  if (success) {
    AUTH.role = 'admin'; AUTH.username = username;
    sessionStorage.setItem('ballandor_auth', JSON.stringify(AUTH));
    document.getElementById('login-overlay').classList.add('hidden');
    showAdminUI();
  } else {
    errEl.textContent = '❌ Incorrect username or password'; errEl.style.display = 'block';
    document.getElementById('login-password').value = '';
  }
}

// ── Player Login ──
function doPlayerLogin() {
  const playerId = document.getElementById('player-login-select').value;
  const errEl = document.getElementById('vote-login-error');
  if (!playerId) { errEl.textContent = 'Please select your name'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  AUTH.role = 'player'; AUTH.userId = playerId;
  AUTH.username = STATE.players[playerId]?.name || 'Player';
  sessionStorage.setItem('ballandor_auth', JSON.stringify(AUTH));
  document.getElementById('login-overlay').classList.add('hidden');
  showPlayerVoteUI();
}

// ── Logout ──
function doLogout() {
  AUTH.role = null; AUTH.userId = null; AUTH.username = null;
  sessionStorage.removeItem('ballandor_auth');
  document.body.classList.remove('role-player', 'role-viewer');
  document.getElementById('player-vote-overlay').style.display = 'none';
  document.getElementById('login-overlay').classList.remove('hidden');
  populatePlayerLoginSelect();
  // Reset login fields
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('vote-login-error').style.display = 'none';
}

// ── Show login screen ──
function showLoginScreen() {
  // Check session storage for existing auth
  try {
    const saved = sessionStorage.getItem('ballandor_auth');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.role === 'admin' && parsed.username) {
        Object.assign(AUTH, parsed);
        document.getElementById('login-overlay').classList.add('hidden');
        showAdminUI(); return;
      }
      if (parsed.role === 'player' && parsed.userId && STATE.players[parsed.userId]) {
        Object.assign(AUTH, parsed);
        document.getElementById('login-overlay').classList.add('hidden');
        showPlayerVoteUI(); return;
      }
      if (parsed.role === 'viewer') {
        Object.assign(AUTH, parsed);
        document.getElementById('login-overlay').classList.add('hidden');
        showViewerUI(); return;
      }
    }
  } catch(e) {}
  populatePlayerLoginSelect();
  // login overlay is visible by default
}

// ── Show admin UI ──
function showAdminUI() {
  document.body.classList.remove('role-player');
  document.body.classList.remove('role-viewer');
  document.getElementById('player-vote-overlay').style.display = 'none';
  document.getElementById('header-vote-btn').style.display = 'none';
  // Show header admin badge
  const badge = document.getElementById('admin-header-badge');
  if (badge) badge.innerHTML = `<div class="admin-badge">🔐 ${esc(AUTH.username)}</div>`;
  renderAll();
}

// ── Show player vote UI ──
function showPlayerVoteUI() {
  const player = STATE.players[AUTH.userId];
  if (!player) { doLogout(); return; }
  document.body.classList.remove('role-viewer');
  document.body.classList.add('role-player');
  
  // They start by seeing the dashboard, but we enable the "Cast My Ballot" button
  document.getElementById('header-vote-btn').style.display = 'block';
  const badge = document.getElementById('admin-header-badge');
  if (badge) badge.innerHTML = `<div class="admin-badge" style="border-color:rgba(255,255,255,0.2);color:var(--text-primary);"><span style="color:var(--gold);">👤</span> ${esc(player.name)}</div>`;
  
  // Show dashboard
  document.getElementById('player-vote-overlay').style.display = 'none';
  renderAll();
}

// ── Viewer (Public) Login — no credentials required ──
function doViewerLogin() {
  AUTH.role = 'viewer'; AUTH.userId = null; AUTH.username = 'Viewer';
  sessionStorage.setItem('ballandor_auth', JSON.stringify(AUTH));
  document.getElementById('login-overlay').classList.add('hidden');
  showViewerUI();
}

// ── Show viewer UI (public, read-only) ──
function showViewerUI() {
  document.body.classList.remove('role-player');
  document.body.classList.add('role-viewer');
  document.getElementById('player-vote-overlay').style.display = 'none';
  document.getElementById('header-vote-btn').style.display = 'none';
  const badge = document.getElementById('admin-header-badge');
  if (badge) badge.innerHTML = `<div class="admin-badge" style="border-color:rgba(100,180,255,0.25);color:#90caf9;background:rgba(100,180,255,0.08);">👁️ Public Viewer</div>`;
  renderAll();
}

// ── Trigger full-screen player ballot ──
function openPlayerBallotModal() {
  const player = STATE.players[AUTH.userId];
  if (!player) return;
  document.getElementById('pv-player-name').textContent = player.name;
  document.getElementById('pv-avatar').textContent = player.name.charAt(0).toUpperCase();
  // Update player's firebase connection status mirrors
  const pvDot = document.getElementById('pv-firebase-dot');
  const pvTxt = document.getElementById('pv-firebase-text');
  const mainDot = document.getElementById('firebase-dot');
  if (pvDot && mainDot) pvDot.className = mainDot.className;
  if (pvTxt) pvTxt.textContent = document.getElementById('firebase-status-text')?.textContent || 'Online';

  document.getElementById('player-vote-overlay').style.display = 'grid';
  renderPlayerBallot();
}

// ── Render player ballot ──
function renderPlayerBallot() {
  const playerId = AUTH.userId;
  const voter = STATE.voters?.[playerId];
  const hasVotes = voter && Object.values(voter.votes || {}).some(v => v);

  const alreadyEl = document.getElementById('pv-already-voted');
  const ballotEl  = document.getElementById('pv-ballot');

  if (hasVotes) {
    alreadyEl.style.display = 'block';
    ballotEl.style.display  = 'none';
  } else {
    alreadyEl.style.display = 'none';
    ballotEl.style.display  = 'block';
  }
  renderBallotSlots(voter);
}

function showVoteBallot() {
  document.getElementById('pv-already-voted').style.display = 'none';
  document.getElementById('pv-ballot').style.display = 'block';
  renderBallotSlots(STATE.voters?.[AUTH.userId]);
}

function renderBallotSlots(voter) {
  const playerId = AUTH.userId;
  const rankLabels = ['🥇','🥈','🥉','4th','5th','6th','7th'];
  const rankPts = [200,170,150,120,100,90,80];
  const rankClasses = ['rank-1','rank-2','rank-3','','','',''];
  const otherPlayers = getPlayersArray().filter(p => p.id !== playerId);

  document.getElementById('pv-vote-slots').innerHTML = [1,2,3,4,5,6,7].map(rank => {
    const pts = rankPts[rank-1];
    const label = rankLabels[rank-1];
    const cls = rankClasses[rank-1];
    const curVal = voter?.votes?.[rank] || '';
    return `<div class="pv-slot ${cls}">
      <span class="pv-rank-label ${rank<=3?`vote-rank-${rank}`:'vote-rank-other'}">${label}</span>
      <select class="pv-slot-select" id="pvslot-${rank}" onchange="pvUpdateVote(${rank}, this.value)">
        <option value="">— None —</option>
        ${otherPlayers.map(p => `<option value="${p.id}"${p.id===curVal?' selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <span class="pv-rank-pts">${pts} pts</span>
    </div>`;
  }).join('');
}

function pvUpdateVote(rank, playerId) {
  // Prevent duplicate picks across ranks
  if (playerId) {
    // Prevent voting for self
    if (playerId === AUTH.userId) {
      showNotif('You cannot vote for yourself', 'error');
      document.getElementById(`pvslot-${rank}`).value = '';
      return;
    }
    for (let r = 1; r <= 7; r++) {
      if (r === rank) continue;
      const sel = document.getElementById(`pvslot-${r}`);
      if (sel && sel.value === playerId) {
        showNotif(`${STATE.players[playerId]?.name} already picked at rank ${r}`, 'error');
        document.getElementById(`pvslot-${rank}`).value = '';
        return;
      }
    }
  }
}

async function submitPlayerVote() {
  const pid = AUTH.userId;
  if (!pid) return;
  const votes = {};
  const usedIds = new Set();
  for (let r = 1; r <= 7; r++) {
    const val = document.getElementById(`pvslot-${r}`)?.value;
    if (!val) continue;
    if (val === pid) { showNotif('You cannot vote for yourself', 'error'); return; }
    if (usedIds.has(val)) { showNotif('Duplicate pick detected!', 'error'); return; }
    usedIds.add(val); votes[r] = val;
  }
  if (!Object.keys(votes).length) { showNotif('Pick at least one player!', 'error'); return; }

  // Ensure voter entry exists in STATE.voters
  if (!STATE.voters) STATE.voters = {};
  if (!STATE.voters[pid]) {
    STATE.voters[pid] = { id: pid, name: STATE.players[pid]?.name || 'Player', votes: {}, submitted: false };
  }
  STATE.voters[pid].votes = votes;
  STATE.voters[pid].submitted = true;

  const btn = document.getElementById('pv-submit-btn');
  btn.innerHTML = '<span class="spin"></span> Saving…'; btn.disabled = true;
  await saveToFirebase(`ballandor/voters/${pid}`, STATE.voters[pid]);
  btn.innerHTML = '✅ Submit My Vote'; btn.disabled = false;

  showNotif('🗳️ Vote submitted! Thank you!', 'success');
  // Refresh login player list to hide this voter from impersonation
  populatePlayerLoginSelect();
  // Show confirmation
  document.getElementById('pv-ballot').style.display = 'none';
  document.getElementById('pv-already-voted').style.display = 'block';
}

// ── Admin Management ──
async function addAdmin() {
  const username = document.getElementById('new-admin-username').value.trim();
  const password = document.getElementById('new-admin-password').value;
  if (!username || !password) return showNotif('Both fields required', 'error');
  if (password.length < 6)    return showNotif('Password must be ≥ 6 characters', 'error');
  const hash = await sha256(password);
  if (!window._fb) return showNotif('Firebase not connected', 'error');
  const { ref, set, db } = window._fb;
  await set(ref(db, `ballandor/admins/${btoa(username)}`), { username, hash });
  document.getElementById('new-admin-username').value = '';
  document.getElementById('new-admin-password').value = '';
  showNotif(`✅ Admin "${username}" added!`, 'success');
  loadAdminList();
}

async function changeMyPassword() {
  const newPwd = document.getElementById('change-pwd-input').value;
  if (!newPwd || newPwd.length < 6) return showNotif('Password must be ≥ 6 characters', 'error');
  const hash = await sha256(newPwd);
  if (!window._fb) return showNotif('Firebase not connected', 'error');
  const { ref, set, db } = window._fb;
  if (AUTH.username === 'admin') {
    await set(ref(db, 'ballandor/superAdmin'), { hash });
  } else {
    await set(ref(db, `ballandor/admins/${btoa(AUTH.username)}`), { username: AUTH.username, hash });
  }
  document.getElementById('change-pwd-input').value = '';
  showNotif('✅ Password updated!', 'success');
}

async function removeAdmin(username) {
  if (!confirm(`Remove admin "${username}"?`)) return;
  if (username === AUTH.username) return showNotif("Can't remove yourself", 'error');
  if (!window._fb) return;
  const { ref, remove, db } = window._fb;
  await remove(ref(db, `ballandor/admins/${btoa(username)}`));
  showNotif(`Removed admin "${username}"`, 'info');
  loadAdminList();
}

async function loadAdminList() {
  const listEl = document.getElementById('admin-list');
  if (!listEl) return;
  if (!window._fb) { listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;">Firebase not connected</div>'; return; }
  const { ref, get, db } = window._fb;
  try {
    const snap = await get(ref(db, 'ballandor/admins'));
    const admins = snap.val() ? Object.values(snap.val()) : [];
    // Always show superadmin
    const all = [{ username: 'admin', isSuperAdmin: true }, ...admins];
    listEl.innerHTML = `
      <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--gold);margin-bottom:10px;">Current Admins</div>
      ${all.map(a => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;margin-bottom:6px;">
          <span style="font-size:18px;">${a.isSuperAdmin ? '👑' : '🔐'}</span>
          <span style="flex:1;font-weight:500;">${esc(a.username)}</span>
          <span style="font-size:11px;color:var(--text-secondary);">${a.isSuperAdmin ? 'Superadmin' : 'Admin'}</span>
          ${!a.isSuperAdmin ? `<button class="btn btn-danger btn-sm" style="padding:4px 8px;font-size:11px;" onclick="removeAdmin('${a.username}')">✕</button>` : ''}
        </div>
      `).join('')}
    `;
  } catch(e) { listEl.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;">Could not load admins</div>'; }
}

// ─── TOURNAMENT CONFIG ───────────────────────────────────────────────
const TOURNAMENTS = [
  {
    id: 'club_world_cup',
    name: 'Club World Cup',
    roman: 'I',
    icon: '🌍',
    format: 'Knockout (Club teams)',
    pts: { 1: 120, 2: 100, 3: 70, 4: 50, 5: 30 },
    baPoints: 75, bdPoints: 75,
    slots: 5, hasFinal3rd: true,
    special: null
  },
  {
    id: 'copa_america',
    name: 'Copa America',
    roman: 'II',
    icon: '🏆',
    format: 'Knockout',
    pts: { 1: 130, 2: 105, 3: 80, 4: 60, 5: 40 },
    baPoints: 80, bdPoints: 80,
    slots: 5, hasFinal3rd: true,
    special: 'copa_winner' // determines Finalissima participant
  },
  {
    id: 'ucl',
    name: 'UCL',
    roman: 'III',
    icon: '🏅',
    format: 'Group Stage + Knockout (UCL format)',
    pts: { 1: 150, 2: 125, 3: 100, 4: 80, 5: 60 },
    baPoints: 85, bdPoints: 85,
    slots: 5, hasFinal3rd: true,
    special: null
  },
  {
    id: 'euros',
    name: 'Euros',
    roman: 'IV',
    icon: '🇪🇺',
    format: 'Knockout',
    pts: { 1: 130, 2: 105, 3: 80, 4: 60, 5: 40 },
    baPoints: 80, bdPoints: 80,
    slots: 5, hasFinal3rd: true,
    special: 'euros_winner' // determines Finalissima participant
  },
  {
    id: 'world_cup',
    name: 'World Cup',
    roman: 'V',
    icon: '🌐',
    format: 'Knockout (Most important — highest points)',
    pts: { 1: 170, 2: 135, 3: 110, 4: 90, 5: 70 },
    baPoints: 90, bdPoints: 90,
    slots: 5, hasFinal3rd: true,
    special: null
  },
  {
    id: 'finalissima',
    name: 'Finalissima',
    roman: 'VI',
    icon: '⚡',
    format: 'Single match: Copa America Winner vs Euros Winner',
    pts: { 1: 50, 2: 25 },
    baPoints: 0, bdPoints: 0,
    slots: 2, hasFinal3rd: false,
    special: 'finalissima' // only 2 eligible players
  },
  {
    id: 'super_league',
    name: 'Super League',
    roman: 'VII',
    icon: '⭐',
    format: 'UCL format (Group stage + Knockout)',
    pts: { 1: 120, 2: 100, 3: 70, 4: 50, 5: 30 },
    baPoints: 75, bdPoints: 75,
    slots: 5, hasFinal3rd: true,
    special: null
  },
  {
    id: 'intercontinental_cup',
    name: 'Intercontinental Cup',
    roman: 'VIII',
    icon: '🌎',
    format: 'Top 8 of Ballandor ranking only',
    pts: { 1: 110, 2: 80, 3: 60, 4: 40, 5: 30 },
    baPoints: 70, bdPoints: 70,
    slots: 5, hasFinal3rd: true,
    special: 'top8' // only top 8 from Ballandor ranking
  },
  {
    id: 'fa_cup',
    name: 'FA Cup',
    roman: 'IX',
    icon: '🎽',
    format: 'Others (not in Top 8)',
    pts: { 1: 90, 2: 70, 3: 50, 4: 30, 5: 20 },
    baPoints: 65, bdPoints: 65,
    slots: 5, hasFinal3rd: true,
    special: 'others' // players NOT in top 8
  }
];

const VOTING_PTS = [0, 200, 170, 150, 120, 100, 90, 80]; // index = rank (1-based)
const SESSION_PTS = { 1: 200, 2: 150, 3: 120 };

// ─── APP STATE ────────────────────────────────────────────────────────
const STATE = {
  players: {},      // { id: { id, name, team, teamType, logo } }
  results: {},      // { tournamentId: { positions: {1: playerId, ...}, ba: [p1,p2,p3], bd: [p1,p2,p3] } }
  session: {        // whole-season BA/BD awards
    ba: { 1: null, 2: null, 3: null },
    bd: { 1: null, 2: null, 3: null }
  },
  voters: {},       // { voterId: { name, votes: { 1: playerId, 2: ..., ... } } }
  votingResults: {},// { playerId: totalVotingPts }
  matches: {},      // { tournamentId: { roundIndex: { matchId: { p1, p2, s1, s2, winner, isBye } } } }
  tournamentStats: {}// { tournamentId: { playerId: { matchesPlayed, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, points } } }
};

let db = null;
let firebaseApp = null;
let firebaseConfig = null;

// ─── FIREBASE INIT ────────────────────────────────────────────────────
// Config is hardcoded above — no manual entry needed

async function initFirebase(cfg) {
  try {
    // Remove old Firebase instance
    if (firebaseApp) {
      try { await window.firebaseDeleteApp(firebaseApp); } catch(e) {}
    }

    const { initializeApp, deleteApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    const { getDatabase, ref, onValue, set, get, remove } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');

    window.firebaseDeleteApp = deleteApp;

    firebaseApp = initializeApp(cfg, 'ballandor-' + Date.now());
    db = getDatabase(firebaseApp);

    // Expose Firebase functions globally
    window._fb = { ref, onValue, set, get, remove, db };

    setFirebaseStatus('connected', 'Online');
    showNotif('✅ Firebase connected!', 'success');

    // Subscribe to real-time data
    subscribeToData();
    return true;
  } catch(err) {
    console.error('Firebase init error:', err);
    setFirebaseStatus('error', 'Error');
    showNotif('Firebase error: ' + err.message, 'error');
    return false;
  }
}

function setFirebaseStatus(status, text) {
  const dot = document.getElementById('firebase-dot');
  const txt = document.getElementById('firebase-status-text');
  dot.className = 'firebase-dot' + (status === 'connected' ? ' connected' : status === 'error' ? ' error' : '');
  txt.textContent = text;
}

function subscribeToData() {
  if (!window._fb) return;
  const { ref, onValue, db } = window._fb;

  onValue(ref(db, 'ballandor'), (snap) => {
    const data = snap.val();
    if (data) {
      if (data.players) STATE.players = data.players;
      if (data.results) STATE.results = data.results;
      if (data.session) STATE.session = data.session;
      if (data.voters) STATE.voters = data.voters;
      if (data.votingResults) STATE.votingResults = data.votingResults;
      if (data.matches) STATE.matches = data.matches;
      if (data.tournamentStats) STATE.tournamentStats = data.tournamentStats;
    }
    renderAll();
    if (CURRENT_TD_ID) renderTournamentDashboard(CURRENT_TD_ID); // Auto-refresh dashboard if open
  });
}

async function saveToFirebase(path, value) {
  if (!window._fb) {
    // fallback to localStorage
    localStorage.setItem('ballandor_local', JSON.stringify(STATE));
    return;
  }
  const { ref, set, db } = window._fb;
  try {
    await set(ref(db, path), value);
  } catch(err) {
    showNotif('Save error: ' + err.message, 'error');
    // fallback to local
    localStorage.setItem('ballandor_local', JSON.stringify(STATE));
  }
}

// ─── PLAYER MANAGEMENT ───────────────────────────────────────────────
function addPlayer(name, team = "") {
  name = name.trim();
  team = team.trim() || "Free Agent";
  if (!name) return showNotif('Enter a player name', 'error');
  const count = Object.keys(STATE.players).length;
  if (count >= 36) return showNotif('Maximum 36 players allowed', 'error');
  // Check duplicate
  if (Object.values(STATE.players).some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return showNotif(`"${name}" is already registered`, 'error');
  }
  const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  // If advanced player fields have been captured in the form, read them; otherwise fall back to defaults.
  let teamType = 'club';
  let logo = '';
  try {
    const ttEl = document.getElementById('new-player-team-type');
    const logoEl = document.getElementById('new-player-logo');
    if (ttEl && ttEl.value) teamType = ttEl.value;
    if (logoEl && logoEl.value) logo = logoEl.value.trim();
  } catch(e) {}
  STATE.players[id] = { id, name, team, teamType, logo };
  saveToFirebase('ballandor/players', STATE.players);
  showNotif(`✅ ${name} added!`, 'success');
}

function removePlayer(id) {
  if (!STATE.players[id]) return;
  const name = STATE.players[id].name;
  if (!confirm(`Remove ${name}? This will also remove their results.`)) return;
  delete STATE.players[id];
  saveToFirebase('ballandor/players', STATE.players);
  showNotif(`Removed ${name}`, 'info');
}

function getPlayersArray() {
  return Object.values(STATE.players).sort((a,b) => a.name.localeCompare(b.name));
}

function getPlayerLogoImg(player, sizeClass = '') {
  if (!player || !player.logo) return '';
  const typeLabel = player.teamType === 'national' ? 'Flag' : 'Logo';
  const alt = `${typeLabel} of ${player.team || ''}`.trim();
  const cls = sizeClass ? `player-logo ${sizeClass}` : 'player-logo';
  return `<img src="${esc(player.logo)}" alt="${esc(alt)}" class="${cls}">`;
}

function renderPlayerNameWithLogo(player) {
  if (!player) return '—';
  const logo = getPlayerLogoImg(player, 'small');
  if (!logo) return esc(player.name);
  return `<span class="player-with-logo">${logo}<span>${esc(player.name)}</span></span>`;
}

// ─── SCORING ENGINE ──────────────────────────────────────────────────
function computeTournamentPoints(playerId) {
  let total = 0;
  for (const [tid, result] of Object.entries(STATE.results || {})) {
    const tConfig = TOURNAMENTS.find(t => t.id === tid);
    if (!tConfig || !result) continue;

    // Position points
    if (result.positions) {
      for (const [pos, pid] of Object.entries(result.positions)) {
        if (pid === playerId) {
          total += tConfig.pts[parseInt(pos)] || 0;
        }
      }
    }
    // BA points
    if (result.ba) {
      const baIdx = result.ba.indexOf(playerId);
      if (baIdx >= 0) total += baIdx === 0 ? tConfig.baPoints : baIdx === 1 ? Math.round(tConfig.baPoints * 0.75) : Math.round(tConfig.baPoints * 0.5);
    }
    // BD points
    if (result.bd) {
      const bdIdx = result.bd.indexOf(playerId);
      if (bdIdx >= 0) total += bdIdx === 0 ? tConfig.bdPoints : bdIdx === 1 ? Math.round(tConfig.bdPoints * 0.75) : Math.round(tConfig.bdPoints * 0.5);
    }
  }
  return total;
}

function computeSessionPoints(playerId) {
  let total = 0;
  const sess = STATE.session || { ba: {}, bd: {} };
  // Best Attack Season
  for (const [pos, pid] of Object.entries(sess.ba || {})) {
    if (pid === playerId) total += SESSION_PTS[parseInt(pos)] || 0;
  }
  // Best Defence Season
  for (const [pos, pid] of Object.entries(sess.bd || {})) {
    if (pid === playerId) total += SESSION_PTS[parseInt(pos)] || 0;
  }
  return total;
}

function computeVotingPoints(playerId) {
  return (STATE.votingResults || {})[playerId] || 0;
}

function computeTotalPoints(playerId) {
  return computeTournamentPoints(playerId) + computeSessionPoints(playerId) + computeVotingPoints(playerId);
}

function getRankedPlayers() {
  return getPlayersArray()
    .map(p => ({
      ...p,
      tournamentPts: computeTournamentPoints(p.id),
      sessionPts: computeSessionPoints(p.id),
      votingPts: computeVotingPoints(p.id),
      total: computeTotalPoints(p.id)
    }))
    .sort((a,b) => b.total - a.total);
}

function getTournamentRanking(upToIndex) {
  // Rank players based on tournaments 0..upToIndex (used for VIII/IX split)
  const pts = {};
  const players = getPlayersArray();
  players.forEach(p => { pts[p.id] = 0; });

  for (let i = 0; i <= upToIndex; i++) {
    const t = TOURNAMENTS[i];
    const result = (STATE.results || {})[t.id];
    if (!result) continue;
    if (result.positions) {
      for (const [pos, pid] of Object.entries(result.positions)) {
        if (pts[pid] !== undefined) pts[pid] += t.pts[parseInt(pos)] || 0;
      }
    }
    if (result.ba) {
      result.ba.forEach((pid, idx) => {
        if (pts[pid] !== undefined) pts[pid] += idx===0 ? t.baPoints : idx===1 ? Math.round(t.baPoints*0.75) : Math.round(t.baPoints*0.5);
      });
    }
    if (result.bd) {
      result.bd.forEach((pid, idx) => {
        if (pts[pid] !== undefined) pts[pid] += idx===0 ? t.bdPoints : idx===1 ? Math.round(t.bdPoints*0.75) : Math.round(t.bdPoints*0.5);
      });
    }
  }
  return players
    .map(p => ({ ...p, pts: pts[p.id] || 0 }))
    .sort((a,b) => b.pts - a.pts);
}

function getTop8Ids() {
  // After tournament VII (index 6 = Super League), rank players
  const ranked = getTournamentRanking(6);
  return ranked.slice(0, 8).map(p => p.id);
}

function getFinalissimaPlayers() {
  const copaResult = (STATE.results || {}).copa_america;
  const eurosResult = (STATE.results || {}).euros;
  const copaWinner = copaResult?.positions?.[1];
  const eurosWinner = eurosResult?.positions?.[1];
  return { copaWinner, eurosWinner };
}

function completedCount() {
  return Object.keys(STATE.results || {}).length;
}

// ─── RENDER FUNCTIONS ────────────────────────────────────────────────
function renderAll() {
  renderDashboard();
  renderPlayers();
  renderTournaments();
  renderSession();
  renderVoting();
}

function renderDashboard() {
  const players = getPlayersArray();
  const ranked = getRankedPlayers();
  const done = completedCount();

  document.getElementById('stat-players').textContent = players.length;
  document.getElementById('stat-tournaments').textContent = `${done}/9`;
  document.getElementById('stat-leader').textContent = ranked[0]?.name || '—';
  document.getElementById('stat-top-pts').textContent = ranked[0]?.total || 0;
  const pct = Math.round((done / 9) * 100);
  document.getElementById('season-progress-bar').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';

  // Progress dots
  const dotsEl = document.getElementById('tournament-progress-dots');
  dotsEl.innerHTML = TOURNAMENTS.map((t, i) => {
    const done_ = STATE.results?.[t.id];
    const isCurrent = !done_ && (i === 0 || STATE.results?.[TOURNAMENTS[i-1]?.id]);
    return `<div style="padding:6px 10px;border-radius:6px;font-size:12px;font-weight:600;
      background:${done_?'rgba(212,175,55,0.2)':isCurrent?'rgba(61,158,61,0.2)':'rgba(255,255,255,0.05)'};
      color:${done_?'var(--gold)':isCurrent?'#6fcf6f':'var(--text-secondary)'};
      border:1px solid ${done_?'rgba(212,175,55,0.3)':isCurrent?'rgba(61,158,61,0.3)':'transparent'};
      " title="${t.name}">${t.roman} ${t.icon}</div>`;
  }).join('');

  // Leaderboard
  const body = document.getElementById('leaderboard-body');
  if (!ranked.length) {
    body.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">⚽</div><div class="empty-title">No data yet</div><div class="empty-desc">Add players and register tournament results</div></div></td></tr>`;
    return;
  }
  body.innerHTML = ranked.map((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    const nameCell = renderPlayerNameWithLogo(p);
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${i+1}</span></td>
      <td class="player-name-cell">${nameCell}</td>
      <td style="color:var(--text-secondary);font-size:12px;">${esc(p.team || 'Free Agent')}</td>
      <td class="points-cell">${p.tournamentPts}</td>
      <td class="points-cell">${p.sessionPts}</td>
      <td class="points-cell">${p.votingPts}</td>
      <td class="points-cell total">${p.total}</td>
    </tr>`;
  }).join('');
}

function renderPlayers() {
  const players = getPlayersArray();
  const search = document.getElementById('player-search')?.value?.toLowerCase() || '';
  const filtered = players.filter(p => p.name.toLowerCase().includes(search));
  const grid = document.getElementById('player-grid');
  const countEl = document.getElementById('player-count-label');
  countEl.textContent = `${players.length} / 36 players`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">👤</div><div class="empty-title">No players found</div><div class="empty-desc">${players.length ? 'Try a different search' : 'Click "Add Player" to register participants'}</div></div>`;
    return;
  }
  grid.innerHTML = filtered.map(p => {
    const logo = getPlayerLogoImg(p, 'small');
    const avatarInner = logo || esc(p.name.charAt(0).toUpperCase());
    const teamLabel = p.team || 'Free Agent';
    const typeLabel = p.teamType === 'national' ? '🇺🇳 National' : '🏟️ Club';
    return `
      <div class="player-chip" id="chip-${p.id}">
        <div class="player-avatar">${avatarInner}</div>
        <div style="flex:1;">
          <div class="player-chip-name">${esc(p.name)}</div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">
            ${typeLabel} · ${esc(teamLabel)}
          </div>
        </div>
        ${AUTH.role === 'admin' ? `<button class="player-delete admin-only" onclick="removePlayer('${p.id}')" title="Remove">✕</button>` : ''}
      </div>
    `;
  }).join('');
}

function renderTournaments() {
  const grid = document.getElementById('tournaments-grid');
  grid.innerHTML = TOURNAMENTS.map((t, idx) => {
    const result = (STATE.results || {})[t.id];
    const isCompleted = !!result;
    const prevDone = idx === 0 || !!(STATE.results || {})[TOURNAMENTS[idx-1].id];
    const isAvailable = prevDone;

    let statusHtml = isCompleted
      ? '<span class="t-status status-completed">✅ Done</span>'
      : isAvailable
        ? '<span class="t-status status-active">▶ Available</span>'
        : '<span class="t-status status-upcoming">🔒 Locked</span>';

    let specialTag = '';
    if (t.special === 'top8') specialTag = '<span style="font-size:11px;color:#6fcf6f;background:rgba(61,158,61,0.15);padding:2px 8px;border-radius:10px;border:1px solid rgba(61,158,61,0.3);">Top 8 only</span>';
    if (t.special === 'others') specialTag = '<span style="font-size:11px;color:#81c784;background:rgba(129,199,132,0.1);padding:2px 8px;border-radius:10px;border:1px solid rgba(129,199,132,0.2);">Others only</span>';
    if (t.special === 'finalissima') specialTag = '<span style="font-size:11px;color:#ffcc02;background:rgba(255,204,2,0.1);padding:2px 8px;border-radius:10px;border:1px solid rgba(255,204,2,0.2);">Copa & Euros winners</span>';

    const ptsDisplay = Object.entries(t.pts)
      .map(([pos, pts]) => `<span class="t-points-badge${pos==='1'?' gold':''}">P${pos}: ${pts}</span>`)
      .join('');

    const winnerName = result?.positions?.[1] ? (STATE.players[result.positions[1]]?.name || 'Unknown') : null;

    return `<div class="tournament-card${!isAvailable?' locked':''}" id="tc-${t.id}">
      <div class="t-header">
        <div class="t-number">${t.roman}</div>
        <div class="t-info">
          <div class="t-name">${t.icon} ${t.name}</div>
          <div class="t-subtitle">${t.format}</div>
        </div>
        ${statusHtml}
      </div>
      <div class="t-body">
        ${specialTag ? `<div style="margin-bottom:10px;">${specialTag}</div>` : ''}
        <div class="t-points-row">${ptsDisplay}</div>
        ${winnerName ? `<div style="margin-top:6px;font-size:12px;color:var(--gold);">🏆 Winner: <strong>${esc(winnerName)}</strong></div>` : ''}
        <div style="display:flex;gap:8px;">
          <button class="t-action-btn" onclick="openTournamentDashboard('${t.id}')"
            ${!isAvailable?'disabled':''}>
            📊 Dashboard
          </button>
          ${AUTH.role === 'admin' ? `<button class="t-action-btn admin-only" onclick="openBracketModal('${t.id}')"
            ${!isAvailable?'disabled':''}>
            🏆 Manage Bracket
          </button>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── TOURNAMENT DASHBOARD ───────────────────────────────────────────
let CURRENT_TD_ID = null;

function openTournamentDashboard(tid) {
  const t = TOURNAMENTS.find(x => x.id === tid);
  if (!t) return;
  CURRENT_TD_ID = tid;

  // Hide other pages, show dashboard
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const page = document.getElementById('page-tournament-details');
  page.classList.add('active');

  document.getElementById('td-title').innerHTML = `<span>${t.icon}</span> ${t.roman}. ${t.name}`;
  const bc = document.getElementById('td-breadcrumb');
  if (bc) {
    bc.innerHTML = `
      <span>🏠 Dashboard</span>
      <span class="breadcrumb-separator">›</span>
      <span>🏟️ Tournaments</span>
      <span class="breadcrumb-separator">›</span>
      <span class="crumb-current">${esc(t.roman)}. ${esc(t.name)}</span>
    `;
  }
  
  // Show admin manage participants button if admin
  document.getElementById('td-manage-participants-btn').style.display = AUTH.role === 'admin' ? 'block' : 'none';

  renderTournamentDashboard(tid);
  window.scrollTo(0, 0);
}

function closeTournamentDashboard() {
  CURRENT_TD_ID = null;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-tournaments').classList.add('active');
  const navBtn = document.querySelector('[data-page="tournaments"]');
  if (navBtn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    navBtn.classList.add('active');
  }
}

function renderTournamentDashboard(tid) {
  if (CURRENT_TD_ID !== tid) return;
  const t = TOURNAMENTS.find(x => x.id === tid);
  const stats = STATE.tournamentStats?.[tid] || {};
  
  // Calculate Standings
  const participants = Object.keys(stats).map(pid => {
    const p = STATE.players[pid] || { name: 'Unknown', team: '' };
    const s = stats[pid];
    return {
      id: pid, name: p.name, team: p.team,
      mp: s.matchesPlayed || 0,
      w: s.wins || 0, d: s.draws || 0, l: s.losses || 0,
      gf: s.goalsFor || 0, ga: s.goalsAgainst || 0,
      gd: s.goalDifference || 0, pts: s.points || 0
    };
  });

  // Sort: 1. Points, 2. GD, 3. GF
  participants.sort((a,b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });

  renderTournamentPodium(participants);
  renderTournamentStandings(participants);
  renderTournamentMatchHistory(tid);
  populateMatchEntryDropdowns(participants);
}

function renderTournamentPodium(standings) {
  const p1 = standings[0];
  const p2 = standings[1];
  const p3 = standings[2];

  // Gold (1st)
  document.getElementById('td-podium-1-name').textContent = p1 ? p1.name : '—';
  document.getElementById('td-podium-1-team').textContent = p1 ? (p1.team || 'Free Agent') : '—';
  document.getElementById('td-podium-1-pts').textContent = p1 ? `${p1.pts} pts` : '0 pts';

  // Silver (2nd)
  document.getElementById('td-podium-2-name').textContent = p2 ? p2.name : '—';
  document.getElementById('td-podium-2-team').textContent = p2 ? (p2.team || 'Free Agent') : '—';
  document.getElementById('td-podium-2-pts').textContent = p2 ? `${p2.pts} pts` : '0 pts';

  // Bronze (3rd)
  document.getElementById('td-podium-3-name').textContent = p3 ? p3.name : '—';
  document.getElementById('td-podium-3-team').textContent = p3 ? (p3.team || 'Free Agent') : '—';
  document.getElementById('td-podium-3-pts').textContent = p3 ? `${p3.pts} pts` : '0 pts';
}

function renderTournamentStandings(standings) {
  const tbody = document.getElementById('td-standings-body');
  if (!standings.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state" style="padding:40px 0;"><div class="empty-icon">📊</div><div class="empty-title">No participants added yet</div></td></tr>`;
    return;
  }

  tbody.innerHTML = standings.map((p, i) => {
    const rankClass = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-other';
    const playerObj = STATE.players[p.id] || { name: p.name, team: p.team, teamType: 'club', logo: '' };
    const nameCell = renderPlayerNameWithLogo(playerObj);
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${i+1}</span></td>
      <td class="player-name-cell">${nameCell}</td>
      <td style="color:var(--text-secondary);font-size:12px;">${esc(p.team || '—')}</td>
      <td>${p.mp}</td>
      <td>${p.w}</td>
      <td>${p.d}</td>
      <td>${p.l}</td>
      <td>${p.gf}</td>
      <td>${p.ga}</td>
      <td style="color:${p.gd > 0 ? '#4caf50' : p.gd < 0 ? '#f44336' : 'inherit'}">${p.gd > 0 ? '+'+p.gd : p.gd}</td>
      <td class="points-cell">${p.pts}</td>
    </tr>`;
  }).join('');
}

function renderTournamentMatchHistory(tid) {
  const container = document.getElementById('td-match-history');
  const matches = STATE.matches?.[tid];
  
  if (!matches || !Object.keys(matches).length) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">No matches recorded</div>`;
    return;
  }

  // Flatten matches
  let allMatches = [];
  Object.values(matches).forEach(roundObj => {
    Object.values(roundObj).forEach(m => {
      if (m.p1 && m.p2 && m.score1 !== null && m.score2 !== null && !m.isBye) {
        allMatches.push(m);
      }
    });
  });

  if (!allMatches.length) {
    container.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-secondary);font-size:13px;">Not played yet</div>`;
    return;
  }

  // Sort: newest first (assuming higher match ID/index is newer if no timestamp exists)
  // We'll reverse them to show newest on top approximately.
  allMatches.reverse();

  container.innerHTML = allMatches.map(m => {
    const p1Obj = STATE.players[m.p1] || null;
    const p2Obj = STATE.players[m.p2] || null;
    const p1Name = p1Obj?.name || 'Unknown';
    const p2Name = p2Obj?.name || 'Unknown';
    const p1Label = renderPlayerNameWithLogo(p1Obj);
    const p2Label = renderPlayerNameWithLogo(p2Obj);
    return `
      <div class="mh-card">
        <div class="mh-header">
          <span>${esc(m.stage || 'Match')}</span>
          <span>${m.winner ? 'FINAL' : 'PENDING'}</span>
        </div>
        <div class="mh-body">
          <div class="mh-player ${m.winner === m.p1 ? 'winner' : m.winner ? 'loser' : ''}">${p1Label}</div>
          <div class="mh-score-box">
            <span class="mh-score ${m.winner === m.p1 ? 'winner' : 'loser'}">${m.score1}</span>
            <span style="color:var(--text-secondary);font-size:12px;display:flex;align-items:center;">-</span>
            <span class="mh-score ${m.winner === m.p2 ? 'winner' : 'loser'}">${m.score2}</span>
          </div>
          <div class="mh-player ${m.winner === m.p2 ? 'winner' : m.winner ? 'loser' : ''}" style="text-align:right;">${p2Label}</div>
        </div>
      </div>
    `;
  }).join('');
}

function populateMatchEntryDropdowns(standings) {
  const p1Sel = document.getElementById('td-match-p1');
  const p2Sel = document.getElementById('td-match-p2');
  if(!p1Sel || !p2Sel) return;
  
  const options = `<option value="">— Select Player —</option>` + 
    standings.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  
  // Save current values to restore if possible
  const prevP1 = p1Sel.value;
  const prevP2 = p2Sel.value;
  
  p1Sel.innerHTML = options;
  p2Sel.innerHTML = options;
  
  if(prevP1) p1Sel.value = prevP1;
  if(prevP2) p2Sel.value = prevP2;
}

// ─── MANAGE PARTICIPANTS ────────────────────────────────────────────
function openParticipantsModal() {
  if (!CURRENT_TD_ID) return;
  const t = TOURNAMENTS.find(x => x.id === CURRENT_TD_ID);
  
  let eligiblePlayers = getPlayersArray();
  let infoMsg = '';

  if (t.special === 'finalissima') {
    const { copaWinner, eurosWinner } = getFinalissimaPlayers();
    if (!copaWinner || !eurosWinner) {
      document.getElementById('participants-info-msg').innerHTML = `
        <div style="background:rgba(244,67,54,0.1);border:1px solid rgba(244,67,54,0.3);border-radius:8px;padding:12px;font-size:13px;color:#ef9a9a;">
          ⚠️ Finalissima Locked. Complete Copa America and Euros first.
        </div>`;
      eligiblePlayers = [];
    } else {
      eligiblePlayers = [copaWinner, eurosWinner].map(id => STATE.players[id]).filter(Boolean);
      infoMsg = `⚡ Finalissima: Copa Winner vs Euros Winner`;
    }
  } else if (t.special === 'top8') {
    const top8 = getTop8Ids();
    eligiblePlayers = top8.map(id => STATE.players[id]).filter(Boolean);
    infoMsg = `🌎 Intercontinental Cup: Top 8 from Ballandor Ranking`;
  } else if (t.special === 'others') {
    const top8 = getTop8Ids();
    eligiblePlayers = eligiblePlayers.filter(p => !top8.includes(p.id));
    infoMsg = `🎽 FA Cup: Players outside Top 8`;
  } else {
    infoMsg = `Select players participating in ${t.name}`;
  }

  if (infoMsg) {
    document.getElementById('participants-info-msg').innerHTML = `
      <div style="background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.2);border-radius:8px;padding:12px;font-size:13px;color:var(--gold);">
        ℹ️ ${infoMsg}
      </div>`;
  }

  const stats = STATE.tournamentStats?.[CURRENT_TD_ID] || {};
  const currentParticipants = new Set(Object.keys(stats));

  document.getElementById('participants-checklist').innerHTML = eligiblePlayers.map(p => `
    <label>
      <input type="checkbox" class="participant-cb" value="${p.id}" ${currentParticipants.has(p.id) ? 'checked' : ''} />
      <span>${esc(p.name)} <span style="font-size:11px;color:var(--text-secondary);">- ${esc(p.team)}</span></span>
    </label>
  `).join('');

  updateParticipantsCount();
  document.querySelectorAll('.participant-cb').forEach(cb => {
    cb.addEventListener('change', updateParticipantsCount);
  });

  openModal('participants-modal');
}

function updateParticipantsCount() {
  const count = document.querySelectorAll('.participant-cb:checked').length;
  document.getElementById('participants-count-lbl').textContent = `${count} selected`;
}

async function saveParticipants() {
  if (!CURRENT_TD_ID) return;
  const selectedIds = Array.from(document.querySelectorAll('.participant-cb:checked')).map(cb => cb.value);
  
  if (!STATE.tournamentStats) STATE.tournamentStats = {};
  if (!STATE.tournamentStats[CURRENT_TD_ID]) STATE.tournamentStats[CURRENT_TD_ID] = {};
  
  // Add new participants with blank stats if they don't exist
  selectedIds.forEach(pid => {
    if (!STATE.tournamentStats[CURRENT_TD_ID][pid]) {
      STATE.tournamentStats[CURRENT_TD_ID][pid] = {
        matchesPlayed: 0, wins: 0, draws: 0, losses: 0,
        goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
      };
    }
  });

  // Optional: Remove players who were unchecked, or keep them for history. Let's remove them to keep it clean.
  const selectedSet = new Set(selectedIds);
  Object.keys(STATE.tournamentStats[CURRENT_TD_ID]).forEach(pid => {
    if (!selectedSet.has(pid)) {
      delete STATE.tournamentStats[CURRENT_TD_ID][pid];
    }
  });

  await saveToFirebase(`ballandor/tournamentStats/${CURRENT_TD_ID}`, STATE.tournamentStats[CURRENT_TD_ID]);
  
  closeModal('participants-modal');
  showNotif('Participants saved!', 'success');
  renderTournamentDashboard(CURRENT_TD_ID);
}

// ─── ENGINE LOGIC ───────────────────────────────────────────────────
function updateTournamentStats(tournamentId) {
  if (!STATE.tournamentStats || !STATE.tournamentStats[tournamentId]) return;
  const stats = STATE.tournamentStats[tournamentId];
  const matches = STATE.matches?.[tournamentId] || {};

  // Reset all stats first
  Object.keys(stats).forEach(pid => {
    stats[pid] = {
      matchesPlayed: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0
    };
  });

  // Re-calculate from matches
  Object.values(matches).forEach(roundObj => {
    Object.values(roundObj).forEach(m => {
      if (m.isBye || m.score1 === null || m.score2 === null || !m.p1 || !m.p2) return;
      
      const p1Stat = stats[m.p1];
      const p2Stat = stats[m.p2];
      
      if (p1Stat) processPlayerMatchStats(p1Stat, m.score1, m.score2);
      if (p2Stat) processPlayerMatchStats(p2Stat, m.score2, m.score1);
    });
  });

  // Save to Firebase (async but we don't necessarily need to block)
  saveToFirebase(`ballandor/tournamentStats/${tournamentId}`, stats);
}

function processPlayerMatchStats(pStat, goalsFor, goalsAgainst) {
  pStat.matchesPlayed++;
  pStat.goalsFor += goalsFor;
  pStat.goalsAgainst += goalsAgainst;
  pStat.goalDifference += (goalsFor - goalsAgainst);
  
  if (goalsFor > goalsAgainst) {
    pStat.wins++;
    pStat.points += 3;
  } else if (goalsFor === goalsAgainst) {
    pStat.draws++;
    pStat.points += 1;
  } else {
    pStat.losses++;
  }
}

async function submitFreeformMatch() {
  if (!CURRENT_TD_ID) return;
  const stage = document.getElementById('td-match-stage').value;
  const p1 = document.getElementById('td-match-p1').value;
  const p2 = document.getElementById('td-match-p2').value;
  const sc1 = parseInt(document.getElementById('td-match-sc1').value);
  const sc2 = parseInt(document.getElementById('td-match-sc2').value);

  if (!p1 || !p2) return showNotif('Select both players', 'error');
  if (p1 === p2) return showNotif('Cannot play against oneself', 'error');
  if (isNaN(sc1) || isNaN(sc2)) return showNotif('Enter valid scores', 'error');

  const winner = sc1 > sc2 ? p1 : sc2 > sc1 ? p2 : 'draw';
  
  // Store freeform matches under a special 'group' node to avoid clashing with the bracket numerical rounds
  const roundIndex = 'group_stages'; 
  const matchId = 'm_' + Date.now();
  
  const matchData = {
    id: matchId, round: roundIndex, stage: stage, index: Date.now(),
    p1, p2, score1: sc1, score2: sc2, winner: winner === 'draw' ? null : winner, isBye: false
  };

  await saveMatch(CURRENT_TD_ID, roundIndex, matchId, matchData);
  
  // Update stats
  updateTournamentStats(CURRENT_TD_ID);
  
  showNotif(' Match recorded!', 'success');
  
  // clear inputs
  document.getElementById('td-match-p1').value = '';
  document.getElementById('td-match-p2').value = '';
  document.getElementById('td-match-sc1').value = '';
  document.getElementById('td-match-sc2').value = '';
  
  renderTournamentDashboard(CURRENT_TD_ID);
}

function renderSession() {
  ['ba','bd'].forEach(type => {
    const containerId = `${type}-season-slots`;
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = [1,2,3].map(pos => {
      const pts = SESSION_PTS[pos];
      const label = pos===1?'🥇 1st':pos===2?'🥈 2nd':'🥉 3rd';
      const curVal = STATE.session?.[type]?.[pos] || '';
      return `<div class="award-slot">
        <span class="award-pos ${pos===1?'medal-1':pos===2?'medal-2':'medal-3'}">${label}</span>
        <select class="form-select" id="session-${type}-${pos}" style="font-size:13px;">
          <option value="">— None —</option>
          ${getPlayersArray().map(p => `<option value="${p.id}"${p.id===curVal?' selected':''}>${esc(p.name)}</option>`).join('')}
        </select>
        <span class="award-pts-val">${pts}</span>
      </div>`;
    }).join('');
  });

  // Overview table
  const body = document.getElementById('session-overview-body');
  const ranked = getPlayersArray().map(p => ({
    ...p,
    ba: computeSessionPointsForType(p.id,'ba'),
    bd: computeSessionPointsForType(p.id,'bd'),
    total: computeSessionPoints(p.id)
  })).sort((a,b) => b.total - a.total);

  body.innerHTML = ranked.map((p,i) => `<tr>
    <td><span class="rank-badge ${i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-other'}">${i+1}</span></td>
    <td class="player-name-cell">${renderPlayerNameWithLogo(p)}</td>
    <td class="points-cell">${p.ba}</td>
    <td class="points-cell">${p.bd}</td>
    <td class="points-cell total">${p.total}</td>
  </tr>`).join('') || `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-secondary);">Assign session awards above</td></tr>`;
}

function computeSessionPointsForType(playerId, type) {
  let total = 0;
  const data = STATE.session?.[type] || {};
  for (const [pos,pid] of Object.entries(data)) {
    if (pid === playerId) total += SESSION_PTS[parseInt(pos)] || 0;
  }
  return total;
}

function renderVoting() {
  const voters = Object.values(STATE.voters || {});
  const grid = document.getElementById('voting-grid');
  if (!voters.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🗳️</div><div class="empty-title">No voters yet</div><div class="empty-desc">Add voters to start the voting process</div></div>`;
    return;
  }

  grid.innerHTML = voters.map(voter => {
    const hasVoted = Object.keys(voter.votes || {}).filter(k => voter.votes[k]).length > 0;
    const rankLabels = ['🥇','🥈','🥉','4th','5th','6th','7th'];
    const rankPts = [200,170,150,120,100,90,80];

    // Admins and the voter themselves get the editable version
    const isOwnBallot = AUTH.role === 'admin' || AUTH.userId === voter.id;

    let slotsHtml;
    if (isOwnBallot) {
      slotsHtml = [1,2,3,4,5,6,7].map(rank => {
        const pts = VOTING_PTS[rank];
        const rankClass = rank<=3 ? `vote-rank-${rank}` : 'vote-rank-other';
        const curVal = voter.votes?.[rank] || '';
        const rankLabel = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}th`;
        return `<div class="vote-slot">
          <span class="vote-rank-label ${rankClass}">${rankLabel}</span>
          <select class="vote-select" data-voter="${voter.id}" data-rank="${rank}" onchange="updateVote('${voter.id}',${rank},this.value)">
            <option value="">— None —</option>
            ${getPlayersArray()
              .filter(p => p.id !== voter.id)
              .map(p => `<option value="${p.id}"${p.id===curVal?' selected':''}>${esc(p.name)}</option>`)
              .join('')}
          </select>
          <span class="vote-pts">${pts} pts</span>
        </div>`;
      }).join('');
    } else {
      // Read-only: show ranks with player names, or "—" if not voted
      slotsHtml = `<div class="vote-ballot-readonly">` + [1,2,3,4,5,6,7].map(rank => {
        const pickedId = voter.votes?.[rank];
        const pickedName = pickedId ? (STATE.players[pickedId]?.name || '?') : null;
        const pts = VOTING_PTS[rank];
        const rankLabel = rankLabels[rank-1];
        const rankCls = rank<=3 ? `vote-rank-${rank}` : 'vote-rank-other';
        if (!pickedName) return ''; // hide empty slots in readonly view
        return `<div class="vote-ballot-row">
          <span class="vote-rank-label ${rankCls}" style="font-size:13px;">${rankLabel}</span>
          <span class="vote-ballot-player">${esc(pickedName)}</span>
          <span class="vote-pts">${pts}</span>
        </div>`;
      }).filter(Boolean).join('') + (hasVoted ? '' : `<div style="padding:14px 0;text-align:center;font-size:12px;color:var(--text-secondary);">No votes cast yet</div>`) + `</div>`;
    }

    const voterPlayer = STATE.players[voter.id] || { name: voter.name, teamType: 'club', logo: '' };
    const voterLogo = getPlayerLogoImg(voterPlayer, 'tiny');
    return `<div class="voter-card">
      <div class="voter-name">
        <span class="player-avatar" style="width:32px;height:32px;font-size:12px;">${voterLogo || esc(voter.name.charAt(0))}</span>
        ${esc(voter.name)}
        <span class="voter-status-badge ${hasVoted?'voted-badge':'pending-badge'}">${hasVoted?'✅ Voted':'⏳ Pending'}</span>
        ${AUTH.role === 'admin' ? `<button class="btn btn-danger btn-sm" style="margin-left:auto;padding:4px 8px;font-size:11px;" onclick="removeVoter('${voter.id}')">✕</button>` : ''}
      </div>
      <div class="vote-slots">${slotsHtml}</div>
    </div>`;
  }).join('');
}

// ─── TOURNAMENT MODAL ────────────────────────────────────────────────
function openTournamentModal(tid) {
  const t = TOURNAMENTS.find(x => x.id === tid);
  if (!t) return;
  const existing = (STATE.results || {})[tid] || {};
  const players = getPlayersArray();

  document.getElementById('t-modal-title').textContent = `${t.icon} ${t.roman}. ${t.name} — Results`;

  let eligiblePlayers = players;
  let infoMsg = '';

  if (t.special === 'finalissima') {
    const { copaWinner, eurosWinner } = getFinalissimaPlayers();
    if (!copaWinner || !eurosWinner) {
      document.getElementById('t-modal-body').innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-secondary);">
          <div style="font-size:48px;margin-bottom:12px;">⚠️</div>
          <div style="font-family:'Cinzel',serif;font-size:18px;color:var(--text-primary);margin-bottom:8px;">Finalissima Locked</div>
          <div>Complete <strong>Copa America</strong> and <strong>Euros</strong> first.<br>The Finalissima is played between their winners.</div>
        </div>`;
      openModal('tournament-modal');
      return;
    }
    eligiblePlayers = [copaWinner, eurosWinner].map(id => STATE.players[id]).filter(Boolean);
    infoMsg = `<div style="background:rgba(255,204,2,0.1);border:1px solid rgba(255,204,2,0.3);border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:var(--gold);">
      ⚡ Finalissima is played between: <strong>${esc(STATE.players[copaWinner]?.name)}</strong> (Copa America winner) vs <strong>${esc(STATE.players[eurosWinner]?.name)}</strong> (Euros winner)
    </div>`;
  } else if (t.special === 'top8') {
    const top8 = getTop8Ids();
    eligiblePlayers = top8.map(id => STATE.players[id]).filter(Boolean);
    infoMsg = `<div style="background:rgba(61,158,61,0.1);border:1px solid rgba(61,158,61,0.3);border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#6fcf6f;">
      🌎 Intercontinental Cup — Top 8 players: ${eligiblePlayers.map(p=>esc(p.name)).join(', ')}
    </div>`;
  } else if (t.special === 'others') {
    const top8 = getTop8Ids();
    eligiblePlayers = players.filter(p => !top8.includes(p.id));
    infoMsg = `<div style="background:rgba(129,199,132,0.1);border:1px solid rgba(129,199,132,0.2);border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px;color:#81c784;">
      🎽 FA Cup — Players outside Top 8: ${eligiblePlayers.map(p=>esc(p.name)).join(', ')}
    </div>`;
  }

  const maxSlots = Math.min(t.slots, eligiblePlayers.length);
  const posLabels = { 1: '🥇 1st', 2: '🥈 2nd', 3: '🥉 3rd', 4: '4th', 5: '5th' };
  const medalClass = { 1: 'medal-1', 2: 'medal-2', 3: 'medal-3', 4: '', 5: '' };

  const posSlots = Array.from({length: maxSlots}, (_, i) => i+1).map(pos => {
    const pts = t.pts[pos] || 0;
    const cur = existing.positions?.[pos] || '';
    return `<div class="position-slot pos-${pos}" style="grid-template-columns:80px 1fr 80px;">
      <span class="pos-label ${medalClass[pos] || ''}">${posLabels[pos] || `${pos}th`}</span>
      <select class="form-select" id="pos-${tid}-${pos}">
        <option value="">— Select player —</option>
        ${eligiblePlayers.map(p => `<option value="${p.id}"${p.id===cur?' selected':''}>${esc(p.name)}</option>`).join('')}
      </select>
      <span class="pts-preview">+${pts} pts</span>
    </div>`;
  }).join('');

  // BA/BD (if tournament supports it)
  let babd = '';
  if (t.baPoints > 0) {
    const baVals = existing.ba || [null, null, null];
    const bdVals = existing.bd || [null, null, null];
    babd = `<div class="ba-bd-row">
      <div class="ba-bd-card">
        <div class="ba-bd-title">🥾 Best Attack</div>
        ${[0,1,2].map(i => `
          <div class="award-slot">
            <span class="award-pos ${i===0?'medal-1':i===1?'medal-2':'medal-3'}">${['🥇','🥈','🥉'][i]}</span>
            <select class="form-select" id="ba-${tid}-${i}" style="font-size:13px;">
              <option value="">— None —</option>
              ${eligiblePlayers.map(p => `<option value="${p.id}"${p.id===baVals[i]?' selected':''}>${esc(p.name)}</option>`).join('')}
            </select>
            <span class="award-pts-val">${i===0?t.baPoints:i===1?Math.round(t.baPoints*0.75):Math.round(t.baPoints*0.5)}</span>
          </div>
        `).join('')}
      </div>
      <div class="ba-bd-card">
        <div class="ba-bd-title">🛡️ Best Defence</div>
        ${[0,1,2].map(i => `
          <div class="award-slot">
            <span class="award-pos ${i===0?'medal-1':i===1?'medal-2':'medal-3'}">${['🥇','🥈','🥉'][i]}</span>
            <select class="form-select" id="bd-${tid}-${i}" style="font-size:13px;">
              <option value="">— None —</option>
              ${eligiblePlayers.map(p => `<option value="${p.id}"${p.id===bdVals[i]?' selected':''}>${esc(p.name)}</option>`).join('')}
            </select>
            <span class="award-pts-val">${i===0?t.bdPoints:i===1?Math.round(t.bdPoints*0.75):Math.round(t.bdPoints*0.5)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  document.getElementById('t-modal-body').innerHTML = `
    ${infoMsg}
    <div class="form-group">
      <div class="form-label">🏆 Finishing Positions</div>
      <div class="position-slots">${posSlots}</div>
    </div>
    ${babd}
    <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="saveTournamentResult('${tid}',${maxSlots},${t.baPoints > 0})">💾 Save Result</button>
      ${existing.positions ? `<button class="btn btn-danger" onclick="clearTournamentResult('${tid}')">🗑️ Clear Result</button>` : ''}
      <button class="btn btn-secondary" data-close="tournament-modal">Cancel</button>
    </div>
  `;

  openModal('tournament-modal');
}

function saveTournamentResult(tid, slots, hasBABD) {
  const positions = {};
  let valid = true;
  const used = new Set();

  for (let pos = 1; pos <= slots; pos++) {
    const el = document.getElementById(`pos-${tid}-${pos}`);
    if (!el) continue;
    const val = el.value;
    if (!val) continue; // positions are optional
    if (used.has(val)) {
      showNotif('A player cannot hold two positions!', 'error');
      return;
    }
    used.add(val);
    positions[pos] = val;
  }

  if (!positions[1]) {
    showNotif('At least the winner (1st place) must be assigned', 'error');
    return;
  }

  const result = { positions };

  if (hasBABD) {
    const ba = [0,1,2].map(i => document.getElementById(`ba-${tid}-${i}`)?.value || null).filter(Boolean);
    const bd = [0,1,2].map(i => document.getElementById(`bd-${tid}-${i}`)?.value || null).filter(Boolean);
    if (ba.length) result.ba = ba;
    if (bd.length) result.bd = bd;
  }

  if (!STATE.results) STATE.results = {};
  STATE.results[tid] = result;
  saveToFirebase('ballandor/results', STATE.results);
  closeModal('tournament-modal');
  showNotif('✅ Tournament result saved!', 'success');
  renderAll();
}

function clearTournamentResult(tid) {
  if (!confirm('Clear this tournament result?')) return;
  delete STATE.results[tid];
  saveToFirebase('ballandor/results', STATE.results);
  closeModal('tournament-modal');
  showNotif('Result cleared', 'info');
  renderAll();
}

// ─── VOTING ──────────────────────────────────────────────────────────
function addVoter(playerId) {
  if (!playerId) return showNotif('Select a player', 'error');
  if (STATE.voters?.[playerId]) return showNotif('Already added as voter', 'error');
  if (!STATE.voters) STATE.voters = {};
  STATE.voters[playerId] = {
    id: playerId,
    name: STATE.players[playerId]?.name || 'Unknown',
    votes: {},
    submitted: false
  };
  saveToFirebase('ballandor/voters', STATE.voters);
  closeModal('add-voter-modal');
  showNotif('✅ Voter added!', 'success');
  renderVoting();
}

function removeVoter(id) {
  delete STATE.voters[id];
  saveToFirebase('ballandor/voters', STATE.voters);
  renderVoting();
}

function updateVote(voterId, rank, playerId) {
  // Security: players can only edit their own ballot
  if (AUTH.role === 'viewer') return;
  if (AUTH.role === 'player' && AUTH.userId !== voterId) {
    showNotif('You can only edit your own votes', 'error');
    setTimeout(() => {
      const sel = document.querySelector(`[data-voter="${voterId}"][data-rank="${rank}"]`);
      if (sel) sel.value = '';
    }, 50);
    return;
  }
  if (!STATE.voters[voterId]) return;
  if (!STATE.voters[voterId].votes) STATE.voters[voterId].votes = {};

  // Ensure no duplicate picks
  const currentVotes = STATE.voters[voterId].votes;
  for (const [r, pid] of Object.entries(currentVotes)) {
    if (pid === playerId && parseInt(r) !== rank && playerId) {
      showNotif(`${STATE.players[playerId]?.name} already picked at rank ${r}`, 'error');
      // Reset the select
      setTimeout(() => {
        const sel = document.querySelector(`[data-voter="${voterId}"][data-rank="${rank}"]`);
        if (sel) sel.value = '';
      }, 50);
      return;
    }
  }

  // Prevent self-voting
  if (playerId && voterId === playerId) {
    showNotif('Players cannot vote for themselves', 'error');
    setTimeout(() => {
      const sel = document.querySelector(`[data-voter="${voterId}"][data-rank="${rank}"]`);
      if (sel) sel.value = '';
    }, 50);
    return;
  }

  STATE.voters[voterId].votes[rank] = playerId || null;
  saveToFirebase(`ballandor/voters/${voterId}/votes`, STATE.voters[voterId].votes);
}

function tallyVotes() {
  const tally = {};
  getPlayersArray().forEach(p => { tally[p.id] = 0; });

  for (const voter of Object.values(STATE.voters || {})) {
    for (const [rank, pid] of Object.entries(voter.votes || {})) {
      if (pid && tally[pid] !== undefined) {
        tally[pid] += VOTING_PTS[parseInt(rank)] || 0;
      }
    }
  }

  STATE.votingResults = tally;
  saveToFirebase('ballandor/votingResults', STATE.votingResults);

  // Show tally preview
  const sorted = Object.entries(tally)
    .map(([id, pts]) => ({ name: STATE.players[id]?.name, pts }))
    .filter(x => x.pts > 0)
    .sort((a,b) => b.pts - a.pts);

  const preview = document.getElementById('vote-tally-preview');
  if (!sorted.length) {
    preview.innerHTML = '<span style="color:var(--text-secondary)">No votes cast yet</span>';
  } else {
    preview.innerHTML = sorted.slice(0, 10).map((x, i) =>
      `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="color:${i<3?'var(--gold)':'var(--text-primary)'};">${i+1}. ${esc(x.name)}</span>
        <span style="font-family:'Cinzel',serif;color:var(--gold);">${x.pts}</span>
      </div>`
    ).join('');
  }
  showNotif('✅ Votes tallied!', 'success');
  renderAll();
}

function clearVotes() {
  if (!confirm('Clear ALL votes?')) return;
  STATE.voters = {};
  STATE.votingResults = {};
  saveToFirebase('ballandor/voters', {});
  saveToFirebase('ballandor/votingResults', {});
  renderVoting();
  showNotif('Votes cleared', 'info');
}

// ─── FINALS ──────────────────────────────────────────────────────────
function calculateFinals() {
  const ranked = getRankedPlayers();
  if (!ranked.length) return showNotif('No players/data to calculate', 'error');

  const body = document.getElementById('finals-body');
  body.innerHTML = ranked.map((p, i) => {
    const rankClass = i===0?'rank-1':i===1?'rank-2':i===2?'rank-3':'rank-other';
    const nameCell = renderPlayerNameWithLogo(p);
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${i+1}</span></td>
      <td class="player-name-cell">${nameCell}</td>
      <td class="points-cell">${p.tournamentPts}</td>
      <td class="points-cell">${p.sessionPts}</td>
      <td class="points-cell">${p.votingPts}</td>
      <td class="points-cell total">${p.total}</td>
    </tr>`;
  }).join('');

  // Winner
  const winner = ranked[0];
  if (winner) {
    document.getElementById('winner-area').style.display = 'block';
    document.getElementById('winner-name-text').textContent = winner.name;
    document.getElementById('winner-pts-text').textContent = `${winner.total.toLocaleString()} points`;
    launchConfetti();
  }

  // Breakdown table
  renderBreakdownTable(ranked);
  showNotif('🏆 Finals calculated!', 'success');
}

function renderBreakdownTable(ranked) {
  const head = document.getElementById('breakdown-head');
  const body = document.getElementById('breakdown-body');

  const headerCols = ['Player', ...TOURNAMENTS.map(t => `${t.roman}. ${t.icon}`), 'BA Ssn', 'BD Ssn', 'Voting', 'TOTAL'];
  head.innerHTML = `<tr>${headerCols.map(h => `<th>${h}</th>`).join('')}</tr>`;

  body.innerHTML = ranked.map(p => {
    const tCols = TOURNAMENTS.map(t => {
      const result = STATE.results?.[t.id];
      if (!result) return '<td class="cell-0">—</td>';
      let pts = 0;
      for (const [pos, pid] of Object.entries(result.positions || {})) {
        if (pid === p.id) pts += t.pts[parseInt(pos)] || 0;
      }
      if (result.ba?.[0] === p.id) pts += t.baPoints;
      else if (result.ba?.[1] === p.id) pts += Math.round(t.baPoints*0.75);
      else if (result.ba?.[2] === p.id) pts += Math.round(t.baPoints*0.5);
      if (result.bd?.[0] === p.id) pts += t.bdPoints;
      else if (result.bd?.[1] === p.id) pts += Math.round(t.bdPoints*0.75);
      else if (result.bd?.[2] === p.id) pts += Math.round(t.bdPoints*0.5);
      return `<td class="${pts?'cell-pts':'cell-0'}">${pts||'—'}</td>`;
    }).join('');

    const nameCell = renderPlayerNameWithLogo(p);
    return `<tr>
      <td>${nameCell}</td>
      ${tCols}
      <td class="cell-pts">${computeSessionPointsForType(p.id,'ba')||'—'}</td>
      <td class="cell-pts">${computeSessionPointsForType(p.id,'bd')||'—'}</td>
      <td class="cell-pts">${p.votingPts||'—'}</td>
      <td class="breakdown-highlight">${p.total}</td>
    </tr>`;
  }).join('');
}

// ─── CONFETTI ─────────────────────────────────────────────────────────
function launchConfetti() {
  const colors = ['#d4af37', '#f0cc55', '#ffffff', '#4caf50', '#ff9800'];
  for (let i = 0; i < 80; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText = `
        left: ${Math.random()*100}vw;
        width: ${Math.random()*10+5}px;
        height: ${Math.random()*6+4}px;
        background: ${colors[Math.floor(Math.random()*colors.length)]};
        animation-duration: ${Math.random()*2+1.5}s;
        animation-delay: ${Math.random()*0.5}s;
        transform: rotate(${Math.random()*360}deg);
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }, i * 30);
  }
}

// ─── UNDO MANAGER (ADMIN ONLY) ────────────────────────────────────────
let CURRENT_UNDO = null;
let CURRENT_UNDO_TIMER = null;

function clearUndoTimer() {
  if (CURRENT_UNDO_TIMER) {
    clearTimeout(CURRENT_UNDO_TIMER);
    CURRENT_UNDO_TIMER = null;
  }
}

function createUndoAction(restoreFn, durationMs = 15000) {
  if (typeof restoreFn !== 'function') return;
  clearUndoTimer();
  CURRENT_UNDO = restoreFn;
  CURRENT_UNDO_TIMER = setTimeout(() => {
    CURRENT_UNDO = null;
    CURRENT_UNDO_TIMER = null;
  }, durationMs);
}

async function performUndo() {
  if (!CURRENT_UNDO || AUTH.role !== 'admin') return;
  const fn = CURRENT_UNDO;
  CURRENT_UNDO = null;
  clearUndoTimer();
  try {
    await fn();
  } catch (e) {
    showNotif('Undo failed: ' + (e?.message || e), 'error');
  }
}

// ─── MODALS ───────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────
function showNotif(msg, type = 'info', options) {
  const container = document.getElementById('notif-container');
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.textContent = msg;

  // Optional inline Undo button for admins
  const wantsUndo = options && options.showUndo && AUTH.role === 'admin' && CURRENT_UNDO;
  if (wantsUndo) {
    el.classList.add('notif-with-undo');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'notif-undo-btn';
    btn.textContent = options.undoLabel || 'Undo';
    btn.addEventListener('click', () => {
      // Trigger undo and remove this notification
      performUndo();
      el.style.animation = 'notifOut 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    });
    el.appendChild(btn);
  }

  container.appendChild(el);
  const ttl = wantsUndo ? 12000 : 3000;
  setTimeout(() => {
    el.style.animation = 'notifOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, ttl);
}

// ─── UTILITIES ───────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Mobile hamburger nav toggle
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mainNav = document.getElementById('main-nav');
  const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('mobile-open');
      hamburgerBtn.classList.toggle('open', isOpen);
      if (mobileNavOverlay) mobileNavOverlay.classList.toggle('visible', isOpen);
    });
  }
  if (mobileNavOverlay) {
    mobileNavOverlay.addEventListener('click', () => {
      mainNav.classList.remove('mobile-open');
      if (hamburgerBtn) hamburgerBtn.classList.remove('open');
      mobileNavOverlay.classList.remove('visible');
    });
  }
  // Close nav on nav button click (mobile)
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      mainNav.classList.remove('mobile-open');
      if (hamburgerBtn) hamburgerBtn.classList.remove('open');
      if (mobileNavOverlay) mobileNavOverlay.classList.remove('visible');
    });
  });

  // Viewer (public) login button
  const viewerBtn = document.getElementById('viewer-access-btn');
  if (viewerBtn) viewerBtn.addEventListener('click', doViewerLogin);

  // Page navigation
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('page-' + btn.dataset.page)?.classList.add('active');

      // Refresh relevant page
      if (btn.dataset.page === 'session') renderSession();
      if (btn.dataset.page === 'voting') renderVoting();
    });
  });

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.card') || btn.parentElement.parentElement;
      parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
    });
  });

  // Close modals
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  // Add player
  document.getElementById('add-player-btn').addEventListener('click', () => {
    if (AUTH.role !== 'admin') return;
    document.getElementById('new-player-name').value = '';
    document.getElementById('new-player-team').value = '';
    openModal('add-player-modal');
    setTimeout(() => document.getElementById('new-player-name').focus(), 200);
  });
  document.getElementById('confirm-add-player').addEventListener('click', () => {
    addPlayer(document.getElementById('new-player-name').value, document.getElementById('new-player-team').value);
    if (!Object.values(STATE.players).some(p => p.name.toLowerCase() === document.getElementById('new-player-name').value.trim().toLowerCase())) return;
    closeModal('add-player-modal');
    renderAll();
  });
  document.getElementById('new-player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirm-add-player').click();
  });

  // Bulk add
  document.getElementById('bulk-add-btn').addEventListener('click', () => {
    if (AUTH.role !== 'admin') return;
    const lines = document.getElementById('bulk-textarea').value.split('\n');
    let added = 0;
    lines.forEach(line => {
      let name = line.trim();
      let team = "";
      if (!name) return;
      if (name.includes('-')) {
        const parts = name.split('-');
        name = parts[0].trim();
        team = parts.slice(1).join('-').trim();
      }
      const before = Object.keys(STATE.players).length;
      addPlayer(name, team);
      if (Object.keys(STATE.players).length > before) added++;
    });
    document.getElementById('bulk-textarea').value = '';
    if (added) { showNotif(`✅ Added ${added} player(s)!`, 'success'); renderAll(); }
  });

  // Player search
  document.getElementById('player-search').addEventListener('input', renderPlayers);

  // Add voter
  document.getElementById('add-voter-btn').addEventListener('click', () => {
    const sel = document.getElementById('voter-select');
    sel.innerHTML = '<option value="">— Select player —</option>' +
      getPlayersArray()
        .filter(p => !STATE.voters?.[p.id])
        .map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
        .join('');
    openModal('add-voter-modal');
  });
  document.getElementById('confirm-add-voter').addEventListener('click', () => {
    addVoter(document.getElementById('voter-select').value);
  });

  // Voting buttons
  document.getElementById('tally-votes-btn').addEventListener('click', tallyVotes);
  document.getElementById('clear-votes-btn').addEventListener('click', clearVotes);

  // Finals
  document.getElementById('calc-finals-btn').addEventListener('click', calculateFinals);

  // Session awards save
  document.getElementById('save-ba-season').addEventListener('click', () => {
    if (!STATE.session) STATE.session = { ba:{}, bd:{} };
    if (!STATE.session.ba) STATE.session.ba = {};
    [1,2,3].forEach(pos => {
      const val = document.getElementById(`session-ba-${pos}`)?.value || null;
      STATE.session.ba[pos] = val;
    });
    saveToFirebase('ballandor/session', STATE.session);
    showNotif('✅ Best Attack season awards saved!', 'success');
    renderSession();
  });
  document.getElementById('save-bd-season').addEventListener('click', () => {
    if (!STATE.session) STATE.session = { ba:{}, bd:{} };
    if (!STATE.session.bd) STATE.session.bd = {};
    [1,2,3].forEach(pos => {
      const val = document.getElementById(`session-bd-${pos}`)?.value || null;
      STATE.session.bd[pos] = val;
    });
    saveToFirebase('ballandor/session', STATE.session);
    showNotif('✅ Best Defence season awards saved!', 'success');
    renderSession();
  });

  // Config btn → open Admin Management modal (admins only)
  document.getElementById('config-btn').addEventListener('click', () => {
    if (AUTH.role !== 'admin') return;
    loadAdminList();
    openModal('admin-mgmt-modal');
  });

  // Logout button in header
  document.getElementById('logout-btn')?.addEventListener('click', doLogout);

  // Enter key triggers admin login
  ['login-username','login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doAdminLogin();
    });
  });
  document.getElementById('save-config-btn').addEventListener('click', async () => {
    closeModal('config-modal');
    showNotif('Using hardcoded Firebase config', 'info');
  });
  document.getElementById('test-config-btn').addEventListener('click', async () => {
    showNotif('Testing connection…', 'info');
    await initFirebase(FIREBASE_CONFIG);
  });

  // Reset
  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm('⚠️ RESET ENTIRE SEASON? This cannot be undone!')) return;
    if (!confirm('Are you absolutely sure? All data will be deleted.')) return;
    STATE.players = {}; STATE.results = {}; STATE.session = { ba:{}, bd:{} }; STATE.voters = {}; STATE.votingResults = {};
    if (window._fb) {
      const { ref, set, db } = window._fb;
      await set(ref(db, 'ballandor'), null);
    }
    localStorage.removeItem('ballandor_local');
    showNotif('Season reset!', 'info');
    renderAll();
  });

  // Keyboard shortcut: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
  });

  // Season label
  const now = new Date();
  document.getElementById('season-label').textContent = `Season ${now.getFullYear()}`;

  // Auto-connect with hardcoded Firebase config, then show login screen
  initFirebase(FIREBASE_CONFIG).then(ok => {
    if (!ok) {
      setFirebaseStatus('error', 'Offline — using local data');
      loadLocalFallback();
    }
    // Show login after a brief delay to let Firebase load initial data
    setTimeout(showLoginScreen, 400);
  });

  // Hide loading screen
  setTimeout(() => {
    document.getElementById('loading-screen').classList.add('hidden');
  }, 2000);
});

function loadLocalFallback() {
  try {
    const raw = localStorage.getItem('ballandor_local');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.players) STATE.players = data.players;
      if (data.results) STATE.results = data.results;
      if (data.session) STATE.session = data.session;
      if (data.voters) STATE.voters = data.voters;
      if (data.votingResults) STATE.votingResults = data.votingResults;
      if (data.matches) STATE.matches = data.matches;
      if (data.tournamentStats) STATE.tournamentStats = data.tournamentStats;
    }
  } catch(e) {}
}

// Auto-save to localStorage as fallback whenever state changes
setInterval(() => {
  localStorage.setItem('ballandor_local', JSON.stringify(STATE));
}, 5000);

// ─── KNOCKOUT BRACKET ENGINE ─────────────────────────────────────────

// Helpers
function computeBracketSize(n) {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

function mapMatchIndexToNextRound(matchIndex) {
  return Math.floor(matchIndex / 2);
}

function pairParticipants(list) {
  // list is array of playerIds padded with 'BYE' to reach power of 2
  // We do sequential pairing: [0] vs [1], [2] vs [3], etc.
  // For better seeding, one would interleave (e.g. 1 vs 16, 2 vs 15), but sequential is standard for random draws.
  const matches = [];
  for (let i = 0; i < list.length; i += 2) {
    matches.push({ p1: list[i], p2: list[i+1] });
  }
  return matches;
}

async function saveMatch(tournamentId, roundIndex, matchId, matchData) {
  if (!STATE.matches) STATE.matches = {};
  if (!STATE.matches[tournamentId]) STATE.matches[tournamentId] = {};
  if (!STATE.matches[tournamentId][roundIndex]) STATE.matches[tournamentId][roundIndex] = {};
  STATE.matches[tournamentId][roundIndex][matchId] = matchData;
  await saveToFirebase(`ballandor/matches/${tournamentId}/${roundIndex}/${matchId}`, matchData);
}

// ─── UNIVERSAL TOURNAMENT FORMAT: GROUPS → KNOCKOUT ───────────────────
const GROUP_ROUND_KEY = 'group_stage';
const MATCH_META_KEY = '_meta';

function groupLetter(i) {
  return String.fromCharCode('A'.charCodeAt(0) + i);
}

function getEligiblePlayersForTournament(tournamentId) {
  const tConfig = TOURNAMENTS.find(t => t.id === tournamentId);
  if (!tConfig) return [];
  let pool = getPlayersArray();

  if (tConfig.special === 'finalissima') {
    const fw = getFinalissimaPlayers();
    if (!fw.copaWinner || !fw.eurosWinner) return [];
    pool = [STATE.players[fw.copaWinner], STATE.players[fw.eurosWinner]].filter(Boolean);
  } else if (tConfig.special === 'top8') {
    const top8 = getTop8Ids();
    pool = pool.filter(p => top8.includes(p.id));
  } else if (tConfig.special === 'others') {
    const top8 = getTop8Ids();
    pool = pool.filter(p => !top8.includes(p.id));
  }
  return pool;
}

function ensureTournamentMatchesRoot(tournamentId) {
  if (!STATE.matches) STATE.matches = {};
  if (!STATE.matches[tournamentId]) STATE.matches[tournamentId] = {};
  if (!STATE.matches[tournamentId][MATCH_META_KEY]) STATE.matches[tournamentId][MATCH_META_KEY] = {};
}

function getTournamentMeta(tournamentId) {
  return STATE.matches?.[tournamentId]?.[MATCH_META_KEY] || {};
}

async function saveTournamentMeta(tournamentId, meta) {
  ensureTournamentMatchesRoot(tournamentId);
  STATE.matches[tournamentId][MATCH_META_KEY] = meta;
  await saveToFirebase(`ballandor/matches/${tournamentId}/${MATCH_META_KEY}`, meta);
}

function buildEmptyAssignments(tournamentId, groupCount) {
  const eligible = getEligiblePlayersForTournament(tournamentId);
  const assignments = {};
  eligible.forEach(p => { assignments[p.id] = null; });
  const groups = Array.from({ length: groupCount }, (_, i) => groupLetter(i));
  return { assignments, groups };
}

function randomizeGroupAssignments(tournamentId, groupCount, playersPerGroup) {
  const eligible = getEligiblePlayersForTournament(tournamentId);
  const groups = Array.from({ length: groupCount }, (_, i) => groupLetter(i));
  const shuffled = eligible.slice().sort(() => Math.random() - 0.5);
  const assignments = {};

  const capacity = groupCount * playersPerGroup;
  const usable = shuffled.slice(0, capacity);
  usable.forEach((p, idx) => {
    assignments[p.id] = groups[idx % groups.length];
  });
  // Mark the rest as null (not in groups)
  shuffled.slice(capacity).forEach(p => { assignments[p.id] = null; });
  return { assignments, groups };
}

function getPlayersByGroup(tournamentId, meta) {
  const eligible = getEligiblePlayersForTournament(tournamentId);
  const byId = new Map(eligible.map(p => [p.id, p]));
  const groupMap = {};
  (meta.groups || []).forEach(g => { groupMap[g] = []; });

  for (const [pid, grp] of Object.entries(meta.assignments || {})) {
    if (!grp) continue;
    if (!groupMap[grp]) groupMap[grp] = [];
    const p = byId.get(pid);
    if (p) groupMap[grp].push(p);
  }

  // Stable ordering by name
  Object.values(groupMap).forEach(arr => arr.sort((a,b) => a.name.localeCompare(b.name)));
  return groupMap;
}

function generateRoundRobinPairs(players) {
  const ids = players.map(p => p.id);
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
}

async function generateGroupFixtures(tournamentId) {
  const meta = getTournamentMeta(tournamentId);
  if (!meta.groupCount || !meta.playersPerGroup) {
    showNotif('Set group count and players per group first', 'error');
    return;
  }
  const groupMap = getPlayersByGroup(tournamentId, meta);
  const groups = Object.keys(groupMap);
  if (!groups.length) {
    showNotif('No groups configured', 'error');
    return;
  }
  for (const g of groups) {
    if ((groupMap[g] || []).length < 2) {
      showNotif(`Group ${g} needs at least 2 players`, 'error');
      return;
    }
  }

  ensureTournamentMatchesRoot(tournamentId);

  // Undo snapshot (matches and meta)
  const prevMatches = STATE.matches[tournamentId] ? JSON.parse(JSON.stringify(STATE.matches[tournamentId])) : {};
  createUndoAction(async () => {
    STATE.matches[tournamentId] = prevMatches;
    await saveToFirebase(`ballandor/matches/${tournamentId}`, prevMatches);
    updateTournamentStats(tournamentId);
    renderTournamentDashboard(tournamentId);
    renderBracketData(tournamentId);
    showNotif('Group fixtures reverted', 'info');
  });

  // Clear existing group stage and knockout rounds (but keep meta)
  Object.keys(STATE.matches[tournamentId]).forEach(k => {
    if (k === MATCH_META_KEY) return;
    delete STATE.matches[tournamentId][k];
  });

  STATE.matches[tournamentId][GROUP_ROUND_KEY] = {};
  let idx = 0;
  for (const g of groups.sort()) {
    const pairs = generateRoundRobinPairs(groupMap[g]);
    pairs.forEach(([p1, p2]) => {
      const matchId = `g_${g}_${idx++}`;
      STATE.matches[tournamentId][GROUP_ROUND_KEY][matchId] = {
        id: matchId,
        round: GROUP_ROUND_KEY,
        group: g,
        index: idx,
        stage: 'Group Stage',
        p1,
        p2,
        score1: null,
        score2: null,
        winner: null,
        isBye: false
      };
    });
  }

  meta.stage = 'group';
  await saveTournamentMeta(tournamentId, meta);
  await saveToFirebase(`ballandor/matches/${tournamentId}/${GROUP_ROUND_KEY}`, STATE.matches[tournamentId][GROUP_ROUND_KEY]);

  updateTournamentStats(tournamentId);
  showNotif('✅ Group fixtures generated', 'success', { showUndo: true, undoLabel: 'Undo fixtures' });
  renderBracketData(tournamentId);
}

function groupMatchCompleted(m) {
  return m && m.p1 && m.p2 && m.score1 !== null && m.score2 !== null;
}

function computeGroupStandings(tournamentId, groupKey, meta) {
  const groupMap = getPlayersByGroup(tournamentId, meta);
  const groupPlayers = groupMap[groupKey] || [];
  const stats = {};
  groupPlayers.forEach(p => {
    stats[p.id] = {
      id: p.id,
      name: p.name,
      team: p.team,
      mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
      _seed: groupPlayers.findIndex(x => x.id === p.id)
    };
  });

  const matches = STATE.matches?.[tournamentId]?.[GROUP_ROUND_KEY] || {};
  const h2h = {}; // h2h["p1|p2"] = {p1Pts, p2Pts, p1Gf, p2Gf}

  Object.values(matches).forEach(m => {
    if (m.group !== groupKey) return;
    if (!groupMatchCompleted(m)) return;
    if (!stats[m.p1] || !stats[m.p2]) return;

    const a = stats[m.p1];
    const b = stats[m.p2];
    a.mp++; b.mp++;
    a.gf += m.score1; a.ga += m.score2;
    b.gf += m.score2; b.ga += m.score1;
    a.gd = a.gf - a.ga;
    b.gd = b.gf - b.ga;

    let aPts = 0, bPts = 0;
    if (m.score1 > m.score2) { a.w++; b.l++; aPts = 3; }
    else if (m.score2 > m.score1) { b.w++; a.l++; bPts = 3; }
    else { a.d++; b.d++; aPts = 1; bPts = 1; }
    a.pts += aPts;
    b.pts += bPts;

    const key = m.p1 < m.p2 ? `${m.p1}|${m.p2}` : `${m.p2}|${m.p1}`;
    if (!h2h[key]) h2h[key] = { a: 0, b: 0, aGf: 0, bGf: 0, aId: m.p1 < m.p2 ? m.p1 : m.p2, bId: m.p1 < m.p2 ? m.p2 : m.p1 };
    const rec = h2h[key];
    if (m.p1 === rec.aId) {
      rec.a += aPts;
      rec.b += bPts;
      rec.aGf += m.score1;
      rec.bGf += m.score2;
    } else {
      // swapped
      rec.a += bPts;
      rec.b += aPts;
      rec.aGf += m.score2;
      rec.bGf += m.score1;
    }
  });

  const arr = Object.values(stats);
  arr.sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    if (y.gd !== x.gd) return y.gd - x.gd;
    if (y.gf !== x.gf) return y.gf - x.gf;

    // Head-to-head (only meaningful in two-player tie)
    const key = x.id < y.id ? `${x.id}|${y.id}` : `${y.id}|${x.id}`;
    const rec = h2h[key];
    if (rec) {
      const xIsA = rec.aId === x.id;
      const xPts = xIsA ? rec.a : rec.b;
      const yPts = xIsA ? rec.b : rec.a;
      if (xPts !== yPts) return yPts - xPts;
    }
    return x._seed - y._seed;
  });
  return arr;
}

function groupsComplete(tournamentId, meta) {
  const matches = STATE.matches?.[tournamentId]?.[GROUP_ROUND_KEY] || {};
  const groupMap = getPlayersByGroup(tournamentId, meta);
  const neededGroups = Object.keys(groupMap).filter(g => (groupMap[g] || []).length >= 2);
  if (!neededGroups.length) return false;

  // For each group, ensure every pair match exists and is completed
  for (const g of neededGroups) {
    const players = groupMap[g];
    const expectedCount = (players.length * (players.length - 1)) / 2;
    const groupMatches = Object.values(matches).filter(m => m.group === g);
    if (groupMatches.length < expectedCount) return false;
    if (!groupMatches.every(groupMatchCompleted)) return false;
  }
  return true;
}

function buildQualifiedList(tournamentId, meta) {
  const groupMap = getPlayersByGroup(tournamentId, meta);
  const groups = Object.keys(groupMap).sort();
  const qualified = [];
  for (const g of groups) {
    const standings = computeGroupStandings(tournamentId, g, meta);
    const top2 = standings.slice(0, 2);
    top2.forEach((row, idx) => {
      qualified.push({ playerId: row.id, group: g, pos: idx + 1 });
    });
  }
  return qualified;
}

function crossGroupSeedPairs(qualified) {
  // qualified items include {playerId, group, pos} where pos 1/2
  const groups = Array.from(new Set(qualified.map(q => q.group))).sort();
  const winners = groups.map(g => qualified.find(q => q.group === g && q.pos === 1)).filter(Boolean);
  const runners = groups.map(g => qualified.find(q => q.group === g && q.pos === 2)).filter(Boolean);

  // Pair i winner vs next group's runner-up (cyclic), and next group's winner vs i runner-up.
  const pairs = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const next = groups[(i + 1) % groups.length];
    const w = qualified.find(q => q.group === g && q.pos === 1);
    const rNext = qualified.find(q => q.group === next && q.pos === 2);
    const wNext = qualified.find(q => q.group === next && q.pos === 1);
    const r = qualified.find(q => q.group === g && q.pos === 2);
    if (w && rNext) pairs.push([w, rNext]);
    if (wNext && r) pairs.push([wNext, r]);
  }

  // Deduplicate pairs (cyclic construction can repeat for 2 groups)
  const seen = new Set();
  const unique = [];
  for (const [a, b] of pairs) {
    const key = a.playerId < b.playerId ? `${a.playerId}|${b.playerId}` : `${b.playerId}|${a.playerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push([a, b]);
  }
  return unique;
}

async function generateKnockoutFromGroups(tournamentId) {
  const meta = getTournamentMeta(tournamentId);
  if (!groupsComplete(tournamentId, meta)) {
    showNotif('Group stage is not complete yet', 'error');
    return;
  }
  const qualified = buildQualifiedList(tournamentId, meta);
  if (qualified.length < 2) {
    showNotif('Not enough qualified players for knockout', 'error');
    return;
  }

  // Snapshot for undo (full tournament matches)
  const prevMatches = STATE.matches[tournamentId] ? JSON.parse(JSON.stringify(STATE.matches[tournamentId])) : {};
  createUndoAction(async () => {
    STATE.matches[tournamentId] = prevMatches;
    await saveToFirebase(`ballandor/matches/${tournamentId}`, prevMatches);
    updateTournamentStats(tournamentId);
    renderTournamentDashboard(tournamentId);
    renderBracketData(tournamentId);
    showNotif('Knockout generation reverted', 'info');
  });

  const initialPairs = crossGroupSeedPairs(qualified);
  // Flatten to list, then pad with BYEs to power of 2
  const seededPlayers = [];
  initialPairs.forEach(([a, b]) => {
    seededPlayers.push(a.playerId);
    seededPlayers.push(b.playerId);
  });
  // Add any qualified not placed yet (safety)
  const placed = new Set(seededPlayers);
  qualified.forEach(q => { if (!placed.has(q.playerId)) seededPlayers.push(q.playerId); });

  const size = computeBracketSize(seededPlayers.length);
  while (seededPlayers.length < size) seededPlayers.push('BYE');

  const firstRoundMatches = pairParticipants(seededPlayers);
  const totalRounds = Math.log2(size);

  // Clear existing numeric rounds/3rd place; keep group stage and meta
  Object.keys(STATE.matches[tournamentId]).forEach(k => {
    if (k === MATCH_META_KEY || k === GROUP_ROUND_KEY) return;
    delete STATE.matches[tournamentId][k];
  });

  // Round 0
  STATE.matches[tournamentId][0] = {};
  for (let i = 0; i < firstRoundMatches.length; i++) {
    const m = firstRoundMatches[i];
    const isBye = m.p1 === 'BYE' || m.p2 === 'BYE';
    const matchId = `m_r0_${i}`;
    STATE.matches[tournamentId][0][matchId] = {
      id: matchId,
      round: 0,
      index: i,
      stage: 'Knockout',
      p1: m.p1 === 'BYE' ? null : m.p1,
      p2: m.p2 === 'BYE' ? null : m.p2,
      score1: null,
      score2: null,
      winner: isBye ? (m.p1 === 'BYE' ? m.p2 : m.p1) : null,
      isBye
    };
  }

  // Future rounds
  for (let r = 1; r < totalRounds; r++) {
    STATE.matches[tournamentId][r] = {};
    const matchesInRound = size / Math.pow(2, r + 1);
    for (let i = 0; i < matchesInRound; i++) {
      const matchId = `m_r${r}_${i}`;
      STATE.matches[tournamentId][r][matchId] = {
        id: matchId, round: r, index: i,
        p1: null, p2: null, score1: null, score2: null, winner: null, isBye: false, stage: 'Knockout'
      };
    }
  }

  // Keep 3rd place if configured
  const tConfig = TOURNAMENTS.find(t => t.id === tournamentId);
  if (tConfig?.hasFinal3rd) {
    STATE.matches[tournamentId]['3rd_place'] = {
      'm_3rd_0': { id: 'm_3rd_0', round: '3rd_place', index: 0, p1: null, p2: null, score1: null, score2: null, winner: null, isBye: false, stage: 'Knockout' }
    };
  }

  meta.stage = 'knockout';
  await saveTournamentMeta(tournamentId, meta);
  await saveToFirebase(`ballandor/matches/${tournamentId}`, STATE.matches[tournamentId]);

  await resolveByes(tournamentId);
  updateTournamentStats(tournamentId);
  showNotif('🏆 Knockout generated from groups', 'success', { showUndo: true, undoLabel: 'Undo KO' });
  renderBracketData(tournamentId);
}

async function resolveByes(tournamentId) {
  const round0 = STATE.matches[tournamentId]?.[0];
  if (!round0) return;
  for (const match of Object.values(round0)) {
    if (match.isBye && match.winner) {
      // Auto-advance winner
      await advancePlayer(tournamentId, 0, match.index, match.winner);
    }
  }
}

async function submitMatchResult(tournamentId, roundIndex, matchId, s1, s2) {
  const match = STATE.matches[tournamentId]?.[roundIndex]?.[matchId];
  if (!match) return;
  if (match.isBye) return showNotif('Cannot submit score for a BYE match', 'error');

  const score1 = parseInt(s1);
  const score2 = parseInt(s2);
  
  if (isNaN(score1) || isNaN(score2)) return showNotif('Invalid score', 'error');

  // Basic tiebreak (for now, away gets the win if tied, or simple admin override later)
  let winnerId = null;
  let loserId = null;
  if (score1 > score2) { winnerId = match.p1; loserId = match.p2; }
  else if (score2 > score1) { winnerId = match.p2; loserId = match.p1; }
  else {
    // Tie - force user to enter a non-tie result (e.g., aggregate / penalties included)
    return showNotif('Matches cannot end in a tie. Please include penalty goals if tied.', 'error');
  }

  // Snapshot for undo before mutating
  const prev = JSON.parse(JSON.stringify(match));

  // Register undo (admin only)
  createUndoAction(async () => {
    STATE.matches[tournamentId][roundIndex][matchId] = prev;
    await saveMatch(tournamentId, roundIndex, matchId, prev);
    updateTournamentStats(tournamentId);
    renderTournamentDashboard(tournamentId);
    renderBracketData(tournamentId);
    showNotif('Match score reverted', 'info');
  });

  match.score1 = score1;
  match.score2 = score2;
  match.winner = winnerId;
  
  await saveMatch(tournamentId, roundIndex, matchId, match);
  
  // Refresh stats for the dashboard
  updateTournamentStats(tournamentId);

  // If this is a regular round, advance winner
  if (typeof roundIndex === 'number') {
    await advancePlayer(tournamentId, roundIndex, match.index, winnerId, loserId);
  } else if (roundIndex === '3rd_place') {
    // 3rd place resolved
    await resolveTournamentCompletion(tournamentId);
  }

  showNotif('Score saved!', 'success', { showUndo: true, undoLabel: 'Undo score' });
  renderBracketData(tournamentId);
}

async function submitGroupMatchResult(tournamentId, matchId, s1, s2) {
  if (AUTH.role !== 'admin') return;
  const match = STATE.matches?.[tournamentId]?.[GROUP_ROUND_KEY]?.[matchId];
  if (!match) return;
  const score1 = parseInt(s1, 10);
  const score2 = parseInt(s2, 10);
  if (isNaN(score1) || isNaN(score2)) return showNotif('Invalid score', 'error');

  const prev = JSON.parse(JSON.stringify(match));
  createUndoAction(async () => {
    STATE.matches[tournamentId][GROUP_ROUND_KEY][matchId] = prev;
    await saveMatch(tournamentId, GROUP_ROUND_KEY, matchId, prev);
    updateTournamentStats(tournamentId);
    renderTournamentDashboard(tournamentId);
    renderBracketData(tournamentId);
    showNotif('Group score reverted', 'info');
  });

  match.score1 = score1;
  match.score2 = score2;
  // Winner stays null for draws in group stage
  if (score1 > score2) match.winner = match.p1;
  else if (score2 > score1) match.winner = match.p2;
  else match.winner = null;

  await saveMatch(tournamentId, GROUP_ROUND_KEY, matchId, match);
  updateTournamentStats(tournamentId);

  // Auto-generate knockout when groups finish (optional convenience)
  const meta = getTournamentMeta(tournamentId);
  if (groupsComplete(tournamentId, meta) && !Object.keys(STATE.matches?.[tournamentId] || {}).some(k => !isNaN(k))) {
    // Only auto-generate if knockout not generated yet
    await generateKnockoutFromGroups(tournamentId);
  }

  showNotif('Group match saved', 'success', { showUndo: true, undoLabel: 'Undo score' });
  renderBracketData(tournamentId);
}

async function advancePlayer(tournamentId, currentRound, matchIndex, winnerId, loserId = null) {
  const roundsCount = Object.keys(STATE.matches[tournamentId]).filter(k => !isNaN(k)).length;
  
  if (currentRound === roundsCount - 1) {
    // This was the Grand Final
    await resolveTournamentCompletion(tournamentId);
  } else {
    // Advance winner to next round
    const nextRound = currentRound + 1;
    const nextMatchIndex = mapMatchIndexToNextRound(matchIndex);
    const nextMatchId = Object.values(STATE.matches[tournamentId][nextRound]).find(m => m.index === nextMatchIndex).id;
    
    const nextMatch = STATE.matches[tournamentId][nextRound][nextMatchId];
    
    // Are we slot 1 (even index) or slot 2 (odd index) entering the next match?
    if (matchIndex % 2 === 0) {
      nextMatch.p1 = winnerId;
    } else {
      nextMatch.p2 = winnerId;
    }
    await saveMatch(tournamentId, nextRound, nextMatchId, nextMatch);

    // If we just resolved a semi-final (currentRound == roundsCount - 2), loser goes to 3rd place match
    if (currentRound === roundsCount - 2 && STATE.matches[tournamentId]['3rd_place']) {
      const thirdMatch = STATE.matches[tournamentId]['3rd_place']['m_3rd_0'];
      if (matchIndex % 2 === 0) thirdMatch.p1 = loserId;
      else thirdMatch.p2 = loserId;
      await saveMatch(tournamentId, '3rd_place', 'm_3rd_0', thirdMatch);
    }
  }
}

async function resolveTournamentCompletion(tournamentId) {
  const matches = STATE.matches[tournamentId];
  const roundsCount = Object.keys(matches).filter(k => !isNaN(k)).length;
  const finalMatch = Object.values(matches[roundsCount - 1])[0];
  
  if (!finalMatch.winner) return; // Not complete yet

  let first = finalMatch.winner;
  let second = finalMatch.winner === finalMatch.p1 ? finalMatch.p2 : finalMatch.p1;
  let third = null;

  if (matches['3rd_place']) {
    const thirdMatch = matches['3rd_place']['m_3rd_0'];
    if (thirdMatch && thirdMatch.winner) third = thirdMatch.winner;
  }

  // Pre-fill results in existing system
  if (!STATE.results[tournamentId]) STATE.results[tournamentId] = {};
  if (!STATE.results[tournamentId].positions) STATE.results[tournamentId].positions = {};

  STATE.results[tournamentId].positions[1] = first;
  STATE.results[tournamentId].positions[2] = second;
  if (third) STATE.results[tournamentId].positions[3] = third;

  await saveToFirebase(`ballandor/results/${tournamentId}`, STATE.results[tournamentId]);
  showNotif(`🏆 Final calculated! Winner: ${STATE.players[first]?.name}`, 'success');
  renderAll(); // Renders dashboard to update points
}

// ── UI Integration ──
let CURRENT_BRACKET_TID = null;
let CURRENT_EDIT_MATCH_CTX = null;

function openBracketModal(tournamentId) {
  CURRENT_BRACKET_TID = tournamentId;
  const tConfig = TOURNAMENTS.find(t => t.id === tournamentId);
  document.getElementById('bracket-modal-title').innerHTML = `🏆 Manage Bracket: ${tConfig.name}`;
  openModal('bracket-modal');
  // Sync group stage setup defaults
  ensureTournamentMatchesRoot(tournamentId);
  const meta = getTournamentMeta(tournamentId);
  if (!meta.groupCount) meta.groupCount = parseInt(document.getElementById('gs-group-count')?.value || '4', 10);
  if (!meta.playersPerGroup) meta.playersPerGroup = parseInt(document.getElementById('gs-players-per-group')?.value || '4', 10);
  if (!meta.groups || !meta.assignments) {
    const built = buildEmptyAssignments(tournamentId, meta.groupCount);
    meta.groups = built.groups;
    meta.assignments = built.assignments;
  }
  saveTournamentMeta(tournamentId, meta);
  renderBracketData(tournamentId);
}

function getTournamentParticipants(tournamentId) {
  const stats = STATE.tournamentStats?.[tournamentId];
  if (stats && Object.keys(stats).length) {
    return Object.keys(stats)
      .map(pid => STATE.players[pid])
      .filter(Boolean)
      .sort((a,b) => a.name.localeCompare(b.name));
  }
  return getPlayersArray();
}

function openEditMatch(tournamentId, roundIndex, matchId) {
  if (AUTH.role !== 'admin') return;
  const match = STATE.matches?.[tournamentId]?.[roundIndex]?.[matchId];
  if (!match || match.isBye) return;
  CURRENT_EDIT_MATCH_CTX = { tournamentId, roundIndex, matchId };

  const p1Sel = document.getElementById('edit-match-p1');
  const p2Sel = document.getElementById('edit-match-p2');
  const s1El = document.getElementById('edit-match-s1');
  const s2El = document.getElementById('edit-match-s2');

  const participants = getTournamentParticipants(tournamentId);
  const opts = ['<option value="">— Select —</option>'].concat(
    participants.map(p => `<option value="${p.id}">${esc(p.name)}</option>`)
  ).join('');

  p1Sel.innerHTML = opts;
  p2Sel.innerHTML = opts;
  p1Sel.value = match.p1 || '';
  p2Sel.value = match.p2 || '';

  s1El.value = match.score1 != null ? match.score1 : '';
  s2El.value = match.score2 != null ? match.score2 : '';

  openModal('edit-match-modal');
}

async function applyEditMatch() {
  if (AUTH.role !== 'admin' || !CURRENT_EDIT_MATCH_CTX) return;
  const { tournamentId, roundIndex, matchId } = CURRENT_EDIT_MATCH_CTX;
  const match = STATE.matches?.[tournamentId]?.[roundIndex]?.[matchId];
  if (!match || match.isBye) { closeModal('edit-match-modal'); return; }

  const p1Id = document.getElementById('edit-match-p1').value;
  const p2Id = document.getElementById('edit-match-p2').value;
  const s1Raw = document.getElementById('edit-match-s1').value;
  const s2Raw = document.getElementById('edit-match-s2').value;

  if (!p1Id || !p2Id) {
    showNotif('Select both players', 'error');
    return;
  }
  if (p1Id === p2Id) {
    showNotif('Player 1 and Player 2 must be different', 'error');
    return;
  }

  const score1 = s1Raw === '' ? null : parseInt(s1Raw, 10);
  const score2 = s2Raw === '' ? null : parseInt(s2Raw, 10);
  if ((score1 !== null && isNaN(score1)) || (score2 !== null && isNaN(score2))) {
    showNotif('Scores must be numbers or left blank', 'error');
    return;
  }

  const prev = JSON.parse(JSON.stringify(match));

  createUndoAction(async () => {
    STATE.matches[tournamentId][roundIndex][matchId] = prev;
    await saveMatch(tournamentId, roundIndex, matchId, prev);
    updateTournamentStats(tournamentId);
    renderTournamentDashboard(tournamentId);
    renderBracketData(tournamentId);
    showNotif('Match edit reverted', 'info');
  });

  match.p1 = p1Id;
  match.p2 = p2Id;
  match.score1 = score1;
  match.score2 = score2;

  // Recalculate winner if scores are present
  if (score1 !== null && score2 !== null) {
    if (score1 > score2) match.winner = p1Id;
    else if (score2 > score1) match.winner = p2Id;
    else {
      // Allow ties in group stage, forbid in knockout
      if (roundIndex === GROUP_ROUND_KEY) {
        match.winner = null;
      } else {
        showNotif('Matches cannot end in a tie. Please include penalty goals if tied.', 'error');
        match.winner = null;
      }
    }
  } else {
    match.winner = null;
  }

  await saveMatch(tournamentId, roundIndex, matchId, match);
  updateTournamentStats(tournamentId);
  renderTournamentDashboard(tournamentId);
  renderBracketData(tournamentId);

  closeModal('edit-match-modal');
  CURRENT_EDIT_MATCH_CTX = null;
  showNotif('Match updated', 'success', { showUndo: true, undoLabel: 'Undo edit' });
}

async function deleteMatch(tournamentId, roundIndex, matchId) {
  if (AUTH.role !== 'admin') return;
  const match = STATE.matches?.[tournamentId]?.[roundIndex]?.[matchId];
  if (!match) return;

  const prev = JSON.parse(JSON.stringify(match));

  createUndoAction(async () => {
    if (!STATE.matches[tournamentId]) STATE.matches[tournamentId] = {};
    if (!STATE.matches[tournamentId][roundIndex]) STATE.matches[tournamentId][roundIndex] = {};
    STATE.matches[tournamentId][roundIndex][matchId] = prev;
    await saveMatch(tournamentId, roundIndex, matchId, prev);
    updateTournamentStats(tournamentId);
    renderTournamentDashboard(tournamentId);
    renderBracketData(tournamentId);
    showNotif('Match restored', 'info');
  });

  delete STATE.matches[tournamentId][roundIndex][matchId];
  await saveToFirebase(`ballandor/matches/${tournamentId}/${roundIndex}/${matchId}`, null);
  updateTournamentStats(tournamentId);
  renderTournamentDashboard(tournamentId);
  renderBracketData(tournamentId);
  showNotif('Match deleted', 'info', { showUndo: true, undoLabel: 'Undo delete' });
}

function renderBracketData(tournamentId) {
  const container = document.getElementById('bracket-container');
  const matches = STATE.matches?.[tournamentId];
  
  if (!matches || !Object.keys(matches).length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🎲</div>
      <div class="empty-title">No Fixtures Generated</div>
      <div class="empty-desc">Click "Generate Fixtures" to create the bracket for this tournament.</div>
    </div>`;
    return;
  }

  const meta = getTournamentMeta(tournamentId);
  const groupCountEl = document.getElementById('gs-group-count');
  const ppgEl = document.getElementById('gs-players-per-group');
  if (groupCountEl && ppgEl && AUTH.role === 'admin') {
    // Keep controls aligned with meta
    if (meta.groupCount) groupCountEl.value = String(meta.groupCount);
    if (meta.playersPerGroup) ppgEl.value = String(meta.playersPerGroup);
  }

  // Render group stage summary + matches if present
  let groupHtml = '';
  const groupMatches = matches[GROUP_ROUND_KEY] || null;
  if (meta.groups && meta.groups.length) {
    const groupMap = getPlayersByGroup(tournamentId, meta);
    groupHtml += `<div class="card" style="padding:16px;">
      <div class="card-title">🧩 Group Stage</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;">`;

    meta.groups.forEach(g => {
      const standings = computeGroupStandings(tournamentId, g, meta);
      const rows = standings.map((r, i) => `<tr>
        <td style="padding:6px 8px;white-space:nowrap;">${i + 1}</td>
        <td style="padding:6px 8px;">${renderPlayerNameWithLogo(STATE.players[r.id])}</td>
        <td style="padding:6px 8px;text-align:center;">${r.mp}</td>
        <td style="padding:6px 8px;text-align:center;">${r.w}</td>
        <td style="padding:6px 8px;text-align:center;">${r.d}</td>
        <td style="padding:6px 8px;text-align:center;">${r.l}</td>
        <td style="padding:6px 8px;text-align:center;">${r.gd > 0 ? '+' + r.gd : r.gd}</td>
        <td style="padding:6px 8px;text-align:center;font-family:'Cinzel',serif;color:var(--gold);font-weight:700;">${r.pts}</td>
      </tr>`).join('') || `<tr><td colspan="8" style="padding:10px;color:var(--text-secondary);">No players assigned</td></tr>`;

      groupHtml += `<div style="border:1px solid var(--border-glass);border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.02);">
        <div style="padding:10px 12px;background:rgba(212,175,55,0.06);font-family:'Cinzel',serif;color:var(--gold);display:flex;justify-content:space-between;align-items:center;">
          <span>Group ${g}</span>
          <span style="font-size:11px;color:var(--text-secondary);">Qualify: top 2</span>
        </div>
        <div class="leaderboard-container">
          <table class="leaderboard-table" style="font-size:12px;">
            <thead>
              <tr>
                <th>#</th><th>Player</th><th>MP</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>PTS</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    });

    groupHtml += `</div>`;

    if (groupMatches) {
      const groupList = Object.values(groupMatches).sort((a,b) => (a.group || '').localeCompare(b.group || '') || (a.index || 0) - (b.index || 0));
      groupHtml += `<div style="margin-top:14px;">
        <div style="font-family:'Cinzel',serif;font-size:12px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
          Group Fixtures
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">` +
        groupList.map(m => {
          const p1 = STATE.players[m.p1];
          const p2 = STATE.players[m.p2];
          const s1 = m.score1 !== null ? m.score1 : '';
          const s2 = m.score2 !== null ? m.score2 : '';
          return `<div class="bracket-match" style="padding:10px 12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
              <div style="min-width:120px;font-size:12px;color:var(--text-secondary);">Group ${esc(m.group || '?')}</div>
              <div style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:10px;">
                <div style="flex:1;">${renderPlayerNameWithLogo(p1) || 'TBD'}</div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <input type="number" class="admin-only bracket-score-input" id="gsc1_${m.id}" value="${s1}">
                  <span style="color:var(--text-secondary);">-</span>
                  <input type="number" class="admin-only bracket-score-input" id="gsc2_${m.id}" value="${s2}">
                </div>
                <div style="flex:1;text-align:right;">${renderPlayerNameWithLogo(p2) || 'TBD'}</div>
              </div>
            </div>
            <div class="admin-only bracket-actions" style="padding:8px 0 0;">
              <button class="btn btn-primary btn-sm" style="flex:1;" onclick="submitGroupMatchResult('${tournamentId}','${m.id}',document.getElementById('gsc1_${m.id}').value,document.getElementById('gsc2_${m.id}').value)">Save</button>
              <button class="btn btn-secondary btn-sm" onclick="openEditMatch('${tournamentId}','${GROUP_ROUND_KEY}','${m.id}')">Edit Match</button>
              <button class="btn btn-danger btn-sm" onclick="deleteMatch('${tournamentId}','${GROUP_ROUND_KEY}','${m.id}')">Delete</button>
            </div>
          </div>`;
        }).join('') +
        `</div></div>`;
    } else {
      groupHtml += `<div style="margin-top:10px;color:var(--text-secondary);font-size:13px;">No group fixtures generated yet.</div>`;
    }

    groupHtml += `</div>`;
  }

  let html = `<div class="bracket-rounds-row">`;
  
  const numericRounds = Object.keys(matches).filter(k => !isNaN(k)).map(Number).sort((a,b)=>a-b);
  
  // If no knockout yet, show only group stage
  if (!numericRounds.length && !matches['3rd_place']) {
    container.innerHTML = groupHtml || `<div class="empty-state">
      <div class="empty-icon">🧩</div>
      <div class="empty-title">Group Stage Not Set Up</div>
      <div class="empty-desc">Configure groups and generate fixtures to begin.</div>
    </div>`;
    return;
  }

  numericRounds.forEach(r => {
    const matchArray = Object.values(matches[r]).sort((a,b)=>a.index-b.index);
    html += `<div class="bracket-round-column">
      <h4 style="text-align:center; color:var(--gold); font-family:'Cinzel',serif; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:10px;">Round ${r+1}</h4>`;
      
    matchArray.forEach(m => {
      const p1name = m.p1 ? STATE.players[m.p1]?.name : 'TBD';
      const p2name = m.p2 ? STATE.players[m.p2]?.name : 'TBD';
      const p1team = m.p1 ? STATE.players[m.p1]?.team : '';
      const p2team = m.p2 ? STATE.players[m.p2]?.team : '';
      
      const s1 = m.score1 !== null ? m.score1 : '';
      const s2 = m.score2 !== null ? m.score2 : '';
      
      const p1WinnerClass = m.winner === m.p1 ? 'color:#6fcf6f; font-weight:bold;' : (m.winner ? 'opacity:0.5;' : '');
      const p2WinnerClass = m.winner === m.p2 ? 'color:#6fcf6f; font-weight:bold;' : (m.winner ? 'opacity:0.5;' : '');

      if (m.isBye) {
        html += `<div class="bracket-match bye-match">
          <div class="bracket-bye-label">${esc(p1name !== 'TBD' ? p1name : p2name)} (BYE)</div>
        </div>`;
      } else {
        html += `<div class="bracket-match">
          
          <div class="bracket-row">
            <div class="bracket-player" style="${p1WinnerClass}">
              ${esc(p1name)} <span style="font-size:10px; color:var(--text-secondary);">${esc(p1team)}</span>
            </div>
            <input type="number" id="sc1_${m.id}" value="${s1}" class="admin-only bracket-score-input">
            <span style="width:40px; text-align:center; display:none;" class="readonly-score">${s1}</span>
          </div>

          <div class="bracket-row">
            <div class="bracket-player" style="${p2WinnerClass}">
              ${esc(p2name)} <span style="font-size:10px; color:var(--text-secondary);">${esc(p2team)}</span>
            </div>
            <input type="number" id="sc2_${m.id}" value="${s2}" class="admin-only bracket-score-input">
            <span style="width:40px; text-align:center; display:none;" class="readonly-score">${s2}</span>
          </div>
          
          <div class="admin-only bracket-actions">
            <button class="btn btn-primary btn-sm" style="flex:1;" onclick="submitMatchResult('${tournamentId}', ${r}, '${m.id}', document.getElementById('sc1_${m.id}').value, document.getElementById('sc2_${m.id}').value)">Save Result</button>
            <button class="btn btn-secondary btn-sm" onclick="openEditMatch('${tournamentId}', ${r}, '${m.id}')">Edit Match</button>
            <button class="btn btn-danger btn-sm" onclick="deleteMatch('${tournamentId}', ${r}, '${m.id}')">Delete</button>
          </div>

        </div>`;
      }
    });
    
    html += `</div>`; // End round column
  });
  
  // 3rd place column
  if (matches['3rd_place']) {
    const thirdMatch = matches['3rd_place']['m_3rd_0'];
    const p1name = thirdMatch.p1 ? STATE.players[thirdMatch.p1]?.name : 'TBD';
    const p2name = thirdMatch.p2 ? STATE.players[thirdMatch.p2]?.name : 'TBD';
    const s1 = thirdMatch.score1 !== null ? thirdMatch.score1 : '';
    const s2 = thirdMatch.score2 !== null ? thirdMatch.score2 : '';
    const p1WinnerClass = thirdMatch.winner === thirdMatch.p1 ? 'color:#6fcf6f; font-weight:bold;' : (thirdMatch.winner?'opacity:0.5;':'');
    const p2WinnerClass = thirdMatch.winner === thirdMatch.p2 ? 'color:#6fcf6f; font-weight:bold;' : (thirdMatch.winner?'opacity:0.5;':'');

    html += `<div class="bracket-round-column bracket-third-column">
      <h4 style="text-align:center; color:#c0c0c0; font-family:'Cinzel',serif; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:10px;">3rd Place Match</h4>
      <div class="bracket-match">
          
          <div class="bracket-row">
            <div style="font-size:13px; ${p1WinnerClass}">${esc(p1name)}</div>
            <input type="number" id="sc1_${thirdMatch.id}" value="${s1}" class="admin-only bracket-score-input">
          </div>
          <div class="bracket-row">
            <div style="font-size:13px; ${p2WinnerClass}">${esc(p2name)}</div>
            <input type="number" id="sc2_${thirdMatch.id}" value="${s2}" class="admin-only bracket-score-input">
          </div>
          
          <div class="admin-only bracket-actions">
             <button class="btn btn-primary btn-sm" style="flex:1;" onclick="submitMatchResult('${tournamentId}', '3rd_place', '${thirdMatch.id}', document.getElementById('sc1_${thirdMatch.id}').value, document.getElementById('sc2_${thirdMatch.id}').value)">Save</button>
             <button class="btn btn-secondary btn-sm" onclick="openEditMatch('${tournamentId}', '3rd_place', '${thirdMatch.id}')">Edit Match</button>
             <button class="btn btn-danger btn-sm" onclick="deleteMatch('${tournamentId}', '3rd_place', '${thirdMatch.id}')">Delete</button>
          </div>
        </div>
    </div>`;
  }

  html += `</div>`; // End flex display
  container.innerHTML = (groupHtml ? groupHtml + `<div style="height:16px;"></div>` : '') + html;

  // Read-only override for inputs if player
  if (AUTH.role === 'player') {
    container.querySelectorAll('input.admin-only').forEach(el => el.style.display = 'none');
    container.querySelectorAll('.readonly-score').forEach(el => el.style.display = 'inline-block');
  }
}

// Global button handlers for Bracket Modal
document.getElementById('btn-generate-bracket')?.addEventListener('click', async () => {
  if (!CURRENT_BRACKET_TID) return;
  if (AUTH.role !== 'admin') return;
  const tid = CURRENT_BRACKET_TID;
  const groupCount = parseInt(document.getElementById('gs-group-count')?.value || '4', 10);
  const ppg = parseInt(document.getElementById('gs-players-per-group')?.value || '4', 10);

  ensureTournamentMatchesRoot(tid);
  const meta = getTournamentMeta(tid);
  meta.groupCount = groupCount;
  meta.playersPerGroup = ppg;
  // If no assignments yet, do a random draw by default
  if (!meta.assignments || !meta.groups) {
    const draw = randomizeGroupAssignments(tid, groupCount, ppg);
    meta.groups = draw.groups;
    meta.assignments = draw.assignments;
  }
  await saveTournamentMeta(tid, meta);
  await generateGroupFixtures(tid);
});

document.getElementById('btn-clear-bracket')?.addEventListener('click', async () => {
  if (!CURRENT_BRACKET_TID) return;
  if(!confirm('Are you sure you want to reset this tournament?')) return;

  const tid = CURRENT_BRACKET_TID;
  const prevMatches = STATE.matches?.[tid] ? JSON.parse(JSON.stringify(STATE.matches[tid])) : null;
  const prevStats = STATE.tournamentStats?.[tid] ? JSON.parse(JSON.stringify(STATE.tournamentStats[tid])) : null;

  createUndoAction(async () => {
    if (prevMatches) {
      if (!STATE.matches) STATE.matches = {};
      STATE.matches[tid] = prevMatches;
      await saveToFirebase(`ballandor/matches/${tid}`, prevMatches);
    }
    if (prevStats) {
      if (!STATE.tournamentStats) STATE.tournamentStats = {};
      STATE.tournamentStats[tid] = prevStats;
      await saveToFirebase(`ballandor/tournamentStats/${tid}`, prevStats);
    }
    updateTournamentStats(tid);
    renderTournamentDashboard(tid);
    renderBracketData(tid);
    showNotif('Tournament reset undone', 'info');
  });

  if (STATE.matches) delete STATE.matches[tid];
  if (STATE.tournamentStats) delete STATE.tournamentStats[tid];
  await saveToFirebase(`ballandor/matches/${tid}`, null);
  await saveToFirebase(`ballandor/tournamentStats/${tid}`, null);

  renderBracketData(tid);
  renderTournamentDashboard(tid);
  showNotif('Tournament cleared', 'info', { showUndo: true, undoLabel: 'Undo reset' });
});

// Group stage controls
document.getElementById('btn-gs-random')?.addEventListener('click', async () => {
  if (AUTH.role !== 'admin') return;
  if (!CURRENT_BRACKET_TID) return;
  const tid = CURRENT_BRACKET_TID;
  const groupCount = parseInt(document.getElementById('gs-group-count')?.value || '4', 10);
  const ppg = parseInt(document.getElementById('gs-players-per-group')?.value || '4', 10);
  const meta = getTournamentMeta(tid);
  const prevMeta = JSON.parse(JSON.stringify(meta || {}));

  createUndoAction(async () => {
    await saveTournamentMeta(tid, prevMeta);
    renderBracketData(tid);
    showNotif('Group draw reverted', 'info');
  });

  const draw = randomizeGroupAssignments(tid, groupCount, ppg);
  meta.groupCount = groupCount;
  meta.playersPerGroup = ppg;
  meta.groups = draw.groups;
  meta.assignments = draw.assignments;
  meta.stage = 'group';
  await saveTournamentMeta(tid, meta);
  showNotif('Random draw complete', 'success', { showUndo: true, undoLabel: 'Undo draw' });
  renderBracketData(tid);
});

document.getElementById('btn-gs-manual')?.addEventListener('click', async () => {
  if (AUTH.role !== 'admin') return;
  if (!CURRENT_BRACKET_TID) return;
  const tid = CURRENT_BRACKET_TID;
  const groupCount = parseInt(document.getElementById('gs-group-count')?.value || '4', 10);
  const ppg = parseInt(document.getElementById('gs-players-per-group')?.value || '4', 10);
  const meta = getTournamentMeta(tid);
  meta.groupCount = groupCount;
  meta.playersPerGroup = ppg;
  if (!meta.groups || meta.groups.length !== groupCount) meta.groups = Array.from({ length: groupCount }, (_, i) => groupLetter(i));
  if (!meta.assignments) {
    const built = buildEmptyAssignments(tid, groupCount);
    meta.assignments = built.assignments;
  }
  await saveTournamentMeta(tid, meta);
  showNotif('Manual mode ready. Edit assignments in Firebase meta if needed (UI assignment panel coming next).', 'info');
  renderBracketData(tid);
});

document.getElementById('btn-gs-generate')?.addEventListener('click', async () => {
  if (AUTH.role !== 'admin') return;
  if (!CURRENT_BRACKET_TID) return;
  const tid = CURRENT_BRACKET_TID;
  const groupCount = parseInt(document.getElementById('gs-group-count')?.value || '4', 10);
  const ppg = parseInt(document.getElementById('gs-players-per-group')?.value || '4', 10);
  const meta = getTournamentMeta(tid);
  meta.groupCount = groupCount;
  meta.playersPerGroup = ppg;
  if (!meta.assignments || !meta.groups) {
    const draw = randomizeGroupAssignments(tid, groupCount, ppg);
    meta.groups = draw.groups;
    meta.assignments = draw.assignments;
  }
  await saveTournamentMeta(tid, meta);
  await generateGroupFixtures(tid);
});

document.getElementById('btn-gs-generate-ko')?.addEventListener('click', async () => {
  if (AUTH.role !== 'admin') return;
  if (!CURRENT_BRACKET_TID) return;
  await generateKnockoutFromGroups(CURRENT_BRACKET_TID);
});
