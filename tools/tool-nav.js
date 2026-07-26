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
  { id: 'game',   href: 'index.html',                icon: '🎮', label: 'Game',
    title: 'Open the game in a new tab', ext: true },
];

(function mountToolNav() {
  const host = document.querySelector('[data-toolnav]');
  if (!host) return;
  const here = host.dataset.toolnav;
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
