// Tool switcher, shared by every tool in tools/.
//
// Each tool marks its mount point with data-toolnav="<its id>", e.g.
//   <div data-toolnav="hitbox"></div>
// and this fills it with pills for the other tools. Adding a fourth tool means
// one line in TOOLS below — nothing changes in the tools themselves.
//
// Tools open in the SAME tab (the point is fast back-and-forth), the game in a
// new one so you don't lose the tool you were in.
//
// Hrefs are written relative to the PROJECT ROOT, not to tools/, because every
// tool sets <base href="../"> so it can load config/*.js from the real project.

const TOOLS = [
  { id: 'sound',  href: 'tools/sound-lab.html',     icon: '🎛️', label: 'Sound',
    title: 'Sound lab — audition voices and wire them to maps' },
  { id: 'hitbox', href: 'tools/hitbox-editor.html', icon: '🎯', label: 'Hitboxes',
    title: 'Hitbox editor — map boundaries and item collision shapes' },
  { id: 'sprite', href: 'tools/sprite-editor.html', icon: '🖼️', label: 'Sprites',
    title: 'Sprite editor — extract an AI sheet, build a tier chain' },
  // `?dev=1` because anyone reaching the game FROM a tool is by definition a
  // dev: it unhides the welcome screen's Dev tools row (welcome.js), so the trip
  // back to a tool is one click instead of a retyped URL. It only ever adds that
  // link row, so it is harmless even when the tool is served from the live site.
  { id: 'game',   href: 'index.html?dev=1',          icon: '🎮', label: 'Game',
    title: 'Open the game (dev mode) in a new tab', ext: true },
];

// Stamp the tab icon from the SAME table that draws the pills, so a tool's
// identity is defined in exactly one place and a new tool needs nothing extra.
// An emoji-in-SVG data URI is fine for these desktop dev pages; the GAME still
// needs real PNGs, because iOS Safari ignores SVG/data-URI favicons (see the
// icon comment in index.html).
function setToolFavicon(icon) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
              '<text x="50" y="54" font-size="80" text-anchor="middle" ' +
              'dominant-baseline="central">' + icon + '</text></svg>';
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
}

(function mountToolNav() {
  const host = document.querySelector('[data-toolnav]');
  if (!host) return;
  const here = host.dataset.toolnav;
  const me = TOOLS.find(t => t.id === here);
  if (me) setToolFavicon(me.icon);
  host.classList.add('toolnav');
  host.innerHTML = TOOLS.map(t => {
    const cls = [t.id === here ? 'on' : '', t.ext ? 'ext' : ''].filter(Boolean).join(' ');
    const tgt = t.ext ? ' target="_blank" rel="noopener"' : '';
    // The current tool stays a link (harmless reload) rather than becoming a
    // dead span — keeps the row's markup and tab order uniform.
    return `<a href="${t.href}"${tgt} class="${cls}" title="${t.title}">` +
           `<span aria-hidden="true">${t.icon}</span>${t.label}</a>`;
  }).join('');
})();
