const SCORE_MAX = 8;

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
function scoreKey(map, size, combos) {
  const parts = [];
  if (map.sizes) {
    const defSize = map.defaultSize || 'large';
    const s = size || defSize;
    if (s !== defSize) parts.push(s);
  }
  const defCombos = !!map.combos;
  const on = (combos === undefined) ? defCombos : !!combos;
  if (on !== defCombos) parts.push(on ? 'combo' : 'nocombo');
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
