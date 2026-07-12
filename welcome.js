// Welcome screen — shown on load and when returning from game over.
// Depends on: MAPS (maps.js), getScores/scoreKey (scores.js)
// Calls startGame(map, opts) defined in game.js (available at click time).

// Size preference (large/small table framing) per map, remembered across visits.
// Only maps with a `sizes` field expose the checkbox; others ignore this.
function getMapSize(map) {
  if (!map.sizes) return null;
  const saved = localStorage.getItem('mm_size_' + map.id);
  return (saved === 'large' || saved === 'small') ? saved : (map.defaultSize || 'large');
}

function setMapSize(mapId, size) {
  localStorage.setItem('mm_size_' + mapId, size);
}

// Combo-multiplier preference per map, remembered across visits. Defaults to
// the map's built-in `combos` flag (on for Mage Tower & Plushie Factory).
function getMapCombos(map) {
  const saved = localStorage.getItem('mm_combos_' + map.id);
  return (saved === null) ? !!map.combos : saved === '1';
}

function setMapCombos(mapId, on) {
  localStorage.setItem('mm_combos_' + mapId, on ? '1' : '0');
}

// Happy Hour (orders mode) preference per map, remembered across visits.
// Always defaults OFF; turning it on forces combos off for the run (the combo
// checkbox is disabled while checked).
function getMapHH(map) {
  return localStorage.getItem('mm_hh_' + map.id) === '1';
}

function setMapHH(mapId, on) {
  localStorage.setItem('mm_hh_' + mapId, on ? '1' : '0');
}

// Every playable size/combo combination for a map, default first, each with a
// short label and its storage key. Maps without size variants only vary by
// combo (2 rows); size maps have 4.
function mapVariants(map) {
  const sizes = map.sizes
    ? [map.defaultSize || 'large', (map.defaultSize === 'small' ? 'large' : 'small')]
    : [null];
  const defCombo = !!map.combos;
  const combos = [defCombo, !defCombo];
  const out = [];
  for (const s of sizes) {
    for (const c of combos) {
      const parts = [];
      if (s) parts.push(s === 'large' ? 'Large' : 'Small');
      parts.push(c ? 'Combo' : 'No combo');
      out.push({ key: scoreKey(map, s, c), label: parts.join(' · ') });
    }
    // Happy Hour is its own variant per size (combos are always off in it).
    const hhLabel = (s ? (s === 'large' ? 'Large · ' : 'Small · ') : '') + 'Happy Hour';
    out.push({ key: scoreKey(map, s, false, true), label: hhLabel });
  }
  return out;
}

// All variants are shown at once (no player names — these are local scores), so
// every high score is visible without toggling. The row matching the current
// selection is highlighted; refreshScoreList() moves that highlight on toggle.
function buildScoreRows(map) {
  const activeKey = scoreKey(map, getMapSize(map), getMapCombos(map), getMapHH(map));
  return mapVariants(map).map(v => {
    const top = getScores(v.key).slice(0, 3);
    const vals = top.length
      ? top.map(e => e.score.toLocaleString()).join('<span class="csr-sep">·</span>')
      : '<span class="csr-empty">—</span>';
    return `<div class="csr-variant${v.key === activeKey ? ' active' : ''}">
       <span class="cv-label">${v.label}</span>
       <span class="cv-scores">${vals}</span>
     </div>`;
  }).join('');
}

