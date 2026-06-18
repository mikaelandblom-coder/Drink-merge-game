const SCORE_MAX = 8;

// Storage format: [{name: string, score: number}]
// Migrates old number-only format automatically.

function getScores(mapId) {
  try {
    const raw = JSON.parse(localStorage.getItem('mm_s_' + mapId) || '[]');
    return raw.map(e => (typeof e === 'number') ? { name: 'you', score: e } : e);
  } catch { return []; }
}

function saveScore(mapId, score, name = 'you') {
  if (!score) return { rank: 0, inTop: false };
  const list = getScores(mapId);
  const entry = { name, score };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, SCORE_MAX);
  localStorage.setItem('mm_s_' + mapId, JSON.stringify(trimmed));
  const idx = trimmed.indexOf(entry);
  return { rank: idx + 1, inTop: idx !== -1 };
}

function getBest(mapId) {
  const s = getScores(mapId);
  return s.length ? s[0].score : 0;
}
