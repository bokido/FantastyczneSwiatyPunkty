'use strict';

// ===== STATE =====
const STATE_KEY = 'fs_kalkulator_state';

let state = {
  players: [],
  rounds: [],       // Array of { scores: { [player]: { cards: [{base, bonus}], total } } }
  currentRound: 0,
  currentPlayer: 0,
  screen: 'setup'   // 'setup' | 'scoring' | 'summary'
};

const CARDS_PER_HAND = 7;

// ===== PERSISTENCE =====
function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) state = JSON.parse(saved);
  } catch (e) { /* ignore */ }
}

// ===== ROUTING =====
function showScreen(name) {
  state.screen = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  updateHeader();
}

function updateHeader() {
  const roundLabel = document.getElementById('header-round');
  if (state.screen === 'scoring') {
    roundLabel.textContent = `Runda ${state.currentRound + 1}`;
  } else {
    roundLabel.textContent = '';
  }
}

// ===== SETUP SCREEN =====
function renderSetup() {
  const list = document.getElementById('players-list');
  list.innerHTML = '';

  state.players.forEach((name, i) => {
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <div class="player-number">${i + 1}</div>
      <input class="input-text" type="text" placeholder="Imię gracza ${i + 1}"
        value="${escHtml(name)}" data-idx="${i}" maxlength="20" inputmode="text">
      <button class="btn-icon" data-remove="${i}" ${state.players.length <= 2 ? 'disabled' : ''} title="Usuń gracza">✕</button>
    `;
    list.appendChild(row);
  });

  // Events
  list.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', e => {
      state.players[+e.target.dataset.idx] = e.target.value.trim();
      saveState();
    });
    inp.addEventListener('blur', e => {
      state.players[+e.target.dataset.idx] = e.target.value.trim();
      saveState();
    });
  });

  list.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.currentTarget.dataset.remove;
      state.players.splice(idx, 1);
      saveState();
      renderSetup();
    });
  });

  document.getElementById('btn-add-player').style.display =
    state.players.length >= 6 ? 'none' : 'flex';
}

// ===== SCORING SCREEN =====
function initRound() {
  // Create round data if not exists
  if (!state.rounds[state.currentRound]) {
    const scores = {};
    state.players.forEach(p => {
      scores[p] = {
        cards: Array.from({ length: CARDS_PER_HAND }, () => ({ base: '', bonus: '' })),
        total: 0
      };
    });
    state.rounds[state.currentRound] = { scores };
    saveState();
  }
}

function toggleExtraCard() {
  const player = state.players[state.currentPlayer];
  const playerData = state.rounds[state.currentRound].scores[player];
  if (playerData.cards.length === CARDS_PER_HAND) {
    playerData.cards.push({ base: '', bonus: '' });
  } else {
    playerData.cards.pop();
  }
  saveState();
  renderPlayerScore();
}

function renderScoring() {
  initRound();
  renderPlayerTabs();
  renderPlayerScore();
}

function getPlayerTabStatus(player) {
  const roundData = state.rounds[state.currentRound];
  if (!roundData) return 'empty';
  const pd = roundData.scores[player];
  if (!pd) return 'empty';
  const filled = pd.cards.filter(c => c.base !== '' || c.bonus !== '').length;
  if (filled === 0) return 'empty';
  if (filled < pd.cards.length) return 'partial';
  return 'done';
}

function renderPlayerTabs() {
  const tabs = document.getElementById('player-tabs');
  tabs.innerHTML = '';
  state.players.forEach((name, i) => {
    const status = getPlayerTabStatus(name);
    const btn = document.createElement('button');
    btn.className = 'player-tab' + (i === state.currentPlayer ? ' active' : '') + ' status-' + status;
    const dot = `<span class="tab-dot dot-${status}"></span>`;
    btn.innerHTML = dot + (name || `Gracz ${i + 1}`);
    btn.addEventListener('click', () => {
      state.currentPlayer = i;
      renderPlayerTabs();
      renderPlayerScore();
    });
    tabs.appendChild(btn);
  });
}

function renderPlayerScore() {
  const player = state.players[state.currentPlayer];
  const roundData = state.rounds[state.currentRound];
  const playerData = roundData.scores[player];

  document.getElementById('scoring-player-name').textContent =
    player || `Gracz ${state.currentPlayer + 1}`;

  const tbody = document.getElementById('score-tbody');
  tbody.innerHTML = '';

  playerData.cards.forEach((card, i) => {
    const total = calcCardTotal(card);
    const bonusNeg = card.bonus !== '' && parseFloat(card.bonus) < 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>Karta ${i + 1}</td>
      <td>
        <input class="input-score" type="number" inputmode="numeric"
          value="${card.base}" data-card="${i}" data-field="base"
          placeholder="0" min="-999" max="999">
      </td>
      <td>
        <div class="bonus-wrap">
          <button class="btn-sign ${bonusNeg ? 'is-neg' : ''}" data-card="${i}" title="Zmień znak">±</button>
          <input class="input-score bonus" type="number" inputmode="numeric"
            value="${card.bonus === '' ? '' : Math.abs(parseFloat(card.bonus) || 0)}"
            data-card="${i}" data-field="bonus"
            placeholder="0" min="0" max="999">
        </div>
      </td>
      <td class="cell-total ${total < 0 ? 'negative' : ''}">${total !== '' ? total : '—'}</td>
    `;
    tbody.appendChild(tr);
  });

  // Sign toggle buttons for bonus
  tbody.querySelectorAll('.btn-sign').forEach(btn => {
    btn.addEventListener('click', () => {
      const cardIdx = +btn.dataset.card;
      const player = state.players[state.currentPlayer];
      const playerData = state.rounds[state.currentRound].scores[player];
      const cur = parseFloat(playerData.cards[cardIdx].bonus) || 0;
      if (cur === 0 && playerData.cards[cardIdx].bonus === '') return;
      playerData.cards[cardIdx].bonus = String(-cur);
      btn.classList.toggle('is-neg', -cur < 0);
      // Update input display (always show abs value)
      const inp = tbody.querySelectorAll('tr')[cardIdx].querySelector('.input-score.bonus');
      if (inp) inp.value = cur === 0 ? '' : Math.abs(cur);
      // Refresh total
      const rows = tbody.querySelectorAll('tr');
      const total = calcCardTotal(playerData.cards[cardIdx]);
      const totalCell = rows[cardIdx].querySelector('.cell-total');
      totalCell.textContent = total !== '' ? total : '—';
      totalCell.classList.toggle('negative', total !== '' && total < 0);
      updateRoundTotal();
      renderPlayerTabs();
      saveState();
    });
  });

  // Extra card toggle button
  const hasExtra = playerData.cards.length > CARDS_PER_HAND;
  const extraBtn = document.getElementById('btn-extra-card');
  extraBtn.textContent = hasExtra ? '− Usuń 8. kartę' : '＋ Dodaj 8. kartę';
  extraBtn.classList.toggle('active-extra', hasExtra);

  updateRoundTotal();

  // Events
  tbody.querySelectorAll('.input-score').forEach(inp => {
    inp.addEventListener('input', e => onScoreInput(e));
    inp.addEventListener('focus', e => e.target.select());
  });
}

