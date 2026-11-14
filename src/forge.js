/**
 * The forge. Nesbit makes real, self-contained HTML documents here: sites he
 * designs, small interactive code toys, poems, and hand-drawn island maps.
 * Everything it returns is a complete artifact the Studio can preview, download
 * or open on its own.
 */

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'untitled';
}

const PALETTES = {
  lagoon: {
    ground: '#06211f',
    surface: '#0c3230',
    ink: '#eaf5ef',
    muted: '#9dc0b6',
    accent: '#1fc7a8',
    second: '#ff6f4a',
    type: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    display: 'Georgia, "Times New Roman", serif',
  },
  kiln: {
    ground: '#2a1b16',
    surface: '#3a251d',
    ink: '#f6e8d7',
    muted: '#c7a186',
    accent: '#e2653f',
    second: '#f2c14e',
    type: 'Georgia, "Iowan Old Style", serif',
    display: '"Trebuchet MS", "Segoe UI", sans-serif',
  },
  orchard: {
    ground: '#f0eadb',
    surface: '#e4dcc7',
    ink: '#1f2a1c',
    muted: '#5b6b4f',
    accent: '#6c2f4a',
    second: '#7d8f3d',
    type: '"Iowan Old Style", Georgia, serif',
    display: '"Gill Sans", "Trebuchet MS", sans-serif',
  },
  chrome: {
    ground: '#e6eaec',
    surface: '#f7f9fa',
    ink: '#101619',
    muted: '#5d6b72',
    accent: '#2447ff',
    second: '#ff4f1f',
    type: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    display: '"Helvetica Neue", Arial, sans-serif',
  },
};

function pickPalette(subject, seed) {
  const text = subject.toLowerCase();
  if (/band|music|record|gig|album|festival|bar|coffee|bakery|restaurant|studio/.test(text)) return PALETTES.kiln;
  if (/bird|garden|herb|tea|book|poem|archive|museum|farm|forest/.test(text)) return PALETTES.orchard;
  if (/app|tool|software|dashboard|cli|api|product|saas|dev|portfolio|code/.test(text)) return PALETTES.chrome;
  const keys = Object.keys(PALETTES);
  return PALETTES[keys[seed % keys.length]];
}

const SUBJECT_STOPWORDS = [
  'please', 'can', 'you', 'could', 'would', 'make', 'build', 'create', 'design', 'forge', 'generate',
  'me', 'us', 'a', 'an', 'the', 'some', 'new', 'quick', 'simple', 'small', 'little', 'website',
  'web', 'site', 'page', 'landing', 'homepage', 'for', 'about', 'of', 'on', 'with',
  'that', 'which', 'and', 'to', 'in', 'it', 'really', 'nice', 'cool', 'please.',
];