// Re-render one card's score list so the active-variant highlight follows the
// current selection.
function refreshScoreList(map) {
  const el = document.getElementById('score-list-' + map.id);
  if (el) el.innerHTML = buildScoreRows(map);
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
    const sizeToggle = map.sizes
      ? `<label class="map-opt-toggle" title="Larger table = bigger play area on screen">
           <input type="checkbox" class="map-size-cb" data-id="${map.id}"
                  ${getMapSize(map) === 'large' ? 'checked' : ''}>
           <span>Large table</span>
         </label>`
      : '';
    const comboToggle =
      `<label class="map-opt-toggle" title="Chain merges quickly for score multipliers">
         <input type="checkbox" class="map-combo-cb" data-id="${map.id}"
                ${getMapCombos(map) ? 'checked' : ''} ${getMapHH(map) ? 'disabled' : ''}>
         <span>Combo multipliers</span>
       </label>`;
    const hhToggle =
      `<label class="map-opt-toggle" title="Customers order drinks off your table — serve them for coins and merge the receipts">
         <input type="checkbox" class="map-hh-cb" data-id="${map.id}"
                ${getMapHH(map) ? 'checked' : ''}>
         <span>Happy Hour</span>
       </label>`;
    return `<div class="map-card" data-map="${map.id}">
      <div class="map-header">
        <div>
          <div class="map-name">${map.label}</div>
          <div class="map-sub">${map.sublabel || ''}</div>
        </div>
        <button class="play-btn" data-id="${map.id}">Play</button>
      </div>
      <div class="map-options">${sizeToggle}${comboToggle}${hhToggle}</div>
      <div class="card-scores">
        <div class="card-scores-header">
          <span class="card-scores-title">Top scores</span>
        </div>
        <div class="card-score-list" id="score-list-${map.id}">
          ${buildScoreRows(map)}
        </div>
      </div>
    </div>`;
  }).join('');
}

function wireWelcomeEvents() {
  document.querySelectorAll('.map-size-cb').forEach(cb => {
    const map = MAPS.find(m => m.id === cb.dataset.id);
    // Clicks on the toggle shouldn't bubble up and trigger a card-level action.
    cb.onclick = e => e.stopPropagation();
    cb.onchange = () => {
      setMapSize(cb.dataset.id, cb.checked ? 'large' : 'small');
      refreshScoreList(map);   // show the newly-selected variant's scores
    };
  });

  document.querySelectorAll('.map-combo-cb').forEach(cb => {
    const map = MAPS.find(m => m.id === cb.dataset.id);
    cb.onclick = e => e.stopPropagation();
    cb.onchange = () => {
      setMapCombos(cb.dataset.id, cb.checked);
      refreshScoreList(map);
    };
  });

  document.querySelectorAll('.map-hh-cb').forEach(cb => {
    const map = MAPS.find(m => m.id === cb.dataset.id);
    cb.onclick = e => e.stopPropagation();
    cb.onchange = () => {
      setMapHH(cb.dataset.id, cb.checked);
      // Happy Hour runs without combo multipliers — grey the combo toggle out
      // while it's on (the saved combo preference is kept for when it's off).
      const comboCb = document.querySelector(`.map-combo-cb[data-id="${cb.dataset.id}"]`);
      if (comboCb) comboCb.disabled = cb.checked;
      refreshScoreList(map);
    };
  });

  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.onclick = () => {
      const map = MAPS.find(m => m.id === btn.dataset.id);
      if (!map) return;
      document.getElementById('welcome').style.display = 'none';
      document.getElementById('wrap').style.display = 'flex';
      startGame(map, { size: getMapSize(map), combos: getMapCombos(map),
                       happyHour: getMapHH(map) });
    };
  });
}

function showWelcome() {
  document.getElementById('map-cards').innerHTML = buildWelcomeCards();
  document.getElementById('welcome-version').textContent = GAME_VERSION;
  // Cool mode is shelved for now — its checkbox is commented out in index.html.
  // Restore both together (startGame reads the saved value per run in game.js).
  // const coolCb = document.getElementById('cool-cb');
  // coolCb.checked = localStorage.getItem('mm_cool') === '1';
  // coolCb.onchange = () => localStorage.setItem('mm_cool', coolCb.checked ? '1' : '0');
  wireWelcomeEvents();
  document.getElementById('welcome').style.display = 'flex';
  document.getElementById('wrap').style.display = 'none';
  document.getElementById('over').style.display = 'none';
}

showWelcome();