function calcCardTotal(card) {
  const b = card.base === '' ? 0 : parseFloat(card.base) || 0;
  const n = card.bonus === '' ? 0 : parseFloat(card.bonus) || 0;
  if (card.base === '' && card.bonus === '') return '';
  return b + n;
}

function getBonusSign(cardIdx) {
  const row = document.getElementById('score-tbody').querySelectorAll('tr')[cardIdx];
  return row && row.querySelector('.btn-sign.is-neg') ? -1 : 1;
}

function onScoreInput(e) {
  const inp = e.target;
  const cardIdx = +inp.dataset.card;
  const field = inp.dataset.field;
  const player = state.players[state.currentPlayer];
  const playerData = state.rounds[state.currentRound].scores[player];

  if (field === 'bonus' && inp.value !== '') {
    const sign = getBonusSign(cardIdx);
    playerData.cards[cardIdx][field] = String(sign * Math.abs(parseFloat(inp.value) || 0));
  } else {
    playerData.cards[cardIdx][field] = inp.value;
  }

  // Update this card's total cell
  const rows = document.getElementById('score-tbody').querySelectorAll('tr');
  const total = calcCardTotal(playerData.cards[cardIdx]);
  const totalCell = rows[cardIdx].querySelector('.cell-total');
  totalCell.textContent = total !== '' ? total : '—';
  totalCell.classList.toggle('negative', total !== '' && total < 0);

  // Refresh tab status dots
  renderPlayerTabs();

  updateRoundTotal();
  saveState();
}

