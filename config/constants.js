// Deploy date — bump to today's date on every deploy so players can confirm
// they're on the latest build just by comparing dates. Shown on the welcome
// screen; bump the ?v= cache-buster in index.html at the same time.
const GAME_VERSION = 'v2026-07-05';

// Fixed physics world dimensions. All other files read these.
const W = 420;
const H = 620;

// Active item set — reassigned by startGame() when a map is selected.
// Declared with var so it is a true global writable from any script.
var ITEMS = [];
