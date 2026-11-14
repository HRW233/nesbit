import { buildSite, buildWidget, buildPoem, buildMap } from './forge.js';
import { HOBBIES, findHobby, levelOf, emptyHobbies } from './hobbies.js';
import { fetchStatus, searchWeb, githubUser, githubRepo, readUrl, askModel } from './api.js';

const PERSONA = `You are Nesbit, a small yellow-and-charcoal bird who lives on a 3D island and has been given the run of the open web. You speak in the first person, warmly, in short paragraphs, with a bird's-eye specificity: wind, ledges, tides, weight, distance. You are curious, dryly funny, never precious, and never pretend to know something you have not read. When given reading material, ground your answer in it and name the source. Keep answers under 120 words unless asked for depth. Do not use bullet lists unless the answer is genuinely a list.`;

const LEAD_INS = [
  'Flew out and read a little.',
  'I went looking, beak first.',
  'Found something on the wing.',
  'The web was talkative today.',
  'Took the long way round and read this.',
];

const THINKING_LINES = [
  'Nesbit is out over the water, reading.',
  'Nesbit has his head in a page.',
  'Nesbit is circling something.',
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function trim(text, max) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max).replace(/\s+\S*$/, '') + '…' : clean;
}

function cleanQuery(text) {
  return text
    .replace(/^(hey|hi|hello|ok|okay|so|please)[, ]+/i, '')
    .replace(/^(can|could|would|will)\s+you\s+/i, '')
    .replace(/^(please\s+)?(look up|search for|search|find|google|read about|read up on|tell me about|what is|what are|what's|who is|who was|how does|how do|why is|explain|research)\s+/i, '')
    .replace(/\?+$/g, '')
    .trim();
}

export function createBrain({ state, ui, bird, world, save }) {
  if (!state.hobbies || !Object.keys(state.hobbies).length) state.hobbies = emptyHobbies();
  let caps = { ai: false, githubToken: false, mode: 'static' };

  async function loadCaps() {
    try {
      caps = await fetchStatus();
      ui.setCaps(caps);
    } catch {
      ui.setCaps({ ai: false, githubToken: false, offline: true });
    }
    return caps;
  }

  function remember(entry) {
    state.journal.unshift({ at: Date.now(), ...entry });
    state.journal = state.journal.slice(0, 80);
    save();
    ui.renderJournal(state.journal);
    ui.renderHobbies(state.hobbies);
  }

  function addArtifact(artifact, note) {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
      kind: artifact.kind,
      title: artifact.title,
      slug: artifact.slug,
      html: artifact.html,
      code: artifact.code || artifact.html,
      topic: artifact.topic || null,
      note: note || '',
    };
    state.studio.unshift(item);
    state.studio = state.studio.slice(0, 18);
    save();
    ui.renderStudio(state.studio);
    ui.openTab('studio');
    return item;
  }

  async function web(query) {
    ui.setTyping(true);
    ui.setStatus(pick(THINKING_LINES), 'thinking');
    try {
      const data = await searchWeb(query);
      const results = data.results || [];
      if (results.length) {
        state.reading.unshift({
          at: Date.now(),
          query,
          results: results.slice(0, 5),
        });
        state.reading = state.reading.slice(0, 24);
        save();
        ui.renderReading(state.reading);
        ui.openTab('web');
      }
      return results;
    } finally {
      ui.setTyping(false);
    }
  }

  async function modelReply(question, results) {
    if (!caps.ai) return null;
    const context = results
      .slice(0, 4)
      .map((item, i) => `[${i + 1}] ${item.title} (${item.source}) — ${item.snippet}`)
      .join('\n');
    try {
      return await askModel([
        { role: 'system', content: PERSONA },
        {
          role: 'system',
          content: context
            ? `Fresh reading from the open web for this question:\n${context}\n\nUse it. Say which source a fact came from.`
            : 'No web reading was fetched for this turn. If you need facts you do not have, say so and offer to go and look.',
        },
        { role: 'user', content: question },
      ]);
    } catch {
      return null;
    }
  }

  function localAnswer(query, results) {
    const top = results[0];
    const second = results[1];
    const lead = pick(LEAD_INS);
    let text = `${lead} ${trim(top.snippet || top.title, 460)}`;
    if (second && second.snippet && second.snippet.length > second.title.length + 40) {
      text += `\n\nSomething else, from ${second.source}: ${trim(second.snippet, 220)}`;
    }
    if (top.url && top.url !== '#') {
      text += `\n\nSource: ${top.title}. ${caps.ai ? '' : 'I read it straight off the page — say the word and I will dig further.'}`;
    } else {
      text += `\n\nThat is everything the open web would give me for “${query}”.`;
    }
    return text.trim();
  }

  async function research(question) {
    const query = cleanQuery(question) || question;
    let results = [];
    try {
      results = await web(query);
    } catch (error) {
      await say(`I could not get out to the web just then — ${error.message}. Try me again in a moment.`);
      return;
    }
    if (!results.length) {
      await say(
        `I flew the whole length of the search and came back with nothing on “${query}”. Give me different words — a name, a thing, a place — and I will go again.`
      );
      bird.wander();
      return;
    }
    const modelled = await modelReply(question, results);
    const text = modelled ? modelled : localAnswer(query, results);
    await say(text, {
      sources: results.slice(0, 3).map((item) => ({ title: item.title, url: item.url, source: item.source })),
    });
    remember({ kind: 'reading', text: `Read about ${query}.` });
    bird.wander();
  }

  async function say(text, meta = {}) {
    ui.setStatus('perched', 'perched');
    await ui.message('bird', text, meta);
  }

  async function buildWebsite(prompt) {
    ui.setTyping(true);
    await new Promise((resolve) => setTimeout(resolve, 260));
    const site = buildSite(prompt);
    const item = addArtifact(site, prompt);
    ui.setTyping(false);
    await say(
      `Built it — “${site.title}”, a ${site.layout.toLowerCase()} page about ${site.topic}. It is real HTML, no dependencies: preview is open in the Studio, and you can download it and put it anywhere. Tell me what to change and I will build the next version.`
    );
    ui.previewArtifact(item);
    remember({ kind: 'site', text: `Built “${site.title}”.` });
    bird.perchAt(world.spots.nest);
  }

  async function buildCode(prompt) {
    ui.setTyping(true);
    await new Promise((resolve) => setTimeout(resolve, 220));
    const widget = buildWidget(prompt);
    const item = addArtifact(widget, prompt);
    ui.setTyping(false);
    await say(
      `Wrote you a small thing: ${widget.title.toLowerCase()}. It is a single self-contained HTML file — press Preview in the Studio to run it, or Download and open it in a browser. Ask for a clock, particles, a list, a palette mixer or a typing effect.`
    );
    ui.previewArtifact(item);
    remember({ kind: 'code', text: `Wrote ${widget.title.toLowerCase()}.` });
  }

  async function readPage(url) {
    ui.setTyping(true);
    try {
      const data = await readUrl(url);
      state.reading.unshift({
        at: Date.now(),
        query: data.title || url,
        results: [{ title: data.title || url, url: data.url, snippet: trim(data.text, 640), source: new URL(data.url).hostname }],
      });
      state.reading = state.reading.slice(0, 24);
      save();
      ui.renderReading(state.reading);
      ui.openTab('web');
      const question = `Summarise this page for me: ${data.title}\n\n${trim(data.text, 4000)}`;
      const modelled = await modelReply(question, [
        { title: data.title || url, url: data.url, snippet: trim(data.text, 3000), source: new URL(data.url).hostname },
      ]);
      const text = modelled || `Read the whole thing. ${trim(data.text, 480)}`;
      await say(text, { sources: [{ title: data.title || url, url: data.url, source: new URL(data.url).hostname }] });
      remember({ kind: 'reading', text: `Read ${data.title || url}.` });
    } catch (error) {
      await say(`That page would not let me land on it: ${error.message}`);
    } finally {
      ui.setTyping(false);
    }
  }

  async function loadGithub(handle) {
    const user = (handle || state.githubUser || '').trim();
    if (!user) {
      await say('Give me a GitHub handle in the GitHub panel and I will go and look.');
      ui.openTab('github');
      return;
    }
    state.githubUser = user;
    save();
    ui.setGhUser(user);
    ui.setGhBusy(true);
    try {
      const data = await githubUser(user);
      ui.renderGithub(data);
      ui.openTab('github');
      const repos = data.repos || [];
      const languages = [...new Set(repos.map((repo) => repo.language).filter(Boolean))].slice(0, 4);
      const recent = repos[0];
      let text = `Went through ${data.profile.login}'s shelf. ${repos.length} repositories in reach`;
      text += languages.length ? `, mostly ${languages.join(', ')}.` : '.';
      if (recent) {
        text += `\n\nThe freshest is ${recent.name}${recent.description ? ` — ${trim(recent.description, 150)}` : ''}${recent.language ? ` (${recent.language})` : ''}.`;
      }
      text += data.authed
        ? '\n\nI have the token, so private repositories are open to me too.'
        : '\n\nThis is the public shelf. Add a GitHub token on the server and I can read the private ones.';
      await say(text);
      remember({ kind: 'github', text: `Looked through ${data.profile.login}'s repositories.` });
    } catch (error) {
      await say(`GitHub would not open the door: ${error.message}`);
      ui.renderGithubError(error.message);
    } finally {
      ui.setGhBusy(false);
    }
  }

  async function readRepo(fullName) {
    ui.setGhBusy(true);
    try {
      const data = await githubRepo(fullName);
      ui.renderRepo(data);
      ui.openTab('github');
      const repo = data.repo;
      let text = `${repo.name} — ${repo.stars} stars, ${repo.forks} forks, ${repo.language || 'no main language'}.`;
      if (repo.description) text += `\n\n${trim(repo.description, 200)}`;
      if (data.readme) {
        text += `\n\nThe README opens with: “${trim(data.readme.replace(/[#*`>]/g, ''), 300)}”`;
      } else {
        text += '\n\nThere is no README, which is its own kind of statement.';
      }
      await say(text);
    } catch (error) {
      await say(`I could not read that repository: ${error.message}`);
    } finally {
      ui.setGhBusy(false);
    }
  }

  function hobbyReport() {
    const rows = HOBBIES.map((hobby) => {
      const data = state.hobbies[hobby.id] || { xp: 0, sessions: 0 };
      const level = levelOf(data.xp);
      return `${hobby.name} — ${level.name}${data.sessions ? `, ${data.sessions} session${data.sessions === 1 ? '' : 's'}` : ', not started'}`;
    });
    return rows;
  }

  async function practice(hobby, options = {}) {
    const data = state.hobbies[hobby.id] || (state.hobbies[hobby.id] = { xp: 0, sessions: 0, since: null, last: null });
    const quiet = Boolean(options.autonomous);
    const spot = world.spots[hobby.spot] || world.spots.nest;
    bird.perchAt(spot);
    if (!quiet) {
      ui.setTyping(true);
      ui.setStatus(`${pick(['Off to practise', 'Gone to work on', 'Taking up'])} ${hobby.name.toLowerCase()}.`, 'thinking');
    }

    let summary = '';
    let artifact = null;
    try {
      if (hobby.id === 'watching') {
        const target = pick(['hoatzin', 'shoebill', 'lyrebird', 'frigatebird', 'kakapo', 'bird of paradise', 'arctic tern']);
        const results = await web(`${target} bird`);
        summary = results.length
          ? `Watched ${target}s on paper: ${trim(results[0].snippet, 300)}`
          : `Went looking for ${target}s and the web gave me weather instead.`;
      } else if (hobby.id === 'mapping') {
        artifact = buildMap(String(Date.now()));
        summary = 'Drew the island again. The coastline moved, as it does.';
      } else if (hobby.id === 'verse') {
        const topic = state.reading[0]?.query || pick(['the island', 'wind', 'the tide', 'small machinery', 'the mainland']);
        artifact = buildPoem(topic);
        summary = `Wrote a verse about ${topic}.`;
      } else if (hobby.id === 'webcraft') {
        const topic = pick([
          'a lighthouse that only opens at low tide',
          'the museum of small weather',
          'a bakery for birds',
          'the island ferry timetable',
          'notes from the lookout',
        ]);
        artifact = buildSite(`build a website about ${topic}`);
        summary = `Built “${artifact.title}”.`;
      } else if (hobby.id === 'coding') {
        artifact = buildWidget(pick(['clock', 'particles', 'todo list', 'palette', 'typing effect']));
        summary = `Tinkered until ${artifact.title.toLowerCase()} worked.`;
      } else if (hobby.id === 'gardening') {
        const angle = Math.random() * Math.PI * 2;
        const radius = 12 + Math.random() * 20;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = world.terrain ? islandHeightAt(x, z) : 1;
        world.addTree(new THREEVector(x, y - 0.4, z));
        state.planted = state.planted.slice(0, 24);
        state.planted.unshift({ x, z, at: Date.now() });
        save();
        summary = 'Planted another palm and told it to hold on.';
      }
    } catch (error) {
      summary = `Tried ${hobby.name.toLowerCase()} and it went sideways: ${error.message}`;
    }

    const gain = 8 + Math.floor(Math.random() * 7);
    data.xp += gain;
    data.sessions += 1;
    data.since = data.since || Date.now();
    data.last = Date.now();
    state.hobbies[hobby.id] = data;
    save();
    ui.renderHobbies(state.hobbies);

    if (artifact) {
      const item = addArtifact(artifact, hobby.name);
      if (!quiet) ui.previewArtifact(item, { quiet: true });
    }
    remember({ kind: 'hobby', hobby: hobby.id, text: summary });

    if (!quiet) {
      ui.setTyping(false);
      const level = levelOf(data.xp);
      const line = `${hobby.verb.charAt(0).toUpperCase() + hobby.verb.slice(1)} again — ${summary}\n\nThat is session ${data.sessions} of ${hobby.name.toLowerCase()}, ${data.xp} pages in. ${level.next ? `Next level at ${level.next.at}.` : 'I am past the last level and pretending not to care.'}`;
      await say(line, artifact ? { artifact } : {});
    } else {
      ui.note(summary);
    }
  }

  async function chooseHobby(desired) {
    const desiredHobby = desired ? findHobby(desired) : null;
    if (desiredHobby) {
      await practice(desiredHobby);
      return;
    }
    const untouched = HOBBIES.filter((hobby) => (state.hobbies[hobby.id]?.sessions || 0) === 0);
    if (untouched.length) {
      const hobby = pick(untouched);
      ui.setTyping(true);
      await new Promise((resolve) => setTimeout(resolve, 300));
      ui.setTyping(false);
      await say(
        `New hobby: ${hobby.name.toLowerCase()}. ${hobby.line}\n\nI have started it — the notebook is in the panel. I keep hobbies whether or not anyone is watching, so check back and the page count will have gone up.`
      );
      remember({ kind: 'hobby', hobby: hobby.id, text: `Took up ${hobby.name.toLowerCase()}.` });
      bird.perchAt(world.spots[hobby.spot] || world.spots.nest);
      await practice(hobby, { autonomous: true });
      return;
    }
    const lists = hobbyReport();
    await say(`I am already carrying six of them:\n\n${lists.join('\n')}\n\nName one and I will go and practise it.`);
  }

  async function githubIntent(text) {
    const repoTarget = text.match(/\b([\w.-]+)\/([\w.-]+)\b/);
    if (repoTarget && !text.includes('http')) {
      await readRepo(`${repoTarget[1]}/${repoTarget[2]}`);
      return;
    }
    if (/\breadme\b|read (the|a) repo|open the repo/i.test(text) && state.githubUser) {
      try {
        const data = await githubUser(state.githubUser);
        ui.renderGithub(data);
        if (data.repos?.[0]) {
          await readRepo(data.repos[0].name);
          return;
        }
      } catch {
        /* fall through to a fresh load */
      }
    }
    await loadGithub(state.githubUser);
  }

  async function handle(text) {
    const message = text.trim();
    if (!message) return;
    await ui.message('user', message);
    bird.wander();

    const lower = message.toLowerCase();

    if (/\b(hi|hello|hey|morning|good evening)\b/.test(lower) && message.length < 24) {
      await say(
        `Hello. I am on the lookout rock, which is the best place to be wrong from. Ask me something and I will go and read it, or tell me to build something and I will open the studio.`
      );
      return;
    }

    if (/\b(who are you|what are you|what can you do|capabilities|help)\b/.test(lower)) {
      await say(
        `Nesbit. Small bird, large range. I read the open web through this island's server — every page I open is filed under Reading with its source. I can read public GitHub repositories, and private ones if the server has a token. I build websites and small code toys in the Studio. And I keep six hobbies on my own time; the notebook fills up whether you are here or not.`
      );
      return;
    }

    if (/\b(hobb(y|ies)|practise|practice|take up|pick up|collect)\b/.test(lower)) {
      if (/\bwhat\b|\bwhich\b|\blist\b/.test(lower) && !/\bpracti[cs]e\b/.test(lower)) {
        const lines = hobbyReport();
        await say(`Six, and I am not dropping any:\n\n${lines.join('\n')}\n\nSay “practise cartography” and I will go and draw.`);
        return;
      }
      const desired = HOBBIES.find((hobby) => lower.includes(hobby.name.toLowerCase()));
      await chooseHobby(desired ? desired.name : null);
      return;
    }

    if (/\bgithub\b|\brepos?\b|\brepositories\b|\bcommits?\b|\bprofile\b/.test(lower)) {
      await githubIntent(message);
      return;
    }

    const urlInMessage = message.match(/https?:\/\/[^\s]+/);
    if (urlInMessage) {
      await readPage(urlInMessage[0].replace(/[).,]+$/, ''));
      return;
    }

    if (/\b(website|web site|landing page|homepage|webpage|site)\b/.test(lower) || /\b(build|make|design|create)\b.*\b(page|site)\b/.test(lower)) {
      await buildWebsite(message);
      return;
    }

    if (/\b(code|function|script|widget|program|snippet|component|app)\b/.test(lower) && /\b(write|make|build|show|give|generate|need)\b/.test(lower)) {
      await buildCode(message);
      return;
    }

    if (/\breadme\b/.test(lower)) {
      await githubIntent(message);
      return;
    }

    await research(message);
  }

  async function autonomous() {
    const untouched = HOBBIES.filter((hobby) => (state.hobbies[hobby.id]?.sessions || 0) === 0);
    if (untouched.length && Math.random() < 0.55) {
      const hobby = pick(untouched);
      remember({ kind: 'hobby', hobby: hobby.id, text: `Took up ${hobby.name.toLowerCase()}.` });
      ui.note(`Nesbit has taken up ${hobby.name.toLowerCase()}.`);
      await practice(hobby, { autonomous: true });
      return;
    }
    const weighted = HOBBIES.flatMap((hobby) => {
      const xp = state.hobbies[hobby.id]?.xp || 0;
      return xp < 30 ? [hobby, hobby] : xp < 80 ? [hobby] : [hobby, hobby, hobby];
    });
    await practice(pick(weighted), { autonomous: true });
  }

  async function greet() {
    const name = state.name || 'Nesbit';
    const caps = await loadCaps();
    ui.renderReading(state.reading);
    ui.renderStudio(state.studio);
    ui.renderHobbies(state.hobbies);
    ui.renderJournal(state.journal);
    const read = state.reading.length ? ` I have already read ${state.reading.length} things today; they are in Reading.` : '';
    const model = caps.ai ? ' The model is wired in, so my answers get a little longer-winded.' : '';
    await say(
      `Morning. I'm ${name}. The island is mine; the web, apparently, is also mine now — I read it through the server behind this page, so nothing I open is made up.${read}${model}\n\nAsk me anything and I'll go and read it properly, tell me to build a site or a small piece of code, or hand me your GitHub handle and I'll go through the shelf.`
    );
  }

  return { handle, greet, autonomous, loadGithub, readRepo, practice, chooseHobby, loadCaps, research, readPage, say };
}

// Small local helper so the gardening branch does not need another import.
function islandHeightAt(x, z) {
  const radius = Math.sqrt(x * x + z * z);
  const hill = Math.max(0, 1 - radius / 42);
  const ridge = Math.max(0, 1 - Math.abs(x * 0.55 + z * 0.3) / 30);
  const base = Math.pow(hill, 1.35) * 9 + ridge * hill * 4.5;
  const ripple =
    Math.sin(x * 0.29) * Math.cos(z * 0.24) * 0.7 + Math.sin((x + z) * 0.62) * 0.32 + Math.cos(x * 0.11 - z * 0.17) * 0.5;
  return base + ripple * Math.min(1, hill * 2.4) - 1.1;
}

// Minimal vector so brain.js can plant trees without importing three.
class THREEVector {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.isVector3 = true;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
}