function updateRoundTotal() {
  const player = state.players[state.currentPlayer];
  const playerData = state.rounds[state.currentRound].scores[player];

  let sum = 0;
  playerData.cards.forEach(card => {
    const t = calcCardTotal(card);
    if (t !== '') sum += t;
  });
  playerData.total = sum;

  document.getElementById('round-total').textContent = sum;
  document.getElementById('round-total').classList.toggle('negative', sum < 0);
  saveState();
}

// ===== SUMMARY SCREEN =====
function renderSummary() {
  renderLeaderboard();
  renderRoundsTable();
}

function getPlayerTotals() {
  const totals = {};
  state.players.forEach(p => { totals[p] = []; });
  state.rounds.forEach(round => {
    state.players.forEach(p => {
      totals[p].push(round.scores[p] ? round.scores[p].total : 0);
    });
  });
  return totals;
}

function renderLeaderboard() {
  const totals = getPlayerTotals();
  const sorted = state.players.map(p => ({
    name: p,
    rounds: totals[p],
    total: totals[p].reduce((a, b) => a + b, 0)
  })).sort((a, b) => b.total - a.total);

  const lb = document.getElementById('leaderboard');
  lb.innerHTML = '';

  sorted.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'leaderboard-row' + (i === 0 ? ' rank-1' : '');
    const medal = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
    const breakdown = entry.rounds.map((r, ri) => `R${ri + 1}: ${r}`).join(' · ');
    row.innerHTML = `
      <div class="rank-badge">${medal}</div>
      <div style="flex:1">
        <div class="leaderboard-name">${escHtml(entry.name || `Gracz ${i+1}`)}</div>
        <div class="rounds-breakdown">${breakdown}</div>
      </div>
      <div class="leaderboard-score">${entry.total}</div>
    `;
    lb.appendChild(row);
  });
}

