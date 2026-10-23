/*
 * Footebas film kit. Everything here is a pure function of timeline time, so
 * HyperFrames can seek any frame on its own:
 *   - Framer Motion springs (stiffness / damping / mass) solved in closed
 *     form and handed to GSAP as an ease plus the spring's settle time;
 *   - the game's pixel sprites (apps/web/components/retro/sprites.tsx grids);
 *   - pixel titles: Press Start 2P draws accented capitals as lowercase, so
 *     big titles get the accent drawn in pixels above the capital;
 *   - a pixel hand cursor and small timeline helpers (click, count, flicker).
 */
(function () {
  'use strict';
  const FB = (window.FB = {});

  /* ------------------------------------------------------------ springs */

  /** Position of a 0 -> 1 spring at time t (s), Framer Motion's model. */
  function springAt(t, k, c, m, v0) {
    const w0 = Math.sqrt(k / m);
    const zeta = c / (2 * Math.sqrt(k * m));
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const env = Math.exp(-zeta * w0 * t);
      return 1 + env * (-Math.cos(wd * t) + ((v0 - zeta * w0) / wd) * Math.sin(wd * t));
    }
    if (zeta === 1) return 1 + Math.exp(-w0 * t) * (-1 + (v0 - w0) * t);
    const s = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - s);
    const r2 = -w0 * (zeta + s);
    const c2 = (v0 + r1) / (r2 - r1);
    const c1 = -1 - c2;
    return 1 + c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  }

  const springCache = new Map();

  /**
   * GSAP ease + duration for a Framer Motion spring. The duration is the
   * time after which the spring stays within `rest` of its target.
   */
  FB.spring = function spring(opts) {
    const k = opts.stiffness ?? 100;
    const c = opts.damping ?? 10;
    const m = opts.mass ?? 1;
    const v0 = opts.velocity ?? 0;
    const rest = opts.rest ?? 0.002;
    const key = [k, c, m, v0, rest].join('|');
    if (springCache.has(key)) return springCache.get(key);
    let last = 0;
    for (let t = 0; t <= 6; t += 0.001) {
      if (Math.abs(springAt(t, k, c, m, v0) - 1) >= rest) last = t;
    }
    const duration = Math.max(0.05, last + 0.001);
    const ease = (p) => (p >= 1 ? 1 : springAt(p * duration, k, c, m, v0));
    const out = { ease, duration, zeta: c / (2 * Math.sqrt(k * m)) };
    springCache.set(key, out);
    return out;
  };

  /** Presets from SPEC.md (MOTION). */
  FB.springs = {
    ui: FB.spring({ stiffness: 420, damping: 34 }),
    layout: FB.spring({ stiffness: 300, damping: 30 }),
    pop: FB.spring({ stiffness: 600, damping: 22 }),
    soft: FB.spring({ stiffness: 170, damping: 26 }),
  };

  /** tl.fromTo with a spring: duration comes from the physics. */
  FB.springTo = function springTo(tl, target, from, to, at, preset) {
    const s = typeof preset === 'string' ? FB.springs[preset] : preset || FB.springs.ui;
    return tl.fromTo(target, from, Object.assign({ duration: s.duration, ease: s.ease }, to), at);
  };

  /* ------------------------------------------------------------ randomness */

  /** Seeded PRNG (mulberry32): deterministic "randomness" for confetti etc. */
  FB.rng = function rng(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ------------------------------------------------------------ sprites */

  const INK = '#15201a';
  const CHALK = '#f4efe2';

  /** Character grids copied from apps/web/components/retro/sprites.tsx. */
  const SPRITES = {
    ball: {
      grid: ['...kkkk...', '.kkwwwwkk.', '.kwwkkwwk.', 'kwwkkkkwwk', 'kwkkwwkkwk', 'kwkkwwkkwk', 'kwwkkkkwwk', '.kwwkkwwk.', '.kkwwwwkk.', '...kkkk...'],
      palette: { k: INK, w: CHALK },
    },
    whistle: {
      grid: ['..........', '..kkkkkk..', '.kssssssk.', 'kssskksssk', 'kssskksssk', 'kssssssssk', '.kssssssk.', '..kkkkkk..', '.....kk...', '......k...'],
      palette: { k: INK, s: '#c0c7d0' },
    },
    trophy: {
      grid: ['.kkkkkkkk.', 'kygggggygk', 'kygggggygk', 'kkgggggkk.', '..kgggk...', '...kgk....', '...kgk....', '..kgggk...', '.kgggggk..', '.kkkkkkk..'],
      palette: { k: INK, g: '#ffd23f', y: '#ffe88a' },
    },
    cardYellow: {
      grid: ['.kkkkkk.', 'kcccccck', 'kcccccck', 'kcccccck', 'kcccccck', 'kcccccck', 'kcccccck', 'kcccccck', 'kcccccck', '.kkkkkk.'],
      palette: { k: INK, c: '#ffd23f' },
    },
    star: {
      grid: ['....k....', '...kyk...', '...kyk...', 'kkkkyykkk', '.kyyyyyk.', '..kyyyk..', '..kyyyk..', '.kyykyyk.', 'kk.....kk'],
      palette: { k: INK, y: '#ffd23f' },
    },
    heart: {
      grid: ['.kk..kk.', 'krrkkrrk', 'krrrrrrk', 'krrrrrrk', '.krrrrk.', '..krrk..', '...kk...'],
      palette: { k: INK, r: '#c8322b' },
    },
    arrow: {
      grid: ['k.....', 'kk....', 'kyk...', 'kyyk..', 'kyyyk.', 'kyyyyk', 'kyyyk.', 'kyyk..', 'kyk...', 'kk....', 'k.....'],
      palette: { k: INK, y: CHALK },
    },
    coin: {
      grid: ['..kkkk..', '.kyyyyk.', 'kyykkyyk', 'kyykyyyk', 'kyykyyyk', 'kyykkyyk', '.kyyyyk.', '..kkkk..'],
      palette: { k: INK, y: '#ffd23f' },
    },
    /* Film-only marks in the text colour: up, down and a square lamp. */
    up: { grid: ['...k...', '..kkk..', '.kkkkk.', 'kkkkkkk'], palette: { k: 'currentColor' } },
    down: { grid: ['kkkkkkk', '.kkkkk.', '..kkk..', '...k...'], palette: { k: 'currentColor' } },
    lamp: { grid: ['kkkkk', 'kkkkk', 'kkkkk', 'kkkkk', 'kkkkk'], palette: { k: 'currentColor' } },
    /* Film-only: a pointing hand cursor drawn on the same grid style. */
    hand: {
      grid: [
        '....kk......',
        '...kwwk.....',
        '...kwwk.....',
        '...kwwk.....',
        '...kwwkkk...',
        '...kwwkwwkk.',
        '.kkkwwkwwkwk',
        'kwwkwwwwwkwk',
        'kwwwwwwwwwwk',
        '.kwwwwwwwwwk',
        '..kwwwwwwwwk',
        '..kwwwwwwwk.',
        '...kwwwwwwk.',
        '...kwwwwwwk.',
        '....kkkkkk..',
      ],
      palette: { k: INK, w: CHALK },
    },
    /* Film-only: closed hand for dragging. */
    grab: {
      grid: [
        '............',
        '............',
        '............',
        '............',
        '...kk.kk....',
        '..kwwkwwkk..',
        '.kkwwkwwkwk.',
        'kwwkwwwwwkwk',
        'kwwwwwwwwwwk',
        '.kwwwwwwwwwk',
        '..kwwwwwwwwk',
        '..kwwwwwwwk.',
        '...kwwwwwwk.',
        '...kwwwwwwk.',
        '....kkkkkk..',
      ],
      palette: { k: INK, w: CHALK },
    },
  };

  /** SVG markup of a sprite; `px` is the size of one art pixel. */
  FB.sprite = function sprite(name, px, extraPalette) {
    const s = SPRITES[name];
    const palette = Object.assign({}, s.palette, extraPalette || {});
    const rows = s.grid.length;
    const cols = s.grid[0].length;
    let rects = '';
    s.grid.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const fill = palette[ch];
        if (fill) rects += `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
      });
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" width="${cols * px}" height="${rows * px}" shape-rendering="crispEdges" style="display:block">${rects}</svg>`;
  };

  /** Fills every `[data-sprite]` element with its sprite (data-px = art pixel). */
  FB.mountSprites = function mountSprites(root) {
    (root || document).querySelectorAll('[data-sprite]').forEach((el) => {
      if (el.dataset.mounted) return;
      el.innerHTML = FB.sprite(el.dataset.sprite, Number(el.dataset.px || 4));
      el.dataset.mounted = '1';
    });
  };

  /* ------------------------------------------------------------ pixel titles */

  /* Accents on an 8 x 2 grid that sits above the 7-row capital. */
  const ACCENTS = {
    acute: [[4, 0], [5, 0], [3, 1], [4, 1]],
    grave: [[2, 0], [3, 0], [3, 1], [4, 1]],
    circ: [[3, 0], [4, 0], [2, 1], [5, 1]],
    tilde: [[2, 0], [3, 0], [6, 0], [1, 1], [4, 1], [5, 1]],
  };
  const ACCENTED = {
    'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
    'É': ['E', 'acute'], 'Ê': ['E', 'circ'], 'Í': ['I', 'acute'],
    'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'],
  };

  function accentSvg(kind) {
    const rects = ACCENTS[kind].map(([x, y]) => `<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`).join('');
    return `<svg class="px-acc" viewBox="0 0 8 3" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" style="position:absolute;left:0;top:-0.375em;width:1em;height:0.375em;fill:currentColor;overflow:visible">${rects}</svg>`;
  }

  /**
   * Splits an element's text into per-letter boxes (class "ch") so letters
   * can be animated, drawing accents on capitals in pixels. Words are kept
   * together in "w" boxes so lines only break between words. The boxes are
   * custom elements, so a scene's `.label span` rules never restyle them.
   */
  FB.pixelTitle = function pixelTitle(el) {
    if (el.dataset.split) return [...el.querySelectorAll('.ch')];
    // Uppercase here so CSS-uppercased labels get the pixel accents too.
    const upper = getComputedStyle(el).textTransform === 'uppercase';
    const text = upper ? el.textContent.toUpperCase() : el.textContent;
    el.textContent = '';
    el.setAttribute('aria-label', text);
    const words = text.split(' ');
    words.forEach((word, wi) => {
      const w = document.createElement('px-w');
      w.className = 'w';
      w.style.display = 'inline-block';
      w.style.whiteSpace = 'nowrap';
      [...word].forEach((ch) => {
        const s = document.createElement('px-c');
        s.className = 'ch';
        s.style.display = 'inline-block';
        s.style.position = 'relative';
        s.style.lineHeight = '1';
        const acc = ACCENTED[ch];
        if (acc) {
          s.textContent = acc[0];
          s.insertAdjacentHTML('beforeend', accentSvg(acc[1]));
        } else s.textContent = ch;
        w.appendChild(s);
      });
      el.appendChild(w);
      if (wi < words.length - 1) {
        const sp = document.createElement('px-c');
        sp.className = 'ch sp';
        sp.style.display = 'inline-block';
        sp.innerHTML = '&nbsp;';
        el.appendChild(sp);
      }
    });
    el.dataset.split = '1';
    return [...el.querySelectorAll('.ch')];
  };

  /**
   * The pixel font squeezes accented capitals into its 8 px cell. Every
   * uppercase pixel-font label under root that holds one is redrawn with
   * full-height capitals and pixel accents.
   */
  FB.pixelAccents = function pixelAccents(root) {
    root.querySelectorAll('*').forEach((el) => {
      if (el.children.length || el.dataset.split || el.closest('svg')) return;
      const cs = getComputedStyle(el);
      if (cs.textTransform !== 'uppercase' || !cs.fontFamily.includes('Press Start 2P')) return;
      if (![...el.textContent.toUpperCase()].some((ch) => ACCENTED[ch])) return;
      FB.pixelTitle(el);
    });
  };

  /* ------------------------------------------------------------ helpers */

  /**
   * Stepped letter drop (landing's lp-title: 0.6 s, steps(4)), letters `gap`
   * seconds apart. Returns the time the last letter lands.
   */
  FB.dropLetters = function dropLetters(tl, letters, at, opts) {
    const o = Object.assign({ gap: 2 / 30, dur: 0.6, rise: 1.2 }, opts || {});
    // The landing's four steps, but the first one shows on the letter's own
    // frame (steps(4) would hold it invisible for a quarter of the drop).
    const dur = (o.dur * 3) / 4;
    const ease = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : (Math.floor(p * 3) + 1) / 4);
    letters.forEach((ch, i) => {
      tl.fromTo(ch, { opacity: 0, yPercent: -o.rise * 100 }, { opacity: 1, yPercent: 0, duration: dur, ease }, at + i * o.gap);
    });
    return at + (letters.length - 1) * o.gap + dur;
  };

  /** Letters light up one by one like scoreboard bulbs (no motion). */
  FB.lightLetters = function lightLetters(tl, letters, at, gap) {
    letters.forEach((ch, i) => {
      tl.fromTo(ch, { opacity: 0 }, { opacity: 1, duration: 1 / 30, ease: 'steps(1)' }, at + i * (gap ?? 2 / 30));
    });
    return at + letters.length * (gap ?? 2 / 30);
  };

  /** LED flicker when a digit changes (landing's lp-flicker, 0.4 s, steps). */
  FB.flicker = function flicker(tl, el, at) {
    const o = { immediateRender: false, ease: 'steps(1)', duration: 2 / 30 };
    tl.fromTo(el, { opacity: 1 }, Object.assign({ opacity: 0.2 }, o), at);
    tl.fromTo(el, { opacity: 0.2 }, Object.assign({ opacity: 1 }, o), at + 2 / 30);
    tl.fromTo(el, { opacity: 1 }, Object.assign({ opacity: 0.2 }, o), at + 4 / 30);
    tl.fromTo(el, { opacity: 0.2 }, Object.assign({ opacity: 1 }, o), at + 6 / 30);
  };

  /** Swaps text at a time, both ways (safe under seeking in any direction). */
  FB.setText = function setText(tl, el, before, after, at) {
    const proxy = { v: 0 };
    tl.fromTo(proxy, { v: 0 }, {
      v: 1,
      duration: 1 / 60,
      ease: 'none',
      immediateRender: false,
      onUpdate() { el.textContent = proxy.v >= 1 ? after : before; },
      onReverseComplete() { el.textContent = before; },
    }, at);
  };

  /** Counts a number between two values, formatted by `fmt`. */
  FB.count = function count(tl, el, from, to, at, dur, fmt, ease) {
    const proxy = { v: from };
    const f = fmt || ((v) => String(Math.round(v)));
    el.textContent = f(from);
    tl.fromTo(proxy, { v: from }, {
      v: to,
      duration: dur,
      ease: ease || 'power2.out',
      immediateRender: false,
      onUpdate() { el.textContent = f(proxy.v); },
    }, at);
  };

  /**
   * Moves the cursor along an arc to (x, y), arriving at `arrive` (s): the
   * hand eases in and lands slowly (expo.out), slight arc on the way.
   */
  FB.cursorTo = function cursorTo(tl, cursor, from, to, arrive, dur, arc) {
    const d = dur ?? 0.55;
    const a = arc ?? -60;
    const start = arrive - d;
    const ir = { immediateRender: false };
    tl.fromTo(cursor, { x: from[0] }, Object.assign({ x: to[0], duration: d, ease: 'power3.inOut' }, ir), start);
    tl.fromTo(cursor, { y: from[1] }, Object.assign({ y: to[1], duration: d, ease: 'power3.inOut' }, ir), start);
    if (a) {
      const lift = cursor.querySelector('.lift') || cursor;
      tl.fromTo(lift, { y: 0 }, Object.assign({ y: a, duration: d / 2, ease: 'sine.out' }, ir), start);
      tl.fromTo(lift, { y: a }, Object.assign({ y: 0, duration: d / 2, ease: 'sine.in' }, ir), start + d / 2);
    }
  };

  /**
   * Click at time `at`: the hand presses (scale 0.86 in 3 frames, back with
   * the UI spring) and the pixel button sinks one art pixel (.btn-px:active).
   */
  FB.click = function click(tl, cursor, at, button, sink) {
    const hand = cursor.querySelector('.press') || cursor;
    tl.fromTo(hand, { scale: 1 }, { scale: 0.86, duration: 3 / 30, ease: 'power2.in', immediateRender: false }, at - 3 / 30);
    tl.fromTo(hand, { scale: 0.86 }, { scale: 1, duration: FB.springs.ui.duration, ease: FB.springs.ui.ease, immediateRender: false }, at);
    if (button) {
      const s = sink ?? 6;
      const o = { duration: 2 / 30, ease: 'steps(1)', immediateRender: false };
      tl.fromTo(button, { y: 0, '--press': 0 }, Object.assign({ y: s, '--press': 1 }, o), at - 2 / 30);
      tl.fromTo(button, { y: s, '--press': 1 }, Object.assign({ y: 0, '--press': 0 }, o), at + 4 / 30);
    }
  };
})();

