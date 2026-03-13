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
  players: {},      // { id: { name, id } }
  results: {},      // { tournamentId: { positions: {1: playerId, ...}, ba: [p1,p2,p3], bd: [p1,p2,p3] } }
  session: {        // whole-season BA/BD awards
    ba: { 1: null, 2: null, 3: null },
    bd: { 1: null, 2: null, 3: null }
  },
  voters: {},       // { voterId: { name, votes: { 1: playerId, 2: ..., ... } } }
  votingResults: {} // { playerId: totalVotingPts }
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
    }
    renderAll();
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
function addPlayer(name) {
  name = name.trim();
  if (!name) return showNotif('Enter a player name', 'error');
  const count = Object.keys(STATE.players).length;
  if (count >= 36) return showNotif('Maximum 36 players allowed', 'error');
  // Check duplicate
  if (Object.values(STATE.players).some(p => p.name.toLowerCase() === name.toLowerCase())) {
    return showNotif(`"${name}" is already registered`, 'error');
  }
  const id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  STATE.players[id] = { id, name };
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
    body.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">⚽</div><div class="empty-title">No data yet</div><div class="empty-desc">Add players and register tournament results</div></div></td></tr>`;
    return;
  }
  body.innerHTML = ranked.map((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other';
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${i+1}</span></td>
      <td class="player-name-cell">${esc(p.name)}</td>
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
  grid.innerHTML = filtered.map(p => `
    <div class="player-chip" id="chip-${p.id}">
      <div class="player-avatar">${p.name.charAt(0).toUpperCase()}</div>
      <span class="player-chip-name">${esc(p.name)}</span>
      <button class="player-delete" onclick="removePlayer('${p.id}')" title="Remove">✕</button>
    </div>
  `).join('');
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
        <button class="t-action-btn" onclick="openTournamentModal('${t.id}')"
          ${!isAvailable?'disabled':''}>
          ${isCompleted ? '✏️ Edit Result' : '📝 Register Result'}
        </button>
      </div>
    </div>`;
  }).join('');
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
    <td class="player-name-cell">${esc(p.name)}</td>
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
    const slotsHtml = [1,2,3,4,5,6,7].map(rank => {
      const pts = VOTING_PTS[rank];
      const rankClass = rank<=3 ? `vote-rank-${rank}` : 'vote-rank-other';
      const curVal = voter.votes?.[rank] || '';
      const rankLabel = rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`${rank}th`;
      return `<div class="vote-slot">
        <span class="vote-rank-label ${rankClass}">${rankLabel}</span>
        <select class="vote-select" data-voter="${voter.id}" data-rank="${rank}" onchange="updateVote('${voter.id}',${rank},this.value)">
          <option value="">— None —</option>
          ${getPlayersArray()
            .filter(p => p.id !== voter.id) // can't vote for self
            .map(p => `<option value="${p.id}"${p.id===curVal?' selected':''}>${esc(p.name)}</option>`)
            .join('')}
        </select>
        <span class="vote-pts">${pts} pts</span>
      </div>`;
    }).join('');

    return `<div class="voter-card">
      <div class="voter-name">
        <span class="player-avatar" style="width:32px;height:32px;font-size:12px;">${voter.name.charAt(0)}</span>
        ${esc(voter.name)}
        <span class="voter-status-badge ${hasVoted?'voted-badge':'pending-badge'}">${hasVoted?'Voted':'Pending'}</span>
        <button class="btn btn-danger btn-sm" style="margin-left:auto;padding:4px 8px;font-size:11px;" onclick="removeVoter('${voter.id}')">✕</button>
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
    votes: {}
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
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${i+1}</span></td>
      <td class="player-name-cell">${esc(p.name)}</td>
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

    return `<tr>
      <td>${esc(p.name)}</td>
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

// ─── MODALS ───────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────
function showNotif(msg, type = 'info') {
  const container = document.getElementById('notif-container');
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'notifOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ─── UTILITIES ───────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

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
    document.getElementById('new-player-name').value = '';
    openModal('add-player-modal');
    setTimeout(() => document.getElementById('new-player-name').focus(), 200);
  });
  document.getElementById('confirm-add-player').addEventListener('click', () => {
    addPlayer(document.getElementById('new-player-name').value);
    if (!Object.values(STATE.players).some(p => p.name.toLowerCase() === document.getElementById('new-player-name').value.trim().toLowerCase())) return;
    closeModal('add-player-modal');
    renderAll();
  });
  document.getElementById('new-player-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('confirm-add-player').click();
  });

  // Bulk add
  document.getElementById('bulk-add-btn').addEventListener('click', () => {
    const lines = document.getElementById('bulk-textarea').value.split('\n');
    let added = 0;
    lines.forEach(line => {
      const name = line.trim();
      if (!name) return;
      const before = Object.keys(STATE.players).length;
      addPlayer(name);
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

  // Config modal — shows current project info only (config is hardcoded)
  document.getElementById('config-btn').addEventListener('click', () => {
    openModal('config-modal');
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

  // Auto-connect with hardcoded Firebase config
  initFirebase(FIREBASE_CONFIG).then(ok => {
    if (!ok) {
      setFirebaseStatus('error', 'Offline — using local data');
      loadLocalFallback();
      renderAll();
    }
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
    }
  } catch(e) {}
}

// Auto-save to localStorage as fallback whenever state changes
setInterval(() => {
  localStorage.setItem('ballandor_local', JSON.stringify(STATE));
}, 5000);
