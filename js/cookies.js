/* ==========================================================================
   Dough Bunny — illustrated cookies
   Renders a hand-drawn-style SVG cookie into every [data-cookie] element.
   Each flavor has its own dough colors and toppings; a seeded random keeps
   chip placement identical on every page load.
   ========================================================================== */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Smooth closed blob around (cx, cy)
  function blob(cx, cy, r, wobble, points, rand, petals) {
    const pts = [];
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      let rr = r * (1 + (rand() - 0.5) * wobble);
      if (petals) rr = r * (0.86 + 0.14 * Math.abs(Math.cos(a * petals / 2)));
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], n = pts[(i + 1) % pts.length];
      const mx = (p[0] + n[0]) / 2, my = (p[1] + n[1]) / 2;
      d += (i === 0 ? `M${((pts[pts.length - 1][0] + p[0]) / 2).toFixed(1)},${((pts[pts.length - 1][1] + p[1]) / 2).toFixed(1)}` : '') +
        ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    return d + 'Z';
  }

  // Random point inside a circle, kept away from the edge
  function spot(rand, maxR) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * maxR;
    return [100 + Math.cos(a) * r, 98 + Math.sin(a) * r];
  }

  const FLAVORS = {
    choc: { seed: 11, light: '#EBBE86', mid: '#D7A062', edge: '#AE7036' },
    strawberry: { seed: 23, light: '#FAD3DA', mid: '#F0B2BF', edge: '#D2869A' },
    cutout: { seed: 31, light: '#F6E1B8', mid: '#EBCB93', edge: '#CFA266', bunny: true },   // Frosted Butter Cookie: our bunny shape
    snicker: { seed: 41, light: '#F2D3A2', mid: '#E4BB82', edge: '#BF8A4E' },
    banana: { seed: 53, light: '#F8EBBE', mid: '#EFD994', edge: '#CDAA5C' },
    brownie: { seed: 61, light: '#744632', mid: '#5A3322', edge: '#3A1F14' },
    smores: { seed: 71, light: '#DDA66C', mid: '#C88E53', edge: '#9A6131' }
  };

  function render(el) {
    const type = el.dataset.cookie;
    const f = FLAVORS[type];
    if (!f) return;
    const rand = rng(f.seed);
    const id = 'ck' + (++uid);
    const out = [];

    out.push(`<defs>
      <radialGradient id="${id}g" cx="42%" cy="38%" r="68%">
        <stop offset="0" stop-color="${f.light}"/>
        <stop offset=".62" stop-color="${f.mid}"/>
        <stop offset="1" stop-color="${f.edge}"/>
      </radialGradient>
      <radialGradient id="${id}h" cx="35%" cy="30%" r="45%">
        <stop offset="0" stop-color="#fff" stop-opacity=".45"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
      <filter id="${id}s" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#3E2A55" flood-opacity=".22"/>
      </filter>
    </defs>`);

    // The Frosted Butter Cookie is cut in the shape of a bunny (head + two ears).
    if (f.bunny) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 200 200');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const shape = (dx = 0) => `
        <ellipse cx="${72 + dx}" cy="62" rx="19" ry="44" transform="rotate(-14 ${72 + dx} 62)"/>
        <ellipse cx="${128 - dx}" cy="62" rx="19" ry="44" transform="rotate(14 ${128 - dx} 62)"/>
        <circle cx="100" cy="124" r="62"/>`;
      const dots = [];
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        dots.push(`<circle cx="${(100 + Math.cos(a) * 50).toFixed(1)}" cy="${(126 + Math.sin(a) * 50).toFixed(1)}" r="1.9" fill="#fff" opacity=".95"/>`);
      }
      svg.innerHTML = out.join('') + `
        <g fill="url(#${id}g)" filter="url(#${id}s)">${shape()}</g>
        <g fill="#CDB6EE" transform="translate(100 118) scale(.84) translate(-100 -118)">${shape(2)}</g>
        <ellipse cx="73" cy="64" rx="8" ry="27" transform="rotate(-14 73 64)" fill="#F2B8C8"/>
        <ellipse cx="127" cy="64" rx="8" ry="27" transform="rotate(14 127 64)" fill="#F2B8C8"/>
        ${dots.join('')}
        <circle cx="80" cy="120" r="5.5" fill="#45305E"/><circle cx="120" cy="120" r="5.5" fill="#45305E"/>
        <circle cx="82" cy="118" r="1.8" fill="#fff"/><circle cx="122" cy="118" r="1.8" fill="#fff"/>
        <path d="M95 132 Q100 137 105 132 Q100 129 95 132Z" fill="#E58FA8"/>
        <path d="M92 140 Q100 147 108 140" fill="none" stroke="#45305E" stroke-width="2.4" stroke-linecap="round"/>
        <ellipse cx="68" cy="138" rx="9" ry="5.5" fill="#F2B8C8" opacity=".75"/><ellipse cx="132" cy="138" rx="9" ry="5.5" fill="#F2B8C8" opacity=".75"/>
        <g fill="url(#${id}h)">${shape()}</g>`;
      el.appendChild(svg);
      return;
    }

    const body = blob(100, 98, 80, 0.07, 22, rand);
    out.push(`<path d="${body}" fill="url(#${id}g)" filter="url(#${id}s)"/>`);

    // subtle baked texture
    for (let i = 0; i < 26; i++) {
      const [x, y] = spot(rand, 66);
      out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + rand() * 1.4).toFixed(1)}" fill="${f.edge}" opacity=".35"/>`);
    }

    const chips = (n, colors, size, maxR = 60) => {
      for (let i = 0; i < n; i++) {
        const [x, y] = spot(rand, maxR);
        const c = colors[i % colors.length];
        out.push(`<path d="${blob(x, y, size * (0.75 + rand() * 0.5), 0.5, 7, rand)}" fill="${c}"/>`);
      }
    };
    const crack = (n, color, op) => {
      for (let i = 0; i < n; i++) {
        const [x, y] = spot(rand, 50);
        const a = rand() * Math.PI, l = 10 + rand() * 18;
        const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
        const qx = (x + x2) / 2 + (rand() - 0.5) * 10, qy = (y + y2) / 2 + (rand() - 0.5) * 10;
        out.push(`<path d="M${x.toFixed(1)},${y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="${op}"/>`);
      }
    };
    const drizzle = (color) => {
      out.push(`<clipPath id="${id}c"><path d="${blob(100, 98, 72, 0, 40, rng(1), 0)}"/></clipPath><g clip-path="url(#${id}c)" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".95">`);
      for (let k = 0; k < 5; k++) {
        const y = 52 + k * 22, tilt = -14;
        let d = `M20,${y + 20}`;
        for (let x = 20; x < 180; x += 32) {
          d += ` C${x + 10},${y + tilt * (x / 180) - 8} ${x + 22},${y + tilt * (x / 180) + 10} ${x + 32},${y + tilt * ((x + 32) / 180)}`;
        }
        out.push(`<path d="${d}"/>`);
      }
      out.push('</g>');
    };

    switch (type) {
      case 'choc':
        crack(6, f.edge, 0.4);
        chips(11, ['#3B2216', '#4A2C1D', '#2E1A10'], 9);
        break;
      case 'strawberry':
        chips(8, ['#E9C98A', '#DDB36E'], 7);
        chips(9, ['#FFF7EE', '#FBEFE2'], 7.5);
        chips(5, ['#C9475F'], 4);
        drizzle('#FFFBF5');
        break;
      case 'snicker':
        crack(9, f.edge, 0.55);
        for (let i = 0; i < 70; i++) {
          const [x, y] = spot(rand, 70);
          out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.9 + rand() * 1.3).toFixed(1)}" fill="${rand() > 0.45 ? '#8A4B24' : '#FFF8EC'}" opacity=".85"/>`);
        }
        break;
      case 'banana':
        for (let i = 0; i < 4; i++) {
          const [x, y] = spot(rand, 44);
          out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13" fill="#E7B96A"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="none" stroke="#C99447" stroke-width="1.4" stroke-dasharray="2 3"/>`);
        }
        chips(9, ['#FFF8EC', '#FBF0DE'], 6.5);
        break;
      case 'brownie':
        for (let i = 0; i < 7; i++) {
          const [x, y] = spot(rand, 48);
          out.push(`<path d="${blob(x, y, 12 + rand() * 8, 0.6, 6, rand)}" fill="#8A5A42" opacity=".42"/>`);
        }
        crack(12, '#2A140C', 0.7);
        chips(5, ['#24120A'], 7);
        break;
      case 'smores':
        for (let i = 0; i < 4; i++) {
          const [x, y] = spot(rand, 50);
          const a = rand() * 40 - 20;
          out.push(`<g transform="rotate(${a.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"><rect x="${(x - 11).toFixed(1)}" y="${(y - 9).toFixed(1)}" width="22" height="18" rx="2.5" fill="#E2AE62"/><circle cx="${(x - 5).toFixed(1)}" cy="${y.toFixed(1)}" r="1.3" fill="#B07A36"/><circle cx="${(x + 5).toFixed(1)}" cy="${y.toFixed(1)}" r="1.3" fill="#B07A36"/></g>`);
        }
        chips(7, ['#3B2216', '#2E1A10'], 9);
        out.push(`<path d="${blob(104, 94, 24, 0.25, 10, rand)}" fill="#FFF9F0"/>`);
        out.push(`<path d="${blob(108, 90, 12, 0.3, 8, rand)}" fill="#EBC08A" opacity=".75"/>`);
        break;
    }

    out.push(`<path d="${body}" fill="url(#${id}h)"/>`);

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.innerHTML = out.join('');
    el.appendChild(svg);
  }

  document.querySelectorAll('[data-cookie]').forEach(render);
})();