/* Phosphor icons (MIT): fill weight for the game's mobile bottom bar,
   bold Check, X and ArrowRight for the buttons that carry them in the game. */
(function () {
  const ICONS = {"House":"M224,120v96a8,8,0,0,1-8,8H160a8,8,0,0,1-8-8V164a4,4,0,0,0-4-4H108a4,4,0,0,0-4,4v52a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V120a16,16,0,0,1,4.69-11.31l80-80a16,16,0,0,1,22.62,0l80,80A16,16,0,0,1,224,120Z","UsersThree":"M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z","Storefront":"M231.69,93.81,217.35,43.6A16.07,16.07,0,0,0,202,32H54A16.07,16.07,0,0,0,38.65,43.6L24.31,93.81A7.94,7.94,0,0,0,24,96v16a40,40,0,0,0,16,32v72a8,8,0,0,0,8,8H208a8,8,0,0,0,8-8V144a40,40,0,0,0,16-32V96A7.94,7.94,0,0,0,231.69,93.81ZM88,112a24,24,0,0,1-35.12,21.26,7.88,7.88,0,0,0-1.82-1.06A24,24,0,0,1,40,112v-8H88Zm64,0a24,24,0,0,1-48,0v-8h48Zm64,0a24,24,0,0,1-11.07,20.2,8.08,8.08,0,0,0-1.8,1.05A24,24,0,0,1,168,112v-8h48Z","Briefcase":"M152,112a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,112Zm80-40V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V72A16,16,0,0,1,40,56H80V48a24,24,0,0,1,24-24h48a24,24,0,0,1,24,24v8h40A16,16,0,0,1,232,72ZM96,56h64V48a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8Zm120,57.61V72H40v41.61A184,184,0,0,0,128,136,184,184,0,0,0,216,113.61Z","Check":"M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z","X":"M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z","ArrowRight":"M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z","DotsThreeOutline":"M156,128a28,28,0,1,1-28-28A28,28,0,0,1,156,128ZM48,100a28,28,0,1,0,28,28A28,28,0,0,0,48,100Zm160,0a28,28,0,1,0,28,28A28,28,0,0,0,208,100Z"};
  window.FB.icon = function icon(name, size, color) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" fill="${color || 'currentColor'}" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
  };
  window.FB.mountIcons = function mountIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.mounted) return;
      el.innerHTML = window.FB.icon(el.dataset.icon, Number(el.dataset.size || 22));
      el.dataset.mounted = '1';
    });
  };
})();
