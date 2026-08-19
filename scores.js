const SCORE_MAX = 8;

// Every score the player reads — the coin pill, the record to beat, the score
// panel, the game-over recap, the menu cards — goes through here, so the HUD
// can never show two conventions at once. That was the actual bug: the coin
// count was drawn as a raw number while the "to beat" pill directly under it
// was already grouped, and the two sat 27px apart (Mikael, 2026-08-19).
//
// The separator is a fixed NO-BREAK SPACE (U+00A0), not `toLocaleString()`,
// which is what the rest of the game used to call. Two reasons to pin it:
// toLocaleString follows the BROWSER's locale, so the same run reads "2,150"
// on an English device and "2 150" on a Swedish one — and some locales group
// with a dot ("2.150"), which for a score is actively misleading. And the
// space has to be NO-BREAK or an HTML score can wrap mid-number at the gap.
function fmtScore(n) {
  return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

// Storage format per key: [{name: string, score: number}]
// Migrates old number-only entries automatically.
//
// Scores are kept separately for each play VARIANT (table size × combo
// multipliers). To avoid a migration that could disturb existing data, the
// DEFAULT variant of a map keeps the legacy key `mm_s_<mapId>` — so scores Mai
// already set (all on default selections) stay exactly where they are. Only
// variants that DIFFER from the map's defaults get a suffix noting what changed.
//
//   kyoto  default large+nocombo -> mm_s_kyoto           (legacy, preserved)
//          small+nocombo         -> mm_s_kyoto__small
//          large+combo           -> mm_s_kyoto__combo
//          small+combo           -> mm_s_kyoto__small_combo
//   teddy  default small+combo   -> mm_s_teddy           (legacy, preserved)
//          large+combo           -> mm_s_teddy__large
//          small+nocombo         -> mm_s_teddy__nocombo
//
// NOTE: this couples key identity to the map's current defaults — changing a
// map's defaultSize / combos default would re-point the legacy key. Defaults
// are stable, so this is intentional (and what keeps Mai's scores intact).
function scoreKey(map, size, combos, happyHour) {
  const parts = [];
  if (map.sizes) {
    const defSize = map.defaultSize || 'large';
    const s = size || defSize;
    if (s !== defSize) parts.push(s);
  }
  if (happyHour) {
    // Happy Hour implies combos-off, so the combo part is skipped entirely —
    // the variant is just size × happyhour (mm_s_kyoto__small_happyhour).
    parts.push('happyhour');
  } else {
    const defCombos = !!map.combos;
    const on = (combos === undefined) ? defCombos : !!combos;
    if (on !== defCombos) parts.push(on ? 'combo' : 'nocombo');
  }
  return 'mm_s_' + map.id + (parts.length ? '__' + parts.join('_') : '');
}

function getScores(key) {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return raw.map(e => (typeof e === 'number') ? { name: 'you', score: e } : e);
  } catch { return []; }
}

function saveScore(key, score, name = 'you') {
  if (!score) return { rank: 0, inTop: false };
  const list = getScores(key);
  const entry = { name, score };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, SCORE_MAX);
  localStorage.setItem(key, JSON.stringify(trimmed));
  const idx = trimmed.indexOf(entry);
  return { rank: idx + 1, inTop: idx !== -1 };
}
