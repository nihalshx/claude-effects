// effects engine: renders one effect over a speaker clip, frame by frame.
// The page is driven by window.renderFrame(t); every element is set from t alone, so any frame renders on its own.
// Inputs (cfg.js → window.CFG): fx, w, h, fps, nf, cut (bool), rms[], words[], highlight[], title, lines[], word, color, broll[].
(() => {
  const C = window.CFG, W = C.w, H = C.h, FPS = C.fps, NF = C.nf, DUR = NF / FPS;
  const S = Math.min(W, H) / 1080;                       // scale unit (1 at 1080p)
  const st = document.getElementById('st'); st.style.width = W + 'px'; st.style.height = H + 'px';
  document.body.style.width = W + 'px'; document.body.style.height = H + 'px';

  // ---------- helpers ----------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const p = (t, a, d) => clamp((t - a) / d);
  const E = { o3: x => 1 - Math.pow(1 - x, 3), io3: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
    back: (x, s = 1.5) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2) };
  const lerp = (a, b, u) => a + (b - a) * u;
  const el = (html, parent = st) => { const d = document.createElement('div'); d.innerHTML = html.trim(); const e = d.firstElementChild; parent.appendChild(e); return e; };
  const seed = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pad = n => String(n).padStart(5, '0');
  const frameAt = (t, off = 0) => Math.min(NF, Math.max(1, Math.floor((t + off) * FPS + 1e-6) + 1));

  // images whose source follows time: the clip, the cutout, or a b-roll item
  const live = [];
  const IMG = (parent, srcFn, style = '') => { const im = el(`<img class="fill" style="${style}">`, parent); live.push({ im, srcFn }); return im; };
  const CLIP = (parent, style = '', off = 0) => IMG(parent, t => `frames/f${pad(frameAt(t, off))}.png`, style);
  const CUT = (parent, style = '') => C.cut ? IMG(parent, t => `cut/f${pad(frameAt(t))}.png`, style) : null;
  // b-roll: {kind:'img', src} or {kind:'seq', dir, n}. Without b-roll, use the clip itself, offset and tinted.
  const TINTS = ['saturate(1.3)', 'sepia(.35)', 'hue-rotate(-18deg) saturate(1.3)', 'contrast(1.15)', 'grayscale(.5)', 'hue-rotate(15deg)', 'sepia(.2) saturate(1.3)', 'saturate(1.2) brightness(1.05)'];
  const BROLL = (parent, i, style = '') => {
    const b = (C.broll && C.broll.length) ? C.broll[i % C.broll.length] : null;
    if (!b) return CLIP(parent, `object-position:50% 30%;filter:${TINTS[i % TINTS.length]};${style}`, -((i * 0.37) % Math.max(.5, DUR - .1)));
    if (b.kind === 'img') return el(`<img class="fill" src="${b.src}" style="${style}">`, parent);
    return IMG(parent, t => `${b.dir}/f${pad(1 + (Math.floor(t * FPS) % b.n))}.png`, style);
  };
  const draws = [];
  const draw = f => draws.push(f);

  // ================= effects =================
  const FX = {
    // your clip stays as the background; a 3D carousel of other reels spins in behind you and settles
    'carousel-spin'() {
      CLIP(st, 'filter:brightness(.82) saturate(.95)');
      el(`<div class="fill" style="background:radial-gradient(70% 70% at 50% 55%, rgba(0,0,0,0), rgba(0,0,0,.35))"></div>`);
      const stage = el(`<div class="fill" style="perspective:${1700 * S}px;perspective-origin:50% 45%"></div>`);
      const ch = H * .955, cw = ch * 9 / 16, GAP = cw * .965, N = 15, cards = [];
      for (let i = 0; i < N; i++) { const c = el(`<div style="position:absolute;left:${W / 2 - cw / 2}px;top:${H / 2 - ch / 2}px;width:${cw}px;height:${ch}px;border-radius:${30 * S}px;overflow:hidden;box-shadow:0 ${30 * S}px ${70 * S}px rgba(0,0,0,.55);border:${3 * S}px solid rgba(255,255,255,.18)"></div>`, stage);
        BROLL(c, i); cards.push(c); }
      draw(t => { const u = E.o3(p(t, .1, 1.35)), off = lerp(13 * GAP, 3.5 * GAP, u) - Math.max(0, t - 1.45) * GAP * .25;
        cards.forEach((c, i) => { const x = i * GAP - off, d = clamp(x / GAP, -3, 3);
          c.style.transform = `translateX(${x * .92}px) translateZ(${(-220 - Math.abs(d) * 200) * S}px) rotateY(${-d * 34}deg)`;
          c.style.zIndex = 100 - Math.round(Math.abs(d) * 10); c.style.opacity = Math.abs(d) > 2.9 ? 0 : 1; }); });
      CUT(st);
    },
    // a wall of your own words scrolls behind you; chosen words are boxed in red
    'match-cut'() {
      st.style.background = '#EFE9E0';
      const words = (C.words && C.words.length ? C.words : ['one', 'clip', 'six', 'edits', 'made', 'with', 'Claude']).map(w => String(w).replace(/[.,?!"]/g, ''));
      const hl = (C.highlight && C.highlight.length ? C.highlight : ['Claude']).map(w => w.toLowerCase());
      const fs = 104 * S, lh = 122 * S, rows = Math.ceil(H / lh) + 1;
      const styles = ['font-family:Serif4;font-weight:400', 'font-family:Serif4;font-style:italic', 'font-family:Inter;font-weight:800;letter-spacing:-.02em', 'font-family:Serif4;font-weight:400'];
      const R = [];
      for (let r = 0; r < rows; r++) {
        const seq = words.slice((r * 7) % words.length).concat(words, words, words, words).slice(0, Math.max(26, Math.ceil(W / (fs * 2.4)) * 3));
        const html = seq.map((w, i) => (hl.includes(w.toLowerCase()) || (r % 3 === 1 && i === 5)) ? `<span style="background:#E3342B;color:#fff;padding:0 ${16 * S}px;border-radius:${8 * S}px;font-family:Inter;font-weight:800;font-style:normal">${w}</span>` : w).join(' ');
        R.push([el(`<div style="position:absolute;left:0;top:${-10 * S + r * lh}px;white-space:nowrap;font-size:${fs}px;line-height:1;color:${r % 2 ? '#2E2C29' : '#5B5750'};${styles[r % 4]}">${html}</div>`), r % 2 ? 1 : -1, (140 + (r % 3) * 40) * S]);
      }
      draw(t => R.forEach(([row, dir, sp]) => { row.style.transform = `translateX(${dir > 0 ? -900 * S + sp * t : -300 * S - sp * t}px)`; }));
      CUT(st);
    },
    // frosted glass stats over your clip; every number is real (frames rendered, render progress, your voice level)
    'glass-graph'() {
      CLIP(st);
      const g = `position:absolute;background:rgba(255,255,255,.14);border:${2 * S}px solid rgba(255,255,255,.32);backdrop-filter:blur(${22 * S}px) saturate(1.3);box-shadow:0 ${20 * S}px ${60 * S}px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.4)`;
      const cw = Math.min(680 * S, W * .42);
      const top = el(`<div style="${g};left:${40 * S}px;top:${34 * S}px;width:${cw}px;height:${240 * S}px;border-radius:${44 * S}px">
        <div style="position:absolute;left:${40 * S}px;top:${28 * S}px;font-size:${28 * S}px;font-weight:700;letter-spacing:.14em;color:rgba(255,255,255,.9)">FRAMES RENDERED</div>
        <svg style="position:absolute;left:${36 * S}px;top:${84 * S}px" width="${cw - 72 * S}" height="${130 * S}" viewBox="0 0 1300 130" preserveAspectRatio="none"><path d="M0 110 C 200 105, 330 98, 480 86 S 760 70, 900 52 S 1150 24, 1300 12" stroke="#3DDC97" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="1400" stroke-dashoffset="1400"/><circle r="14" fill="#3DDC97" cx="0" cy="110"/></svg></div>`);
      const nw = Math.min(560 * S, W * .36);
      const numc = el(`<div style="${g};right:${40 * S}px;top:${34 * S}px;width:${nw}px;height:${240 * S}px;border-radius:${44 * S}px;display:flex;align-items:center;justify-content:center"><div style="font-size:${150 * S}px;font-weight:800;letter-spacing:-.04em;color:#fff">0</div></div>`);
      const rs = 340 * S;
      const ring = el(`<div style="${g};left:${40 * S}px;top:${H - rs - 40 * S}px;width:${rs}px;height:${rs}px;border-radius:50%;display:flex;align-items:center;justify-content:center">
        <svg width="${rs * .88}" height="${rs * .88}" viewBox="0 0 100 100" style="position:absolute"><circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,.2)" stroke-width="9" fill="none"/><circle cx="50" cy="50" r="40" stroke="#FF8A4C" stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="251.3" stroke-dashoffset="251.3" transform="rotate(-90 50 50)"/></svg>
        <div style="text-align:center"><div class="pc" style="font-size:${70 * S}px;font-weight:800;color:#fff">0%</div><div style="font-size:${20 * S}px;letter-spacing:.14em;color:rgba(255,255,255,.8);font-weight:700">RENDER</div></div></div>`);
      const bw = 330 * S, bh = 400 * S;
      const bars = el(`<div style="${g};left:${W - bw - 40 * S}px;top:${H - bh - 40 * S}px;width:${bw}px;height:${bh}px;border-radius:${40 * S}px;padding:${30 * S}px">
        <div style="font-size:${22 * S}px;letter-spacing:.14em;color:rgba(255,255,255,.85);font-weight:700">VOICE</div><div class="bb" style="display:flex;align-items:flex-end;gap:${18 * S}px;height:${290 * S}px;margin-top:${20 * S}px"></div></div>`);
      const bb = []; for (let i = 0; i < 4; i++) bb.push(el(`<div style="flex:1;border-radius:${14 * S}px;background:${i ? 'rgba(255,255,255,.55)' : 'linear-gradient(#5BF0A8,#22B573)'};height:20%"></div>`, bars.querySelector('.bb')));
      const ln = top.querySelector('path'), dt = top.querySelector('circle'), num = numc.firstElementChild, rg = ring.querySelectorAll('circle')[1], pc = ring.querySelector('.pc'), L = ln.getTotalLength();
      const panels = [top, numc, ring, bars];
      draw(t => {
        panels.forEach((q, i) => { const u = p(t, .05 + i * .08, .45), e = E.back(u, 1.5); q.style.opacity = clamp(u * 2); q.style.transform = `translateY(${(1 - e) * (i < 2 ? -80 : 80) * S}px) scale(${lerp(.94, 1, e)})`; });
        const e = 1 - Math.pow(1 - p(t, .2, Math.max(.5, DUR - .3)), 2);
        ln.setAttribute('stroke-dashoffset', (1400 * (1 - e)).toFixed(1)); const q = ln.getPointAtLength(L * e); dt.setAttribute('cx', q.x.toFixed(1)); dt.setAttribute('cy', q.y.toFixed(1));
        num.textContent = Math.round(NF * e).toLocaleString('en-US'); rg.setAttribute('stroke-dashoffset', (251.3 * (1 - e)).toFixed(1)); pc.textContent = Math.round(100 * e) + '%';
        const fi = Math.floor(t * FPS); bb.forEach((b, i) => { const v = (C.rms[Math.max(0, fi - 3 * i)] || 0) * (i ? .85 - i * .12 : 1); b.style.height = Math.max(8, v * 100).toFixed(1) + '%'; });
      });
    },
    // four phones fan out behind you, each playing a different reel, with a title box
    'phone-fan'() {
      CLIP(st, 'filter:brightness(.9)');
      const PORTRAIT = H > W * 1.2;
      const pw = PORTRAIT ? W * .34 : Math.min(W * .25, H * .46), ph = pw * 2.08, bz = pw * .031;
      const spec = PORTRAIT ? [[.13, .17, -14], [.31, .11, -6], [.69, .11, 6], [.87, .17, 14]] : [[.156, .3, -14], [.339, .23, -6], [.661, .23, 6], [.844, .3, 14]];
      const phones = spec.map(([cx, top, r], i) => { const q = el(`<div style="position:absolute;left:${W * cx - pw / 2}px;top:${H * top}px;width:${pw}px;height:${ph}px;border-radius:${pw * .14}px;background:#0B0B0B;border:${bz}px solid #151515;overflow:hidden;box-shadow:0 ${40 * S}px ${90 * S}px rgba(0,0,0,.6)"></div>`);
        BROLL(q, i); el(`<div style="position:absolute;left:50%;top:${pw * .04}px;width:${pw * .27}px;height:${pw * .075}px;border-radius:${pw * .04}px;background:#000;transform:translateX(-50%)"></div>`, q);
        return [q, (W / 2 - W * cx) * .6, r, (i === 1 || i === 2) ? 0 : .08]; });
      draw(t => phones.forEach(([q, fx, r, dl]) => { const u = p(t, .05 + dl, .6), e = E.back(u, 1.3); q.style.opacity = clamp(u * 3);
        q.style.transform = `translate(${fx * (1 - e)}px, ${260 * S * (1 - e)}px) rotate(${r * e}deg)`; }));
      CUT(st);
      const ti = el(`<div style="position:absolute;left:${60 * S}px;top:${50 * S}px;background:#fff;color:#111;font-weight:800;font-size:${Math.min(112 * S, W * .058)}px;letter-spacing:-.035em;padding:${6 * S}px ${30 * S}px ${16 * S}px;border-radius:${16 * S}px;white-space:nowrap;box-shadow:0 ${10 * S}px ${30 * S}px rgba(0,0,0,.25)">${C.title || 'One clip. Six edits.'}</div>`);
      draw(t => { const u = E.o3(p(t, .2, .35)); ti.style.opacity = u; ti.style.transform = `translateX(${-60 * S * (1 - u)}px)`; });
    },
    // a glowing LED dot-matrix sign behind you, warm color grade, flickers on
    'led-sign'() {
      CLIP(st, 'filter:brightness(.55) sepia(.45) saturate(1.5) hue-rotate(-12deg)');
      el(`<div class="fill" style="background:radial-gradient(70% 60% at 50% 35%, rgba(255,140,40,.25), rgba(0,0,0,.35) 80%)"></div>`);
      const cv = el(`<canvas width="${W}" height="${H}" style="position:absolute;left:0;top:0"></canvas>`), c = cv.getContext('2d');
      const lines = (C.lines && C.lines.length ? C.lines : ['ONE CLIP', 'ZERO APPS']).map(s => String(s).toUpperCase());
      const PORTRAIT = H > W * 1.2;
      const longest = Math.max(...lines.map(s => s.length)), fpx = Math.min(PORTRAIT ? H * .085 : H * .28, W * .92 / (longest * .64));
      const off = document.createElement('canvas'); off.width = W; off.height = H; const ox = off.getContext('2d');
      ox.fillStyle = '#fff'; ox.textAlign = 'center'; ox.font = `800 ${fpx}px Inter`;
      const y0 = PORTRAIT ? H * .1 : H * .35 - (lines.length - 1) * fpx * .55;
      lines.forEach((s, i) => ox.fillText(s, W / 2, y0 + i * fpx * 1.07 + fpx * .36));
      const px = ox.getImageData(0, 0, W, H).data, pts = [], G = Math.max(6, Math.round(fpx / 17.6)), R = G * .37;
      for (let y = 0; y < H; y += G) for (let x = 0; x < W; x += G) if (px[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
      const fl = [0, .06, .1, .2, .24, .33];
      draw(t => { c.clearRect(0, 0, W, H); let on = 1;
        if (t < .4) { let k = 0; while (k < fl.length && fl[k] <= t) k++; on = k % 2 ? 1 : .12; } else on = .94 + .06 * Math.sin(t * 41);
        c.globalAlpha = on; c.shadowColor = '#FF8A2A'; c.shadowBlur = G * 1.3; c.fillStyle = '#FFD45A';
        pts.forEach(([x, y]) => { c.beginPath(); c.arc(x, y, R, 0, 6.283); c.fill(); }); c.shadowBlur = 0; c.globalAlpha = 1; });
      CUT(st, 'filter:brightness(.82) sepia(.3) saturate(1.3) hue-rotate(-10deg)');
    },
    // one giant word behind you on a solid color; the letters rise in
    'type-behind'() {
      st.style.background = C.color || '#D97757';
      const word = String(C.word || 'EDIT').toUpperCase(), fpx = Math.min(H * .52, W * .95 / (word.length * .64));
      const big = el(`<div style="position:absolute;left:0;right:0;top:${H * .11}px;text-align:center;font-weight:800;font-size:${fpx}px;letter-spacing:-.05em;line-height:1;color:${C.ink || '#F5E6DA'};white-space:nowrap">${[...word].map(ch => `<span style="display:inline-block">${ch}</span>`).join('')}</div>`);
      const sp = [...big.children];
      draw(t => sp.forEach((s, i) => { const u = p(t, i * .07, .45), e = E.back(u, 1.6); s.style.opacity = clamp(u * 2); s.style.transform = `translateY(${420 * S * (1 - e)}px)`; }));
      CUT(st);
    },
  };
  if (!FX[C.fx]) throw new Error('unknown effect: ' + C.fx);

  // ---------- boot ----------
  (async () => {
    await Promise.all(['800 40px Inter', '700 40px Inter', '600 40px Inter', '400 40px Serif4', 'italic 400 40px Serif4'].map(f => document.fonts.load(f, 'Aa')));
    await document.fonts.ready;
    FX[C.fx]();
    window.renderFrame = async t => {
      const ps = [];
      live.forEach(o => { const s = o.srcFn(t); if (o.im.dataset.cur !== s) { o.im.dataset.cur = s; o.im.src = s; ps.push(o.im.decode().catch(() => {})); } });
      draws.forEach(f => f(t));
      await Promise.all(ps);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      return true;
    };
    window.__ready = true;
  })().catch(e => { window.__err = String(e && e.stack || e); window.__ready = true; });
})();
