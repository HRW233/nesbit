/**
 * The island's server. Everything the bird "knows" from outside arrived
 * through here: live web search, page reading, GitHub, and an optional
 * language-model upgrade. No key ever reaches the browser.
 */

const UA = 'NesbitIsland/1.0 (a small bird reading the web)';
const MODEL_ALLOWLIST = ['gpt-4o-mini', 'gpt-4.1-mini'];

const json = (data, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'access-control-allow-origin': '*',
    },
  });

function isBlockedHost(hostname) {
  const host = hostname.toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  if (host.includes(':')) return true; // ipv6 literals and ports
  return false;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function textFromHtml(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function titleFromHtml(html, fallback) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1]).replace(/\s+/g, ' ').trim() : fallback;
}

function trimSentences(text, max = 420) {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return (stop > 120 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…');
}

async function wikipediaSearch(query, limit = 4) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&list=search&srlimit=' +
    limit +
    '&srsearch=' +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.query?.search || []).map((item) => ({
    title: item.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
    snippet: trimSentences(textFromHtml(item.snippet || ''), 240),
    source: 'Wikipedia',
    pageid: item.pageid,
  }));
}

async function wikipediaSummary(title) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*' +
    '&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=' +
    encodeURIComponent(title);
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) return null;
  const data = await res.json();
  const pages = data.query?.pages || {};
  for (const key of Object.keys(pages)) {
    const page = pages[key];
    if (page.extract) {
      return {
        title: page.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
        snippet: trimSentences(page.extract, 640),
        source: 'Wikipedia',
      };
    }
  }
  return null;
}

async function duckDuckGo(query) {
  const url =
    'https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&t=nesbit&q=' +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  if (data.AbstractText) {
    out.push({
      title: data.Heading || query,
      url: data.AbstractURL || '#',
      snippet: trimSentences(data.AbstractText, 420),
      source: data.AbstractSource || 'DuckDuckGo',
    });
  }
  for (const topic of (data.RelatedTopics || []).slice(0, 4)) {
    if (!topic.Text || !topic.FirstURL) continue;
    out.push({
      title: topic.Text.split(' - ')[0].slice(0, 90),
      url: topic.FirstURL,
      snippet: trimSentences(topic.Text, 220),
      source: 'DuckDuckGo',
    });
  }
  return out;
}

async function handleWeb(url) {
  const query = (url.searchParams.get('q') || '').trim();
  if (!query) return json({ error: 'Ask for something with ?q=' }, 400);
  const [wiki, ddg] = await Promise.allSettled([wikipediaSearch(query), duckDuckGo(query)]);
  const base = wiki.status === 'fulfilled' ? wiki.value : [];
  const extra = ddg.status === 'fulfilled' ? ddg.value : [];
  const top = base[0];
  const summary = top ? await wikipediaSummary(top.title).catch(() => null) : null;
  const results = [summary, ...base, ...extra].filter(Boolean);
  const seen = new Set();
  const unique = results.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
  if (!unique.length) {
    return json({
      query,
      results: [],
      note: 'Nothing came back from the open web for that. Try different words.',
    });
  }
  return json({ query, results: unique.slice(0, 6), fetchedAt: new Date().toISOString() }, 200, 'public, max-age=300');
}

async function handleRead(url) {
  const target = url.searchParams.get('url');
  if (!target) return json({ error: 'Give a ?url=' }, 400);
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: 'That is not a URL.' }, 400);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    return json({ error: 'That address is off limits.' }, 403);
  }
  const res = await fetch(parsed.toString(), {
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5' },
    redirect: 'follow',
  });
  if (!res.ok) return json({ error: `The page answered ${res.status}.` }, 502);
  const type = res.headers.get('content-type') || '';
  const raw = await res.text();
  const text = type.includes('html') ? textFromHtml(raw) : raw.replace(/\s+/g, ' ');
  return json(
    {
      url: parsed.toString(),
      title: type.includes('html') ? titleFromHtml(raw, parsed.hostname) : parsed.hostname,
      text: text.slice(0, 12000),
      truncated: text.length > 12000,
    },
    200,
    'public, max-age=300'
  );
}