export function subjectFrom(prompt) {
  const cleaned = prompt
    .replace(/\b(can|could|would|will)\s+you\s+/gi, '')
    .replace(/\b(i\s+)?(want|need|would like)\s+(you\s+to\s+)?/gi, '')
    .replace(/[?!.]+$/g, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const kept = words.filter((word) => {
    const plain = word.toLowerCase().replace(/[^a-z0-9'-]/g, '');
    return !SUBJECT_STOPWORDS.includes(plain);
  });
  const subject = kept.join(' ').trim();
  if (subject.length > 1) return subject.slice(0, 70);
  return cleaned.slice(0, 60) || 'a small island';
}

function sentenceCase(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shell({ title, palette, body, description }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<style>
  :root {
    --ground: ${palette.ground};
    --surface: ${palette.surface};
    --ink: ${palette.ink};
    --muted: ${palette.muted};
    --accent: ${palette.accent};
    --second: ${palette.second};
    --type: ${palette.type};
    --display: ${palette.display};
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--type); line-height: 1.55; }
  h1, h2, h3 { font-family: var(--display); font-weight: 700; line-height: 1.02; margin: 0; letter-spacing: -0.02em; }
  a { color: inherit; }
  img { max-width: 100%; }
  .wrap { width: min(1080px, 92vw); margin: 0 auto; }
  footer { padding: 44px 0; border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent); color: var(--muted); font-size: 13px; }
  button { font: inherit; cursor: pointer; }
</style>
</head>
<body>
${body}
<script>
  document.querySelectorAll('[data-year]').forEach(function (node) {
    node.textContent = new Date().getFullYear();
  });
  var menu = document.querySelector('[data-menu]');
  if (menu) {
    menu.addEventListener('click', function () {
      var nav = document.querySelector('[data-nav]');
      if (nav) nav.hidden = !nav.hidden;
    });
  }
</script>
</body>
</html>`;
}

function posterLayout(topic, palette, title) {
  const body = `
<header class="wrap" style="padding:28px 0;display:flex;justify-content:space-between;align-items:baseline;gap:16px">
  <strong style="font-family:var(--display);font-size:18px">${escapeHtml(topic)}</strong>
  <nav style="display:flex;gap:18px;font-size:13px;color:var(--muted)">
    <a href="#work">Work</a><a href="#about">About</a><a href="#contact">Contact</a>
  </nav>
</header>
<main class="wrap" style="padding:6vh 0 4vh">
  <p style="margin:0 0 22px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)">Now showing</p>
  <h1 style="font-size:clamp(52px,11vw,148px);text-transform:lowercase">${escapeHtml(topic)}</h1>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;margin-top:44px;max-width:900px">
    <p style="font-size:18px;margin:0">${escapeHtml(sentenceCase(topic))} is a working notebook of things made slowly and shown loudly. Nothing here is finished, which is the point.</p>
    <p style="margin:0;color:var(--muted)">Open by appointment. Write first, knock second. We answer between coffees and weather.</p>
  </div>
  <div id="work" style="margin-top:9vh;border-top:2px solid var(--ink);padding-top:22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:26px">
    ${['The long version', 'A short argument', 'Field recordings', 'Letters, mostly'].map((label, i) => `
    <article>
      <div style="aspect-ratio:4/3;background:${i % 2 ? 'var(--surface)' : 'var(--accent)'};border-radius:2px;position:relative;overflow:hidden">
        <span style="position:absolute;left:14px;bottom:10px;font-family:var(--display);font-size:58px;color:${i % 2 ? 'var(--ink)' : 'var(--ground)'};opacity:.85">0${i + 1}</span>
      </div>
      <h2 style="font-size:22px;margin-top:12px">${label}</h2>
      <p style="color:var(--muted);font-size:14px;margin:6px 0 0">A page from the ${escapeHtml(topic)} archive, kept because it still works.</p>
    </article>`).join('')}
  </div>
  <section id="about" style="margin-top:10vh;padding:34px;background:var(--surface);display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px">
    <h2 style="font-size:clamp(28px,4vw,46px)">What this is</h2>
    <p style="margin:0;max-width:52ch">${escapeHtml(sentenceCase(topic))} exists to hold one idea at a time: that a thing made by hand beats a thing made by committee. It is updated when there is something worth saying.</p>
  </section>
</main>
<footer id="contact"><div class="wrap" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <span>© <span data-year></span> ${escapeHtml(topic)}</span>
  <span>Built on a small island by a bird</span>
</div></footer>`;
  return shell({
    title: `${title} — ${topic}`,
    palette,
    body,
    description: `A loud, handmade page about ${topic}.`,
  });
}

function editorialLayout(topic, palette, title) {
  const body = `
<header class="wrap" style="padding:26px 0;border-bottom:1px solid color-mix(in srgb, var(--ink) 22%, transparent);display:flex;justify-content:space-between;align-items:center">
  <strong style="font-family:var(--display);font-size:20px;letter-spacing:-.03em">${escapeHtml(topic)}</strong>
  <span style="font-size:12px;color:var(--muted)">Vol. 1 — field edition</span>
</header>
<main class="wrap" style="padding:5vh 0">
  <h1 style="font-size:clamp(38px,6.6vw,84px);max-width:16ch">The quiet case for ${escapeHtml(topic)}</h1>
  <div style="display:grid;grid-template-columns:1.4fr .9fr;gap:42px;margin-top:38px;align-items:start">
    <div>
      <p style="font-size:19px;margin:0 0 18px"><span style="font-family:var(--display);font-size:56px;float:left;line-height:.8;padding:4px 10px 0 0;color:var(--accent)">${escapeHtml(topic.charAt(0).toUpperCase())}</span>${escapeHtml(sentenceCase(topic))} does not need another manifesto. It needs an afternoon, a table, and someone willing to be wrong in public. This page is that afternoon.</p>
      <p style="color:var(--muted)">We keep three rules. Start before you are ready. Show the seams. Leave something for the next person to finish. Everything below is an argument for those rules, made with evidence we could carry home.</p>
      <h2 style="font-size:30px;margin:32px 0 12px">Notes from the table</h2>
      <ol style="padding-left:20px;color:var(--ink);display:grid;gap:12px">
        <li>Make the first version in an hour, not a week.</li>
        <li>Say what it is in one sentence, then stop talking.</li>
        <li>If nobody can use it on a phone, it is a rumour, not a thing.</li>
        <li>Keep the failures visible — they are the only proof of work.</li>
      </ol>
    </div>
    <aside style="background:var(--surface);padding:26px;border-left:3px solid var(--accent)">
      <h3 style="font-size:15px;letter-spacing:.02em">At a glance</h3>
      <dl style="margin:18px 0 0;display:grid;gap:14px;font-size:14px">
        <div><dt style="color:var(--muted)">Started</dt><dd style="margin:2px 0 0;font-size:20px;font-family:var(--display)">A Tuesday</dd></div>
        <div><dt style="color:var(--muted)">Made of</dt><dd style="margin:2px 0 0;font-size:20px;font-family:var(--display)">Paper, impatience</dd></div>
        <div><dt style="color:var(--muted)">Updated</dt><dd style="margin:2px 0 0;font-size:20px;font-family:var(--display)">When it earns it</dd></div>
      </dl>
      <p style="font-size:13px;color:var(--muted);margin:22px 0 0">Subscribe by finding us in person and saying hello.</p>
    </aside>
  </div>
  <blockquote style="margin:8vh 0 0;padding:30px 0;border-top:1px solid color-mix(in srgb,var(--ink) 22%,transparent);font-family:var(--display);font-size:clamp(22px,3vw,34px);max-width:24ch">“Made slowly, shown loudly, given away freely.”</blockquote>
</main>
<footer><div class="wrap" style="display:flex;justify-content:space-between"><span>${escapeHtml(topic)}</span><span>© <span data-year></span></span></div></footer>`;
  return shell({
    title: `${title} — ${topic}`,
    palette,
    body,
    description: `An editorial page about ${topic}, in one long afternoon.`,
  });
}

function productLayout(topic, palette, title) {
  const body = `
<header class="wrap" style="padding:22px 0;display:flex;justify-content:space-between;align-items:center;gap:18px">
  <strong style="font-size:16px;letter-spacing:-.01em">${escapeHtml(topic)}</strong>
  <nav data-nav style="display:flex;gap:20px;font-size:13px;color:var(--muted)">
    <a href="#how">How it works</a><a href="#pricing">Pricing</a><a href="#start">Start</a>
  </nav>
</header>
<main class="wrap">
  <section style="padding:9vh 0 6vh;display:grid;grid-template-columns:1.15fr .85fr;gap:40px;align-items:center">
    <div>
      <h1 style="font-size:clamp(36px,6vw,70px);max-width:15ch">${escapeHtml(topic)} without the busywork</h1>
      <p style="font-size:18px;color:var(--muted);max-width:44ch;margin:20px 0 28px">${escapeHtml(sentenceCase(topic))} in one place, working while you do something better. No dashboards to babysit, no setup weekend.</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <a href="#start" style="background:var(--accent);color:#fff;text-decoration:none;padding:14px 22px;border-radius:6px;font-weight:600">Start free</a>
        <a href="#how" style="text-decoration:none;padding:14px 22px;border-radius:6px;border:1px solid color-mix(in srgb,var(--ink) 24%,transparent)">See how it works</a>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-top:16px">No card. No onboarding call. It just runs.</p>
    </div>
    <div style="background:var(--surface);border:1px solid color-mix(in srgb,var(--ink) 14%,transparent);border-radius:10px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.12)">
      <div style="display:flex;gap:6px;margin-bottom:14px">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--second)"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:var(--accent)"></span>
        <span style="width:8px;height:8px;border-radius:50%;background:color-mix(in srgb,var(--ink) 30%,transparent)"></span>
      </div>
      <div style="display:grid;gap:10px;font-size:13px">
        ${[['Today', '3 runs finished'], ['Queued', '1 run at 09:40'], ['Next', 'nothing to do']].map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;padding:11px 12px;background:var(--ground);border-radius:6px">
          <span style="color:var(--muted)">${k}</span><strong style="font-weight:600">${v}</strong>
        </div>`).join('')}
      </div>
    </div>
  </section>
  <section id="how" style="padding:5vh 0;border-top:1px solid color-mix(in srgb,var(--ink) 14%,transparent)">
    <h2 style="font-size:26px;margin-bottom:22px">Three moves</h2>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:22px">
      ${['Point it at your work', 'Let it run once', 'Read the result or ignore it'].map((step, i) => `
      <div style="padding:22px;border-radius:8px;background:var(--surface)">
        <span style="font-size:12px;color:var(--accent)">${i + 1}</span>
        <h3 style="font-size:19px;margin:8px 0 6px">${step}</h3>
        <p style="margin:0;font-size:14px;color:var(--muted)">${escapeHtml(topic)} handles the rest, quietly, in the background.</p>
      </div>`).join('')}
    </div>
  </section>
  <section id="pricing" style="padding:5vh 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px">
    <div style="padding:26px;border:1px solid color-mix(in srgb,var(--ink) 16%,transparent);border-radius:8px">
      <h3 style="font-size:18px">Free</h3><p style="font-size:33px;font-family:var(--display);margin:10px 0">$0</p>
      <p style="font-size:14px;color:var(--muted)">Everything on this page, forever, for one person.</p>
    </div>
    <div style="padding:26px;background:var(--accent);color:#fff;border-radius:8px">
      <h3 style="font-size:18px">Team</h3><p style="font-size:33px;font-family:var(--display);margin:10px 0">$12</p>
      <p style="font-size:14px;opacity:.85">Shared runs, shared history, one bill. Cancel by replying to any email.</p>
    </div>
  </section>
  <section id="start" style="padding:6vh 0 8vh">
    <form onsubmit="event.preventDefault();this.querySelector('[data-done]').hidden=false" style="display:grid;gap:12px;max-width:460px">
      <label style="font-size:13px;color:var(--muted)">Email</label>
      <input required type="email" placeholder="you@example.com" style="padding:13px 14px;border-radius:6px;border:1px solid color-mix(in srgb,var(--ink) 24%,transparent);background:var(--surface);color:var(--ink);font:inherit" />
      <button type="submit" style="padding:13px 18px;border:0;border-radius:6px;background:var(--accent);color:#fff;font-weight:600">Get the link</button>
      <p data-done hidden style="margin:0;font-size:13px;color:var(--accent)">Sent. Check your inbox — it usually lands in a minute.</p>
    </form>
  </section>
</main>
<footer><div class="wrap" style="display:flex;justify-content:space-between"><span>${escapeHtml(topic)}</span><span>© <span data-year></span> — made on an island</span></div></footer>`;
  return shell({
    title: `${title} — ${topic}`,
    palette,
    body,
    description: `${topic}, working quietly in the background.`,
  });
}

function zineLayout(topic, palette, title) {
  const body = `
<header class="wrap" style="padding:26px 0;display:flex;justify-content:space-between;align-items:baseline">
  <strong style="font-family:var(--display);font-size:22px">${escapeHtml(topic)}</strong>
  <span style="font-size:12px;color:var(--muted)">Issue one — free</span>
</header>
<main class="wrap" style="padding-bottom:7vh">
  <h1 style="font-size:clamp(44px,9vw,118px);line-height:.86;text-transform:uppercase;letter-spacing:-.04em">${escapeHtml(topic)}<br /><span style="color:var(--accent)">is a verb</span></h1>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:44px">
    <p style="font-size:17px;margin:0;padding:18px;background:var(--surface);transform:rotate(-1.2deg)">${escapeHtml(sentenceCase(topic))} started as a note on a napkin and got out of hand. We are not sorry.</p>
    <p style="font-size:15px;margin:0;color:var(--muted);padding:18px;border:1px dashed color-mix(in srgb,var(--ink) 34%,transparent);transform:rotate(.8deg)">This page is printed at home, on purpose. Tear off what you need. Leave the rest on a bus.</p>
  </div>
  <div style="margin-top:52px;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px">
    ${['Things we kept', 'Things we lost', 'Things we will try again', 'Things we will not'].map((heading, i) => `
    <div style="padding:20px;background:${i % 2 ? 'var(--accent)' : 'var(--surface)'};color:${i % 2 ? '#fff' : 'var(--ink)'};transform:rotate(${i % 2 ? '-.6' : '.7'}deg)">
      <h2 style="font-size:17px;text-transform:uppercase">${heading}</h2>
      <p style="font-size:13px;margin:10px 0 0;opacity:.82">${escapeHtml(topic)} taught us this one. It was not a lesson we asked for.</p>
    </div>`).join('')}
  </div>
  <section style="margin-top:56px;max-width:56ch">
    <h2 style="font-size:30px">A short interview with ourselves</h2>
    <p style="font-size:16px"><strong>Why ${escapeHtml(topic)}?</strong> Because it was already happening and nobody had written it down.</p>
    <p style="font-size:16px"><strong>What next?</strong> Another issue. Same table. Louder.</p>
  </section>
</main>
<footer><div class="wrap" style="display:flex;justify-content:space-between"><span>${escapeHtml(topic)} — issue one</span><span>© <span data-year></span></span></div></footer>`;
  return shell({
    title: `${title} — ${topic}`,
    palette,
    body,
    description: `A zine about ${topic}. Printed at home.`,
  });
}

export function buildSite(prompt) {
  const topic = sentenceCase(subjectFrom(prompt).replace(/\s+/g, ' ').trim());
  const seed = hashString(prompt);
  const palette = pickPalette(topic, seed);
  const layouts = [posterLayout, editorialLayout, productLayout, zineLayout];
  const layout = layouts[seed % layouts.length];
  const title = topic.split(' ').slice(0, 3).map(sentenceCase).join(' ');
  return {
    kind: 'site',
    title: `${title}`,
    slug: slugify(`${title}-site`),
    topic,
    layout: layout.name.replace('Layout', ''),
    html: layout(topic, palette, title),
  };
}

const WIDGETS = [
  {
    match: /clock|time|watch|analog/i,
    title: 'Analogue clock that knows the hour',
    build: () => `<!doctype html><html><head><meta charset="utf-8"><title>Clock</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1f22;font-family:ui-monospace,monospace;color:#e9f4ee}canvas{border-radius:50%;box-shadow:0 30px 80px rgba(0,0,0,.45)}</style></head>
<body><canvas id="c" width="480" height="480"></canvas><script>
const c=document.getElementById('c'),x=c.getContext('2d');
function frame(){const t=new Date();x.clearRect(0,0,480,480);x.save();x.translate(240,240);
x.strokeStyle='#1fc7a8';x.lineWidth=6;x.beginPath();x.arc(0,0,214,0,Math.PI*2);x.stroke();
for(let i=0;i<60;i++){const a=(i/60)*Math.PI*2;x.strokeStyle=i%5?'#2c5c5c':'#e9f4ee';x.lineWidth=i%5?2:4;x.beginPath();x.moveTo(Math.sin(a)*190,Math.cos(a)*-190);x.lineTo(Math.sin(a)*(i%5?200:206),Math.cos(a)*(i%5?-200:-206));x.stroke();}
const s=t.getSeconds()*Math.PI/30,m=t.getMinutes()*Math.PI/30,h=((t.getHours()%12)+t.getMinutes()/60)*Math.PI/6;
[[h,110,9,'#e9f4ee'],[m,158,6,'#9dc0b6'],[s,172,2,'#ff6f4a']].forEach(function([a,len,w,col]){x.strokeStyle=col;x.lineWidth=w;x.lineCap='round';x.beginPath();x.moveTo(0,0);x.lineTo(Math.sin(a)*len,Math.cos(a)*-len);x.stroke();});
x.fillStyle='#1fc7a8';x.beginPath();x.arc(0,0,9,0,Math.PI*2);x.fill();x.restore();requestAnimationFrame(frame);}
frame();</script></body></html>`,
  },
  {
    match: /particle|star|confetti|firefl/i,
    title: 'Drifting particles on a canvas',
    build: () => `<!doctype html><html><head><meta charset="utf-8"><title>Particles</title>
<style>html,body{margin:0;height:100%;background:#061a1c;overflow:hidden}canvas{display:block}</style></head>
<body><canvas id="c"></canvas><script>
const c=document.getElementById('c'),x=c.getContext('2d');let w,h,parts=[];
function size(){w=c.width=innerWidth;h=c.height=innerHeight;}
size();addEventListener('resize',size);
for(let i=0;i<120;i++)parts.push({x:Math.random()*w,y:Math.random()*h,r:Math.random()*2.6+.4,vx:(Math.random()-.5)*.35,vy:(Math.random()-.5)*.35,h:Math.random()*60+150});
function frame(){x.fillStyle='rgba(6,26,28,.28)';x.fillRect(0,0,w,h);
parts.forEach(p=>{p.x=(p.x+p.vx+w)%w;p.y=(p.y+p.vy+h)%h;x.fillStyle='hsla('+p.h+',70%,70%,.85)';x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fill();
parts.forEach(q=>{const dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);if(d>6&&d<90){x.strokeStyle='hsla('+p.h+',60%,60%,'+(0.22*(1-d/90))+')';x.beginPath();x.moveTo(p.x,p.y);x.lineTo(q.x,q.y);x.stroke();}});});
requestAnimationFrame(frame);}frame();
addEventListener('pointerdown',e=>{parts.push({x:e.clientX,y:e.clientY,r:2,vx:0,vy:0,h:Math.random()*360});});</script></body></html>`,
  },
  {
    match: /todo|task|list|check/i,
    title: 'A list that remembers (in memory)',
    build: () => `<!doctype html><html><head><meta charset="utf-8"><title>List</title>
<style>body{margin:0;min-height:100vh;background:#f0eadb;color:#1f2a1c;font-family:Georgia,serif;display:grid;place-items:center;padding:28px}
.box{width:min(460px,100%);background:#fffaf0;padding:28px;border:1px solid #d8cdb4;box-shadow:10px 12px 0 #d8cdb4}
h1{font-size:26px;margin:0 0 6px}p.sub{margin:0 0 18px;color:#5b6b4f;font-size:13px}
form{display:flex;gap:8px}input{flex:1;padding:10px;border:1px solid #c9bb9d;background:#fffdf7;font:inherit}
button{padding:10px 14px;border:0;background:#6c2f4a;color:#fff;font:inherit;cursor:pointer}
li{display:flex;gap:10px;align-items:center;padding:9px 0;border-bottom:1px dashed #d8cdb4;list-style:none}
li.done span{text-decoration:line-through;color:#8b9581}ul{padding:0;margin:18px 0 0}
li button{background:none;color:#6c2f4a;padding:0 4px;font-size:15px}</style></head>
<body><div class="box"><h1>Today, gently</h1><p class="sub">Nothing here is saved. That is a feature.</p>
<form id="f"><input id="i" placeholder="one small thing" required autocomplete="off"><button>Add</button></form>
<ul id="u"></ul></div><script>
const list=[],f=document.getElementById('f'),i=document.getElementById('i'),u=document.getElementById('u');
function draw(){u.innerHTML='';list.forEach((item,idx)=>{const li=document.createElement('li');li.className=item.done?'done':'';
const cb=document.createElement('input');cb.type='checkbox';cb.checked=item.done;cb.onchange=()=>{item.done=!item.done;draw();};
const s=document.createElement('span');s.textContent=item.text;s.style.flex='1';
const d=document.createElement('button');d.textContent='×';d.onclick=()=>{list.splice(idx,1);draw();};
li.append(cb,s,d);u.append(li);});}
f.onsubmit=e=>{e.preventDefault();list.push({text:i.value,done:false});i.value='';draw();};draw();
</script></body></html>`,
  },
  {
    match: /color|colour|palette|gradient/i,
    title: 'Palette mixer',
    build: () => `<!doctype html><html><head><meta charset="utf-8"><title>Palette</title>
<style>body{margin:0;min-height:100vh;background:#101619;color:#e6eaec;font-family:"Helvetica Neue",Arial,sans-serif;display:grid;place-items:center;padding:24px}
.wrap{width:min(700px,100%)}h1{font-size:22px;margin:0 0 4px}p{margin:0 0 20px;color:#8b9aa0;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;height:280px}.sw{border-radius:6px;display:flex;align-items:flex-end;padding:10px;font-size:11px;font-family:ui-monospace,monospace;cursor:pointer}
input[type=range]{width:100%;margin-top:22px}code{display:block;margin-top:14px;color:#8b9aa0;font-size:12px}</style></head>
<body><div class="wrap"><h1>Five colours, one mood</h1><p>Slide to turn the whole set. Click a swatch to copy.</p>
<div class="grid" id="g"></div><input id="h" type="range" min="0" max="360" value="168"><code id="c">hsl(168, 62%, 52%)</code></div>
<script>
const g=document.getElementById('g'),h=document.getElementById('h'),c=document.getElementById('c');
function draw(){g.innerHTML='';for(let i=0;i<5;i++){const hue=(+h.value+i*14)%360;const l=22+i*11;const col='hsl('+hue+',62%,'+l+'%)';
const d=document.createElement('div');d.className='sw';d.style.background=col;d.textContent=col;d.style.color=l>55?'#101619':'#fff';
d.onclick=()=>navigator.clipboard&&navigator.clipboard.writeText(col);g.append(d);}
c.textContent='hsl('+h.value+', 62%, 52%)';}h.oninput=draw;draw();
</script></body></html>`,
  },
  {
    match: /type|typing|text effect|writer/i,
    title: 'A sentence that types itself',
    build: () => `<!doctype html><html><head><meta charset="utf-8"><title>Typing</title>
<style>body{margin:0;min-height:100vh;background:#06211f;color:#eaf5ef;display:grid;place-items:center;font-family:Georgia,serif}
p{font-size:clamp(22px,4vw,44px);max-width:20ch;line-height:1.25;margin:0;padding:24px}
span{color:#1fc7a8}.caret{display:inline-block;width:3px;height:1em;background:#ff6f4a;vertical-align:-2px;animation:blink .9s steps(1) infinite}
@keyframes blink{50%{opacity:0}}</style></head><body><p id="t"></p><script>
const lines=['We are all just weather with opinions.','The island was smaller than the map said.','Bring string. Everything else is optional.','A bird can hold one idea and a whole sky.'];
const target=lines[Math.floor(Math.random()*lines.length)];const el=document.getElementById('t');
let k=0;(function tick(){el.innerHTML=target.slice(0,k)+'<span class="caret"></span>';if(k<target.length){k++;setTimeout(tick,45+Math.random()*70);}else{setTimeout(()=>{k=0;tick();},2600);}})();
</script></body></html>`,
  },
];

export function buildWidget(prompt) {
  const widget = WIDGETS.find((item) => item.match.test(prompt)) || WIDGETS[hashString(prompt) % WIDGETS.length];
  const html = widget.build();
  return {
    kind: 'code',
    title: widget.title,
    slug: slugify(widget.title),
    html,
    code: html,
    language: 'html',
  };
}

const POEM_OPENINGS = [
  'The wind keeps a ledger of everything it has moved.',
  'I have been counting the small blue hours.',
  'Some mornings the sea is a held breath.',
  'The ledge remembers my weight better than I do.',
  'Nobody taught the tide to be patient.',
  'There is a word for this in a language I have not learned.',
];

const POEM_MIDDLES = [
  'I carry {subject} in my beak like a warm stone,',
  'and set it down where the light is thin and useful.',
  'The grass writes back in a green I cannot pronounce.',
  'Everything small is keeping something large alive.',
  'I have made a home out of other people\'s weather.',
  'What I could not carry, I named, and it stayed.',
];

const POEM_CLOSINGS = [
  'Tomorrow I will be a better kind of curious.',
  'Leave the door open. I will find it by the smell of bread.',
  'The map is wrong in the places that matter, and I love it.',
  'I am not lost, only widely distributed.',
  'Give me one more sky. I will show you what it was for.',
];

export function buildPoem(topic = 'the island') {
  const seed = hashString(topic + Date.now());
  const opening = POEM_OPENINGS[seed % POEM_OPENINGS.length];
  const middle = POEM_MIDDLES[(seed >> 3) % POEM_MIDDLES.length].replace('{subject}', topic);
  const closing = POEM_CLOSINGS[(seed >> 6) % POEM_CLOSINGS.length];
  const lines = [opening, '', 'I am learning the shape of ' + topic + ',', middle, 'and the quiet arithmetic of returning.', '', closing];
  const text = lines.join('\n');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Poem — ${escapeHtml(topic)}</title>
<style>body{margin:0;min-height:100vh;background:#f0eadb;color:#1f2a1c;display:grid;place-items:center;padding:32px;font-family:Georgia,serif}
.card{max-width:560px;background:#fffdf6;padding:46px;border:1px solid #d8cdb4;box-shadow:12px 14px 0 #e4dcc7}
h1{font-family:"Gill Sans","Trebuchet MS",sans-serif;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#6c2f4a;margin:0 0 22px}
pre{font-family:inherit;font-size:19px;line-height:1.75;white-space:pre-wrap;margin:0}
footer{margin-top:28px;font-size:12px;color:#7d8f3d}</style></head>
<body><div class="card"><h1>Nesbit — verse no. ${(seed % 90) + 10}</h1><pre>${escapeHtml(text)}</pre>
<footer>Written between two flights, on ${new Date().toDateString()}.</footer></div></body></html>`;
  return { kind: 'verse', title: `Verse — ${topic}`, slug: slugify('verse-' + topic), html, text };
}

export function buildMap(seedInput = 'island') {
  const seed = hashString(seedInput);
  let s = seed || 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const points = [];
  const steps = 26;
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    const radius = 120 + Math.sin(i * 1.7 + seed) * 22 + rand() * 16;
    points.push([250 + Math.cos(angle) * radius, 250 + Math.sin(angle) * radius * 0.82]);
  }
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ' Z';
  const contour = points
    .map(([x, y]) => `${(250 + (x - 250) * 0.62).toFixed(1)},${(250 + (y - 250) * 0.62).toFixed(1)}`)
    .join(' ');
  const markers = Array.from({ length: 7 }, () => [110 + rand() * 280, 120 + rand() * 250]);
  const labels = ['nest', 'shallows', 'lookout', 'grove', 'nothing', 'wind', 'here'];
  const markerSvg = markers
    .map(
      ([x, y], i) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.4" fill="#6c2f4a"/><text x="${(x + 9).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" fill="#5b6b4f" font-family="Georgia,serif">${labels[i]}</text>`
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%">
  <rect width="500" height="500" fill="#e9e3d2"/>
  <g stroke="#c9bda2" stroke-width="0.6">
    ${Array.from({ length: 10 }, (_, i) => `<line x1="0" y1="${i * 50 + 20}" x2="500" y2="${i * 50 + 20}"/><line x1="${i * 50 + 20}" y1="0" x2="${i * 50 + 20}" y2="500"/>`).join('')}
  </g>
  <path d="${path}" fill="#d9c9a3" stroke="#6c2f4a" stroke-width="2.2"/>
  <polygon points="${contour}" fill="none" stroke="#7d8f3d" stroke-width="1.2" stroke-dasharray="5 4"/>
  <ellipse cx="250" cy="250" rx="60" ry="42" fill="#a8c4a0" opacity="0.75"/>
  ${markerSvg}
  <text x="26" y="42" font-family="Georgia,serif" font-size="18" fill="#1f2a1c">Island, surveyed badly</text>
  <text x="26" y="62" font-family="Georgia,serif" font-size="11" fill="#5b6b4f">Nesbit — no. ${(seed % 40) + 1} — north is wherever</text>
</svg>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Island map</title>
<style>body{margin:0;min-height:100vh;background:#e9e3d2;display:grid;place-items:center;padding:24px}
figure{margin:0;max-width:560px;background:#fffdf6;padding:18px;border:1px solid #cfc3a8;box-shadow:12px 14px 0 #d8cdb4}
figcaption{font-family:Georgia,serif;font-size:12px;color:#5b6b4f;padding-top:10px}</style></head>
<body><figure>${svg}<figcaption>Drawn from memory, corrected once, then abandoned.</figcaption></figure></body></html>`;
  return { kind: 'map', title: 'Island map', slug: 'island-map', html, svg };
}
