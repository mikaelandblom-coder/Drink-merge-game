// Welcome screen — shown on load and when returning from game over.
// Depends on: MAPS (maps.js), getScores/saveScore/getBest (scores.js)
// Calls startGame(map) defined in game.js (available at click time).

function buildScoreRows(mapId) {
  const scores = getScores(mapId);
  if (!scores.length) return '<div class="card-no-scores">No scores yet</div>';
  return scores.map((e, i) =>
    `<div class="card-score-row">
       <span class="csr-rank">${i + 1}</span>
       <span class="csr-name">${e.name}</span>
       <span class="csr-val">${e.score.toLocaleString()}</span>
     </div>`
  ).join('');
}

function buildWelcomeCards() {
  return MAPS.map(map => {
    if (map.locked) {
      return `<div class="map-card locked">
        <div class="map-name">${map.label}</div>
        <div class="map-sub">${map.sublabel || ''}</div>
        <div class="map-soon">Coming soon</div>
      </div>`;
    }
    return `<div class="map-card" data-map="${map.id}">
      <div class="map-header">
        <div>
          <div class="map-name">${map.label}</div>
          <div class="map-sub">${map.sublabel || ''}</div>
        </div>
        <button class="play-btn" data-id="${map.id}">Play</button>
      </div>
      <div class="card-scores">
        <div class="card-scores-header">
          <span class="card-scores-title">Top scores</span>
          <button class="add-score-btn" data-id="${map.id}" title="Add a score">+ Add</button>
        </div>
        <div class="card-score-list" id="score-list-${map.id}">
          ${buildScoreRows(map.id)}
        </div>
        <form class="add-score-form" id="add-form-${map.id}" style="display:none">
          <input class="asf-name" type="text"   placeholder="Name"  maxlength="20" required>
          <input class="asf-score" type="number" placeholder="Score" min="1" required>
          <button type="submit" class="asf-save">Save</button>
          <button type="button" class="asf-cancel">Cancel</button>
        </form>
      </div>
    </div>`;
  }).join('');
}

function wireWelcomeEvents() {
  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.onclick = () => {
      const map = MAPS.find(m => m.id === btn.dataset.id);
      if (!map) return;
      document.getElementById('welcome').style.display = 'none';
      document.getElementById('wrap').style.display = 'flex';
      startGame(map);
    };
  });

  document.querySelectorAll('.add-score-btn').forEach(btn => {
    btn.onclick = () => {
      const form = document.getElementById('add-form-' + btn.dataset.id);
      const isOpen = form.style.display !== 'none';
      form.style.display = isOpen ? 'none' : 'flex';
      if (!isOpen) form.querySelector('.asf-name').focus();
    };
  });

  document.querySelectorAll('.add-score-form').forEach(form => {
    const mapId = form.id.replace('add-form-', '');
    form.onsubmit = e => {
      e.preventDefault();
      const name  = form.querySelector('.asf-name').value.trim();
      const score = parseInt(form.querySelector('.asf-score').value, 10);
      if (!name || !score) return;
      saveScore(mapId, score, name);
      form.style.display = 'none';
      form.reset();
      document.getElementById('score-list-' + mapId).innerHTML = buildScoreRows(mapId);
    };
    form.querySelector('.asf-cancel').onclick = () => {
      form.style.display = 'none';
      form.reset();
    };
  });
}

function showWelcome() {
  document.getElementById('map-cards').innerHTML = buildWelcomeCards();
  wireWelcomeEvents();
  document.getElementById('welcome').style.display = 'flex';
  document.getElementById('wrap').style.display = 'none';
  document.getElementById('over').style.display = 'none';
}

showWelcome();