function renderRoundsTable() {
  const totals = getPlayerTotals();
  const thead = document.getElementById('rounds-thead');
  const tbody = document.getElementById('rounds-tbody');
  const tfoot = document.getElementById('rounds-tfoot');

  // Header
  thead.innerHTML = '<th>Gracz</th>' +
    state.rounds.map((_, i) => `<th>Runda ${i + 1}</th>`).join('') +
    '<th>Łącznie</th>';

  // Body
  tbody.innerHTML = '';
  state.players.forEach(p => {
    const rounds = totals[p];
    const total = rounds.reduce((a, b) => a + b, 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escHtml(p || '?')}</td>` +
      rounds.map(r => `<td>${r}</td>`).join('') +
      `<td style="font-weight:700;color:var(--navy)">${total}</td>`;
    tbody.appendChild(tr);
  });

  // Footer (round sums)
  const roundSums = state.rounds.map((_, ri) =>
    state.players.reduce((sum, p) => sum + (totals[p][ri] || 0), 0)
  );
  const grandSum = roundSums.reduce((a, b) => a + b, 0);
  tfoot.innerHTML = '<td>Suma rund</td>' +
    roundSums.map(s => `<td>${s}</td>`).join('') +
    `<td>${grandSum}</td>`;
}

// ===== CONFIRM MODAL =====
function showModal(title, body, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('show');

  const btnOk = document.getElementById('modal-ok');
  const btnCancel = document.getElementById('modal-cancel');

  const close = () => overlay.classList.remove('show');

  const okHandler = () => { close(); onConfirm(); };
  btnOk.onclick = okHandler;
  btnCancel.onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
}

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== HELPERS =====
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===== OFFLINE BANNER =====
function updateOfflineBanner() {
  document.getElementById('offline-banner').classList.toggle('show', !navigator.onLine);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  // Offline
  window.addEventListener('online', updateOfflineBanner);
  window.addEventListener('offline', updateOfflineBanner);
  updateOfflineBanner();

  // Register SW
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // ===== SETUP SCREEN =====
  if (state.players.length < 2) {
    state.players = ['', ''];
    state.rounds = [];
    state.currentRound = 0;
    state.currentPlayer = 0;
    state.screen = 'setup';
  }

  document.getElementById('btn-add-player').addEventListener('click', () => {
    if (state.players.length < 6) {
      state.players.push('');
      saveState();
      renderSetup();
      // Focus new input
      const inputs = document.querySelectorAll('#players-list .input-text');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }
  });

  document.getElementById('btn-start').addEventListener('click', () => {
    // Validate
    const filled = state.players.filter(p => p.trim());
    if (filled.length < 2) {
      showToast('Podaj imiona co najmniej 2 graczy');
      return;
    }
    // Fill empty names
    state.players = state.players.map((p, i) => p.trim() || `Gracz ${i + 1}`);
    state.rounds = [];
    state.currentRound = 0;
    state.currentPlayer = 0;
    saveState();
    showScreen('scoring');
    renderScoring();
  });

  // ===== SCORING SCREEN =====
  document.getElementById('btn-extra-card').addEventListener('click', toggleExtraCard);

  document.getElementById('btn-next-round').addEventListener('click', () => {
    state.currentRound++;
    state.currentPlayer = 0;
    saveState();
    renderScoring();
    showToast(`Runda ${state.currentRound + 1} — wprowadź punkty`);
  });

  document.getElementById('btn-finish').addEventListener('click', () => {
    showModal(
      'Zakończyć grę?',
      'Przejdziesz do podsumowania. Będziesz mógł wrócić do punktacji.',
      () => {
        showScreen('summary');
        renderSummary();
      }
    );
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    showModal(
      'Nowa gra?',
      'Wszystkie wyniki zostaną usunięte i zaczniesz od nowa.',
      () => {
        state.players = ['', ''];
        state.rounds = [];
        state.currentRound = 0;
        state.currentPlayer = 0;
        saveState();
        showScreen('setup');
        renderSetup();
      }
    );
  });

  // ===== SUMMARY SCREEN =====
  document.getElementById('btn-back-scoring').addEventListener('click', () => {
    state.currentPlayer = 0;
    showScreen('scoring');
    renderScoring();
  });

  document.getElementById('btn-new-game-2').addEventListener('click', () => {
    showModal(
      'Nowa gra?',
      'Wszystkie wyniki zostaną usunięte i zaczniesz od nowa.',
      () => {
        state.players = ['', ''];
        state.rounds = [];
        state.currentRound = 0;
        state.currentPlayer = 0;
        saveState();
        showScreen('setup');
        renderSetup();
      }
    );
  });

  // ===== RESTORE STATE =====
  showScreen(state.screen || 'setup');
  if (state.screen === 'setup') renderSetup();
  if (state.screen === 'scoring') renderScoring();
  if (state.screen === 'summary') renderSummary();
});