async function githubFetch(path, env, accept) {
  const headers = {
    'user-agent': UA,
    accept: accept || 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
  if (env.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  return res;
}

async function handleGithub(url, env) {
  const repo = url.searchParams.get('repo');
  const user = (url.searchParams.get('user') || '').trim();
  const authed = Boolean(env.GITHUB_TOKEN);

  if (repo) {
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return json({ error: 'Repo should look like owner/name.' }, 400);
    const [metaRes, readmeRes] = await Promise.all([
      githubFetch(`/repos/${repo}`, env),
      githubFetch(`/repos/${repo}/readme`, env, 'application/vnd.github.raw'),
    ]);
    if (!metaRes.ok) {
      return json({ error: `GitHub answered ${metaRes.status} for ${repo}.` }, metaRes.status === 404 ? 404 : 502);
    }
    const meta = await metaRes.json();
    const readme = readmeRes.ok ? (await readmeRes.text()).slice(0, 6000) : '';
    return json({
      repo: {
        name: meta.full_name,
        description: meta.description,
        url: meta.html_url,
        stars: meta.stargazers_count,
        forks: meta.forks_count,
        language: meta.language,
        branch: meta.default_branch,
        updated: meta.pushed_at,
        topics: meta.topics || [],
        private: meta.private,
      },
      readme,
      readmeTruncated: readme.length >= 6000,
      authed,
    });
  }

  const who = user || (authed ? null : '');
  if (!who && !authed) return json({ error: 'Give a GitHub handle with ?user=' }, 400);
  const profileRes = await githubFetch(who ? `/users/${encodeURIComponent(who)}` : '/user', env);
  if (!profileRes.ok) {
    return json({ error: `GitHub answered ${profileRes.status}.` }, profileRes.status === 404 ? 404 : 502);
  }
  const profile = await profileRes.json();
  const reposRes = await githubFetch(
    who ? `/users/${encodeURIComponent(who)}/repos?per_page=100&sort=updated` : '/user/repos?per_page=100&sort=updated',
    env
  );
  const repos = reposRes.ok ? await reposRes.json() : [];
  return json({
    profile: {
      login: profile.login,
      name: profile.name,
      bio: profile.bio,
      avatar: profile.avatar_url,
      url: profile.html_url,
      publicRepos: profile.public_repos,
      followers: profile.followers,
    },
    repos: (Array.isArray(repos) ? repos : []).map((repo) => ({
      name: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      updated: repo.pushed_at,
      topics: repo.topics || [],
      private: repo.private,
      archived: repo.archived,
    })),
    authed,
  });
}

async function handleChat(request, env) {
  if (!env.OPENAI_API_KEY) {
    return json(
      {
        error: 'no-model',
        detail:
          'No language-model key is set, so the bird is speaking with his own grounded brain. Add OPENAI_API_KEY to enable the model.',
      },
      501
    );
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Send JSON with messages.' }, 400);
  }
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
  const requested = typeof body?.model === 'string' ? body.model : '';
  const model = MODEL_ALLOWLIST.includes(requested) ? requested : process.env.OPENAI_MODEL && MODEL_ALLOWLIST.includes(process.env.OPENAI_MODEL) ? process.env.OPENAI_MODEL : MODEL_ALLOWLIST[0];
  const res = await fetch('https://freebuff.com/api/v1/paid/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0.8, max_tokens: 320 }),
  });
  if (!res.ok) {
    return json({ error: 'model-failed', status: res.status, detail: (await res.text()).slice(0, 300) }, 502);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return json({ text, model });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    }
    try {
      if (pathname === '/api/status') {
        return json({
          ai: Boolean(env.OPENAI_API_KEY),
          githubToken: Boolean(env.GITHUB_TOKEN),
          model: env.OPENAI_MODEL || MODEL_ALLOWLIST[0],
        });
      }
      if (pathname === '/api/web') return await handleWeb(url);
      if (pathname === '/api/read') return await handleRead(url);
      if (pathname === '/api/github') return await handleGithub(url, env);
      if (pathname === '/api/chat' && request.method === 'POST') return await handleChat(request, env);
      if (pathname.startsWith('/api/')) return json({ error: 'No such door.' }, 404);
    } catch (error) {
      return json({ error: 'The island had trouble reaching the outside.', detail: String(error?.message || error) }, 502);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
