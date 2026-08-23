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

// Rapid fire (quick mode) preference per map, remembered across visits. Always
// defaults OFF. Mutually exclusive with Happy Hour, and it forces combos ON —
// both enforced in startGame, so a stale preference can never produce a
// combination the menu would not let you tick.
function getMapRapid(map) {
  return localStorage.getItem('mm_rapid_' + map.id) === '1';
}

function setMapRapid(mapId, on) {
  localStorage.setItem('mm_rapid_' + mapId, on ? '1' : '0');
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
    // Happy Hour and Rapid fire are each their own variant per size — combos
    // are pinned in both (off / on respectively), so neither multiplies out.
    const prefix = s ? (s === 'large' ? 'Large · ' : 'Small · ') : '';
    out.push({ key: scoreKey(map, s, false, true), label: prefix + 'Happy Hour' });
    out.push({ key: scoreKey(map, s, true, false, true), label: prefix + 'Rapid fire' });
  }
  return out;
}

// All variants are shown at once (no player names — these are local scores), so
// every high score is visible without toggling. The row matching the current
// selection is highlighted; refreshScoreList() moves that highlight on toggle.
function buildScoreRows(map) {
  const activeKey = scoreKey(map, getMapSize(map), getMapCombos(map),
                             getMapHH(map), getMapRapid(map));
  return mapVariants(map).map(v => {
    const top = getScores(v.key).slice(0, 3);
    // The row's BEST is marked up separately (.cv-top): it is the number the
    // player is chasing, and the two behind it are context.
    const vals = top.length
      ? top.map((e, i) => i === 0
            ? `<span class="cv-top">${fmtScore(e.score)}</span>`
            : fmtScore(e.score)).join('<span class="csr-sep">·</span>')
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

// One line describing a parked run, so Continue is never a blind choice: the
// variant it was played on (which the checkboxes below no longer control) and
// the score it stands at.
function savedRunLabel(map, s) {
  const bits = [];
  if (map.sizes && s.size) bits.push(s.size === 'large' ? 'Large' : 'Small');
  if (s.rapid) bits.push('Rapid fire');
  else if (s.happyHour) bits.push('Happy Hour');
  else if (s.combos) bits.push('Combo');
  bits.push(fmtScore(s.score || 0) + ' coins');
  return bits.join(' · ');
}

function buildWelcomeCards() {
  return MAPS.map(map => {
    if (map.locked) {
      // No art band: a locked map is locked precisely because its art isn't in
      // yet, so there is nothing to crop a strip from.
      return `<div class="map-card locked">
        <div class="map-body">
          <div class="map-name">${map.label}</div>
          <div class="map-sub">${map.sublabel || ''}</div>
          <div class="map-soon">Coming soon</div>
        </div>
      </div>`;
    }
    const sizeToggle = map.sizes
      ? `<label class="map-opt-toggle" title="Larger table = bigger play area on screen">
           <input type="checkbox" class="map-size-cb" data-id="${map.id}"
                  ${getMapSize(map) === 'large' ? 'checked' : ''}>
           <span>Large table</span>
         </label>`
      : '';
    // Rapid pins combos ON and Happy Hour pins them OFF, so the combo box shows
    // the pinned value and greys out under either — it never claims a setting
    // the run will not use.
    const rapid = getMapRapid(map), hh = getMapHH(map);
    const comboOn = rapid ? true : hh ? false : getMapCombos(map);
    const comboToggle =
      `<label class="map-opt-toggle" title="Chain merges quickly for score multipliers">
         <input type="checkbox" class="map-combo-cb" data-id="${map.id}"
                ${comboOn ? 'checked' : ''} ${(hh || rapid) ? 'disabled' : ''}>
         <span>Combo multipliers</span>
       </label>`;
    const rapidToggle =
      `<label class="map-opt-toggle" title="The launcher fires itself, faster and faster — steer it and keep the chain alive. A short run.">
         <input type="checkbox" class="map-rapid-cb" data-id="${map.id}"
                ${rapid ? 'checked' : ''} ${hh ? 'disabled' : ''}>
         <span>Rapid fire</span>
       </label>`;
    const hhToggle =
      `<label class="map-opt-toggle" title="Customers order drinks off your table — serve them for coins and merge the receipts">
         <input type="checkbox" class="map-hh-cb" data-id="${map.id}"
                ${hh ? 'checked' : ''} ${rapid ? 'disabled' : ''}>
         <span>Happy Hour</span>
       </label>`;
    // A parked run (suspend.js) turns the single Play button into Continue +
    // New run, and adds a line saying what is waiting. There is one save per
    // map, and it remembers its own variant — so the option checkboxes below
    // describe a NEW run only, and Continue ignores them.
    const saved   = SUSPEND.load(map.id);
    const savedRow = saved
      ? `<div class="map-saved">Run in progress · ${savedRunLabel(map, saved)}</div>`
      : '';
    const playBtns = saved
      ? `<div class="play-stack">
           <button class="play-btn" data-id="${map.id}" data-resume="1">Continue</button>
           <button class="play-btn ghost" data-id="${map.id}">New run</button>
         </div>`
      : `<button class="play-btn" data-id="${map.id}">Play</button>`;
    // The card wears a strip of the map's own backdrop (config/maps.js `card:`,
    // cropped by compress_backgrounds.py from the band above its horizon) with
    // the name and Play button sitting on it. An <img> rather than a CSS
    // background because only an <img> can be lazy: ten cards is ~300 KB of art
    // and the menu's whole first load is under 400 KB (CLAUDE.md "Bandwidth"),
    // so the ones below the fold must not be fetched until they're scrolled to.
    // `.map-art` keeps its layout box with no image, so a map without `card:`
    // just gets the plain header this card used to have.
    const art = map.card
      ? `<img class="map-art-img" src="${map.card}" alt="" loading="lazy" decoding="async">`
      : '';
    return `<div class="map-card${map.card ? ' has-art' : ''}" data-map="${map.id}">
      <div class="map-art">
        ${art}
        <div class="map-header">
          <div>
            <div class="map-name">${map.label}<span class="map-level">Lv ${Progress.level(map.id)}</span></div>
            <div class="map-sub">${map.sublabel || ''}</div>
          </div>
          ${playBtns}
        </div>
      </div>
      <div class="map-body">
        ${savedRow}
        <div class="map-options">${sizeToggle}${comboToggle}${hhToggle}${rapidToggle}</div>
        <div class="card-scores">
          <div class="card-scores-header">
            <span class="card-scores-title">Top scores</span>
          </div>
          <div class="card-score-list" id="score-list-${map.id}">
            ${buildScoreRows(map)}
          </div>
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
      syncModeToggles(map);
      refreshScoreList(map);
    };
  });

  document.querySelectorAll('.map-rapid-cb').forEach(cb => {
    const map = MAPS.find(m => m.id === cb.dataset.id);
    cb.onclick = e => e.stopPropagation();
    cb.onchange = () => {
      setMapRapid(cb.dataset.id, cb.checked);
      syncModeToggles(map);
      refreshScoreList(map);
    };
  });

  // Happy Hour and Rapid fire each pin the combo setting and exclude the other,
  // so one pass re-derives all three boxes from the stored preferences. Doing it
  // in one place is what keeps the menu agreeing with startGame, which enforces
  // the same exclusions independently.
  function syncModeToggles(map) {
    const rapid = getMapRapid(map), hh = getMapHH(map);
    const q = sel => document.querySelector(`${sel}[data-id="${map.id}"]`);
    const comboCb = q('.map-combo-cb'), hhCb = q('.map-hh-cb'), rapidCb = q('.map-rapid-cb');
    if (comboCb) {
      comboCb.disabled = hh || rapid;
      // The saved combo preference is untouched — it comes back when the run
      // is a plain one again.
      comboCb.checked  = rapid ? true : hh ? false : getMapCombos(map);
    }
    if (hhCb)    hhCb.disabled    = rapid;
    if (rapidCb) rapidCb.disabled = hh;
  }

  document.querySelectorAll('.play-btn').forEach(btn => {
    btn.onclick = () => {
      const map = MAPS.find(m => m.id === btn.dataset.id);
      if (!map) return;
      if (btn.dataset.resume) { launchMap(map, SUSPEND.load(map.id)); return; }
      // Starting fresh throws away a parked run, so it asks first — one mistap
      // on a card should never cost a board someone was mid-way through.
      const saved = SUSPEND.load(map.id);
      if (saved) confirmNewRun(map, saved); else launchMap(map, null);
    };
  });
}

// resume: a payload from SUSPEND.load, or null for a fresh run.
function launchMap(map, resume) {
  document.getElementById('welcome').style.display = 'none';
  document.getElementById('wrap').style.display = 'flex';
  // A resumed run replays the variant it was SAVED on, not whatever the
  // checkboxes read now: the parked board was traced against that framing's
  // boundary, and its receipts/customers only exist in Happy Hour.
  const opts = resume
    ? { size: resume.size, combos: !!resume.combos, happyHour: !!resume.happyHour,
        rapid: !!resume.rapid, resume }
    : { size: getMapSize(map), combos: getMapCombos(map),
        happyHour: getMapHH(map), rapid: getMapRapid(map) };
  startGame(map, opts);
}

// Discard-confirm for New run. Static markup outside #map-cards (like the
// backup panel), so it survives showWelcome()'s rebuild and is wired once.
function confirmNewRun(map, saved) {
  const panel = document.getElementById('confirm-new');
  document.getElementById('confirm-new-sub').textContent =
    `Your run on ${map.label} (${savedRunLabel(map, saved)}) will be lost.`;
  panel.style.display = 'flex';
  document.getElementById('confirm-new-yes').onclick = () => {
    panel.style.display = 'none';
    SUSPEND.clear(map.id);
    launchMap(map, null);
  };
  document.getElementById('confirm-new-no').onclick = () => {
    panel.style.display = 'none';
  };
}

function showWelcome() {
  document.getElementById('map-cards').innerHTML = buildWelcomeCards();
  document.getElementById('welcome-version').textContent = GAME_VERSION;
  document.getElementById('welcome-level').textContent =
    'Player level ' + Progress.totalLevel();
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

// ---------- Backup & transfer (progress.js codes) ----------
// The panel is static HTML outside #map-cards, so it's wired ONCE here — not
// per showWelcome() rebuild.
function wireBackup() {
  const panel  = document.getElementById('backup-panel');
  const code   = document.getElementById('backup-code');
  const status = document.getElementById('backup-status');
  const setStatus = (msg, err) => {
    status.textContent = msg;
    status.className = err ? 'err' : '';
  };

  document.getElementById('backup-toggle').onclick = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) { code.value = Progress.exportCode(); setStatus(''); }
  };

  document.getElementById('backup-copy').onclick = async () => {
    code.value = Progress.exportCode();   // regenerate: XP may have grown
    try {
      await navigator.clipboard.writeText(code.value);
      setStatus('Copied! Paste it on the other device under Backup & transfer.');
    } catch {
      // Clipboard API needs a secure context / permission — fall back to
      // selecting the text so a manual Ctrl/Cmd-C works.
      code.focus(); code.select();
      setStatus('Press Ctrl+C (or long-press) to copy the selected code.');
    }
  };

  document.getElementById('backup-import').onclick = () => {
    const val = code.value.trim();
    if (!val) { setStatus('Paste a code into the box first.', true); return; }
    if (val === Progress.exportCode()) {
      setStatus('That\'s this device\'s own code — paste one from another device.', true);
      return;
    }
    try {
      const r = Progress.importCode(val);
      setStatus(r.mapsUp || r.boardsUp
        ? `Imported! ${r.mapsUp} map${r.mapsUp === 1 ? '' : 's'} gained XP, ${r.boardsUp} score board${r.boardsUp === 1 ? '' : 's'} updated.`
        : 'Code accepted — this device already had everything in it.');
      showWelcome();   // refresh badges, total level and score lists
    } catch (e) {
      setStatus(e.message, true);
    }
  };
}
wireBackup();

// ---------- Credits ----------
// Static HTML outside #map-cards, so wired ONCE here like wireBackup().
function wireCredits() {
  const panel = document.getElementById('credits-panel');
  document.getElementById('credits-toggle').onclick = () => {
    panel.hidden = !panel.hidden;
  };
}
wireCredits();

// Dev tools row: only where Mikael is actually developing. The tools live in
// the repo, so they deploy alongside the game — this gate, not their absence,
// is what keeps them off Mai's menu. `?dev=1` is the escape hatch for reaching
// them from a phone/tablet pointed at the dev server (or deliberately on the
// live site); it shows a link row and nothing more, so it is safe to leave in.
(function showDevTools() {
  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '';
  if (!local && !/[?&]dev=1(&|$)/.test(location.search)) return;
  const box = document.getElementById('devtools-box');
  if (box) box.hidden = false;
})();

// Async safety-net recovery (IndexedDB mirror) or an import can change levels
// after first paint — refresh the visible menu when that happens.
Progress.onChange = () => {
  if (document.getElementById('welcome').style.display !== 'none') showWelcome();
};

showWelcome();
