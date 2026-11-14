/**
 * One door for everything the bird needs from outside.
 *
 * On the dev server and on a hosted Worker the island's own /api routes do the
 * work. On a purely static host (GitHub Pages) those routes do not exist, so we
 * fall back to public, CORS-enabled endpoints in the browser: Wikipedia, DuckDuckGo
 * and the public GitHub API. The fallback is honest about what it cannot do —
 * arbitrary page reads and model calls need the server.
 */

const enc = encodeURIComponent;

async function getJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.message || body.error || '';
    } catch {
      /* not JSON */
    }
    const error = new Error(detail || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

function trim(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max).replace(/\s+\S*$/, '') + '…' : clean;
}

export async function fetchStatus() {
  try {
    const res = await fetch('/api/status', { headers: { accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      return { ...data, mode: 'server' };
    }
  } catch {
    /* static host or server down */
  }
  return { ai: false, githubToken: false, mode: 'static' };
}

async function wiki(params) {
  return getJson(`https://en.wikipedia.org/w/api.php?${params}&format=json&origin=*`);
}

async function staticSearch(query) {
  const results = [];
  try {
    const search = await wiki(`action=query&list=search&srlimit=4&srsearch=${enc(query)}`);
    const hits = search.query?.search || [];
    for (const hit of hits.slice(0, 4)) {
      results.push({
        title: hit.title,
        url: `https://en.wikipedia.org/wiki/${enc(hit.title.replace(/ /g, '_'))}`,
        snippet: trim(String(hit.snippet || '').replace(/<[^>]+>/g, ' '), 240),
        source: 'Wikipedia',
      });
    }
    if (hits[0]) {
      const summary = await wiki(
        `action=query&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${enc(hits[0].title)}`
      );
      const pages = summary.query?.pages || {};
      for (const key of Object.keys(pages)) {
        const page = pages[key];
        if (page.extract) {
          results.unshift({
            title: page.title,
            url: `https://en.wikipedia.org/wiki/${enc(page.title.replace(/ /g, '_'))}`,
            snippet: trim(page.extract, 640),
            source: 'Wikipedia',
          });
          break;
        }
      }
    }
  } catch {
    /* Wikipedia blocked or offline; try the other source */
  }

  try {
    const ddg = await getJson(
      `https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&t=nesbit&q=${enc(query)}`
    );
    if (ddg.AbstractText) {
      results.push({
        title: ddg.Heading || query,
        url: ddg.AbstractURL || '#',
        snippet: trim(ddg.AbstractText, 420),
        source: ddg.AbstractSource || 'DuckDuckGo',
      });
    }
    (ddg.RelatedTopics || []).slice(0, 3).forEach((topic) => {
      if (!topic.Text || !topic.FirstURL) return;
      results.push({
        title: topic.Text.split(' - ')[0].slice(0, 90),
        url: topic.FirstURL,
        snippet: trim(topic.Text, 220),
        source: 'DuckDuckGo',
      });
    });
  } catch {
    /* optional source */
  }

  const seen = new Set();
  return {
    query,
    mode: 'static',
    results: results.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    }),
  };
}

export async function searchWeb(query) {
  try {
    const res = await fetch(`/api/web?q=${enc(query)}`, { headers: { accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) return data;
    }
  } catch {
    /* fall through to the public sources */
  }
  return staticSearch(query);
}

function mapUser(profile, repos, authed) {
  return {
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
  };
}

export async function githubUser(user) {
  try {
    const res = await fetch(`/api/github?user=${enc(user)}`, { headers: { accept: 'application/json' } });
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  const [profile, repos] = await Promise.all([
    getJson(`https://api.github.com/users/${enc(user)}`),
    getJson(`https://api.github.com/users/${enc(user)}/repos?per_page=100&sort=updated`).catch(() => []),
  ]);
  return mapUser(profile, repos, false);
}

export async function githubRepo(fullName) {
  try {
    const res = await fetch(`/api/github?repo=${enc(fullName)}`, { headers: { accept: 'application/json' } });
    if (res.ok) return await res.json();
  } catch {
    /* fall through */
  }
  const meta = await getJson(`https://api.github.com/repos/${fullName}`);
  let readme = '';
  try {
    const data = await getJson(`https://api.github.com/repos/${fullName}/readme`);
    readme = decodeBase64(data.content || '');
  } catch {
    readme = '';
  }
  return {
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
    readme: readme.slice(0, 6000),
    readmeTruncated: readme.length > 6000,
    authed: false,
  };
}

function decodeBase64(value) {
  const clean = String(value).replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function readUrl(url) {
  try {
    const res = await fetch(`/api/read?url=${enc(url)}`, { headers: { accept: 'application/json' } });
    if (res.ok) return await res.json();
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  } catch (error) {
    if (error.status) throw error;
    throw new Error(
      'this build has no server behind it, so it cannot fetch arbitrary pages — only Wikipedia and GitHub are reachable from a static host'
    );
  }
}

export async function askModel(messages) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.text || null;
  } catch {
    return null;
  }
}
