const MAX_LOG = 60;

export class Ui {
  constructor() {
    this.log = document.getElementById('log');
    this.composer = document.getElementById('composer');
    this.input = document.getElementById('input');
    this.statusPill = document.getElementById('status');
    this.dockHint = document.querySelector('.dock-hint');
    this.rail = document.getElementById('rail');
    this.toastEl = document.getElementById('toast');
    this.followBtn = document.getElementById('follow-btn');
    this.webList = document.getElementById('web-list');
    this.webEmpty = document.getElementById('web-empty');
    this.githubBody = document.getElementById('gh-body');
    this.ghUser = document.getElementById('gh-user');
    this.studio = document.getElementById('studio');
    this.hobbies = document.getElementById('hobbies');
    this.journal = document.getElementById('journal');
    this.typingEl = null;
    this.modal = null;
    this.handlers = {};
    this.bind();
  }

  bind() {
    this.composer.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = this.input.value;
      if (!value.trim()) return;
      this.input.value = '';
      this.handlers.onSend?.(value.trim());
    });

    document.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => this.handlers.onSend?.(chip.textContent.trim()));
    });

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => this.openTab(tab.dataset.tab));
    });

    document.getElementById('rail-btn').addEventListener('click', () => {
      const open = !this.rail.classList.contains('open');
      this.rail.classList.toggle('open', open);
      document.getElementById('rail-btn').setAttribute('aria-expanded', String(open));
    });
    document.getElementById('rail-close').addEventListener('click', () => {
      this.rail.classList.remove('open');
      document.getElementById('rail-btn').setAttribute('aria-expanded', 'false');
    });

    document.getElementById('gh-load').addEventListener('click', () => {
      this.handlers.onGithub?.(this.ghUser.value.trim());
    });

    this.followBtn.addEventListener('click', () => {
      const next = this.followBtn.getAttribute('aria-pressed') !== 'true';
      this.setFollow(next);
      this.handlers.onFollow?.(next);
    });

    document.getElementById('call-btn').addEventListener('click', () => this.handlers.onCall?.());

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.modal) this.closeModal();
    });
  }

  setCaps(caps) {
    const bits = [caps.mode === 'static' ? 'live wikipedia' : 'reads the live web'];
    bits.push(caps.ai ? 'model voice on' : 'grounded voice');
    bits.push(caps.githubToken ? 'github token' : 'github public');
    if (caps.mode === 'static') bits.push('static island');
    this.dockHint.textContent = bits.join(' · ');
  }

  setStatus(text, state = 'perched') {
    this.statusPill.textContent = text;
    this.statusPill.dataset.state = state;
  }

  setFollow(on) {
    this.followBtn.setAttribute('aria-pressed', String(Boolean(on)));
    this.followBtn.textContent = on ? 'Following' : 'Follow';
  }

  setGhUser(user) {
    this.ghUser.value = user;
  }

  setGhBusy(busy) {
    const button = document.getElementById('gh-load');
    button.disabled = busy;
    button.textContent = busy ? 'Loading…' : 'Load';
  }

  setTyping(on) {
    if (on && !this.typingEl) {
      const el = document.createElement('div');
      el.className = 'msg msg-bird msg-typing';
      el.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
      this.log.append(el);
      this.typingEl = el;
      this.scroll();
    } else if (!on && this.typingEl) {
      this.typingEl.remove();
      this.typingEl = null;
    }
  }

  async message(role, text, meta = {}) {
    this.setTyping(false);
    const el = document.createElement('div');
    el.className = `msg msg-${role}`;
    if (role === 'note') el.classList.add('msg-note');

    if (role === 'user') {
      el.textContent = text;
    } else {
      const paragraphs = String(text).split(/\n{2,}/);
      paragraphs.forEach((paragraph) => {
        const p = document.createElement('p');
        p.textContent = paragraph.replace(/\n/g, ' ');
        el.append(p);
      });
      if (meta.sources?.length) {
        const row = document.createElement('div');
        row.className = 'sources';
        meta.sources.forEach((source) => {
          if (!source.url || source.url === '#') return;
          const a = document.createElement('a');
          a.href = source.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.className = 'source';
          a.textContent = source.source || source.title;
          a.title = source.title;
          row.append(a);
        });
        if (row.childElementCount) el.append(row);
      }
      if (meta.artifact) {
        const open = document.createElement('button');
        open.className = 'link-btn';
        open.type = 'button';
        open.textContent = `Open “${meta.artifact.title}”`;
        open.addEventListener('click', () => this.previewArtifact(meta.artifact));
        el.append(open);
      }
    }

    this.log.append(el);
    while (this.log.childElementCount > MAX_LOG) this.log.firstElementChild.remove();
    this.scroll();
    await new Promise((resolve) => setTimeout(resolve, 90));
  }

  note(text) {
    this.message('note', text);
  }

  scroll() {
    this.log.scrollTop = this.log.scrollHeight;
  }

  openTab(name) {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
    });
    document.querySelectorAll('.panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
    if (window.innerWidth < 860) {
      this.rail.classList.add('open');
      document.getElementById('rail-btn').setAttribute('aria-expanded', 'true');
    }
  }

  renderReading(reading) {
    this.webList.replaceChildren();
    this.webEmpty.hidden = reading.length > 0;
    reading.forEach((entry) => {
      const group = document.createElement('article');
      group.className = 'reading';
      const when = new Date(entry.at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const head = document.createElement('header');
      head.innerHTML = `<h3>${escapeHtml(entry.query)}</h3><time>${escapeHtml(when)}</time>`;
      group.append(head);
      entry.results.forEach((result) => {
        const item = document.createElement('div');
        item.className = 'reading-item';
        const link = document.createElement('a');
        link.href = result.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = result.title;
        const source = document.createElement('span');
        source.className = 'reading-source';
        source.textContent = result.source || 'web';
        const snippet = document.createElement('p');
        snippet.textContent = trimText(result.snippet, 220);
        item.append(link, source, snippet);
        group.append(item);
      });
      this.webList.append(group);
    });
  }

  renderGithub(data) {
    this.githubBody.replaceChildren();
    const head = document.createElement('div');
    head.className = 'gh-profile';
    if (data.profile?.avatar) {
      const img = document.createElement('img');
      img.src = data.profile.avatar;
      img.alt = '';
      img.loading = 'lazy';
      head.append(img);
    }
    const info = document.createElement('div');
    info.innerHTML = `<h3>${escapeHtml(data.profile.name || data.profile.login)}</h3>
      <p>${escapeHtml(data.profile.bio || 'No bio on file.')}</p>
      <p class="gh-meta">${data.profile.publicRepos} public repos · ${data.profile.followers} followers${data.authed ? ' · token attached' : ''}</p>`;
    head.append(info);
    this.githubBody.append(head);

    const list = document.createElement('div');
    list.className = 'repo-list';
    (data.repos || []).slice(0, 30).forEach((repo) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'repo';
      card.innerHTML = `<span class="repo-name">${escapeHtml(repo.name)}</span>
        <span class="repo-meta">${repo.language ? escapeHtml(repo.language) : 'no language'} · ${repo.stars}★${repo.private ? ' · private' : ''}</span>
        <span class="repo-desc">${escapeHtml(trimText(repo.description || 'No description.', 120))}</span>`;
      card.addEventListener('click', () => this.handlers.onRepo?.(repo.name));
      list.append(card);
    });
    if (!(data.repos || []).length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No repositories came back.';
      list.append(empty);
    }
    this.githubBody.append(list);
  }

  renderRepo(data) {
    this.githubBody.replaceChildren();
    const repo = data.repo;
    const top = document.createElement('div');
    top.className = 'repo-detail';
    top.innerHTML = `<h3>${escapeHtml(repo.name)}</h3>
      <p class="gh-meta">${repo.stars}★ · ${repo.forks} forks · ${escapeHtml(repo.language || 'no language')} · ${escapeHtml(repo.branch)}</p>
      <p>${escapeHtml(repo.description || 'No description.')}</p>
      <a class="ext" href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer">Open on GitHub</a>`;
    const readme = document.createElement('pre');
    readme.className = 'readme';
    readme.textContent = data.readme || 'No README in this repository.';
    top.append(readme);
    this.githubBody.append(top);
  }

  renderGithubError(message) {
    this.githubBody.replaceChildren();
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = message;
    this.githubBody.append(p);
  }

  renderStudio(items) {
    this.studio.replaceChildren();
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Nothing built yet. Ask for a website or a small piece of code.';
      this.studio.append(p);
      return;
    }
    items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'artifact';
      const when = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
      card.innerHTML = `<header><span class="artifact-kind">${escapeHtml(item.kind)}</span><time>${escapeHtml(when)}</time></header>
        <h3>${escapeHtml(item.title)}</h3>
        ${item.note ? `<p class="artifact-note">${escapeHtml(trimText(item.note, 110))}</p>` : ''}
        <div class="artifact-actions">
          <button type="button" class="btn btn-sm" data-act="open">Preview</button>
          <button type="button" class="btn btn-sm" data-act="download">Download</button>
        </div>`;
      card.querySelector('[data-act="open"]').addEventListener('click', () => this.previewArtifact(item));
      card.querySelector('[data-act="download"]').addEventListener('click', () => this.download(item));
      this.studio.append(card);
    });
  }

  renderHobbies(hobbies) {
    this.hobbies.replaceChildren();
    HOBBIES.forEach((hobby) => {
      const data = hobbies[hobby.id] || { xp: 0, sessions: 0 };
      const level = levelOfLocal(data.xp);
      const row = document.createElement('div');
      row.className = 'hobby';
      row.innerHTML = `<div class="hobby-top"><h3>${escapeHtml(hobby.name)}</h3><span class="hobby-level">${level.name}</span></div>
        <p class="hobby-line">${escapeHtml(hobby.line)}</p>
        <div class="meter"><span style="width:${Math.min(100, (data.xp / 140) * 100)}%"></span></div>
        <p class="hobby-meta">${data.sessions ? `${data.sessions} session${data.sessions === 1 ? '' : 's'} · ${data.xp} pages` : 'Not started — say “take up a hobby”'}</p>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'link-btn';
      button.textContent = data.sessions ? 'Practise now' : 'Take this up';
      button.addEventListener('click', () => this.handlers.onPractise?.(hobby.name));
      row.append(button);
      this.hobbies.append(row);
    });
  }

  renderJournal(journal) {
    this.journal.replaceChildren();
    if (!journal.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'The notebook is empty. It fills on its own.';
      this.journal.append(li);
      return;
    }
    journal.slice(0, 24).forEach((entry) => {
      const li = document.createElement('li');
      const when = new Date(entry.at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      li.innerHTML = `<time>${escapeHtml(when)}</time><span>${escapeHtml(entry.text)}</span>`;
      this.journal.append(li);
    });
  }

  download(item) {
    const blob = new Blob([item.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.slug || 'nesbit-artifact'}.html`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    this.toast('Downloaded.');
  }

  previewArtifact(item, options = {}) {
    if (this.modal) this.closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(item.title)}">
        <header class="modal-head">
          <div>
            <span class="artifact-kind">${escapeHtml(item.kind)}</span>
            <h2>${escapeHtml(item.title)}</h2>
          </div>
          <div class="modal-tools">
            <button type="button" class="btn btn-sm" data-view="preview">Preview</button>
            <button type="button" class="btn btn-sm" data-view="source">Source</button>
            <button type="button" class="btn btn-sm" data-act="copy">Copy</button>
            <button type="button" class="btn btn-sm" data-act="download">Download</button>
            <button type="button" class="btn btn-sm modal-close" aria-label="Close">×</button>
          </div>
        </header>
        <div class="modal-body">
          <iframe class="artifact-frame" title="Preview" sandbox="allow-scripts allow-forms allow-modals allow-popups"></iframe>
          <pre class="artifact-source" hidden></pre>
        </div>
      </div>`;
    document.getElementById('app').append(overlay);
    const frame = overlay.querySelector('.artifact-frame');
    frame.srcdoc = item.html;
    const source = overlay.querySelector('.artifact-source');
    source.textContent = item.code || item.html;
    overlay.querySelector('[data-act="download"]').addEventListener('click', () => this.download(item));
    overlay.querySelector('[data-act="copy"]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.code || item.html);
        this.toast('Source copied.');
      } catch {
        this.toast('Clipboard is blocked here — use Download instead.');
      }
    });
    overlay.querySelectorAll('[data-view]').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view;
        frame.hidden = view !== 'preview';
        source.hidden = view !== 'source';
        overlay.querySelectorAll('[data-view]').forEach((other) => {
          other.classList.toggle('is-active', other === button);
        });
      });
    });
    overlay.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeModal();
    });
    this.modal = overlay;
    if (!options.quiet) this.toast('Opened in the studio viewer.');
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.remove();
    this.modal = null;
  }

  toast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 3200);
  }
}

const LEVELS = [
  { at: 0, name: 'curious' },
  { at: 24, name: 'keen' },
  { at: 60, name: 'devoted' },
  { at: 120, name: 'obsessed' },
];

function levelOfLocal(xp = 0) {
  let current = LEVELS[0];
  for (const level of LEVELS) if (xp >= level.at) current = level;
  return current;
}

const HOBBIES = [
  { id: 'watching', name: 'Birdwatching', line: 'Reads up on other birds and takes notes.' },
  { id: 'mapping', name: 'Cartography', line: 'Draws the island badly and with conviction.' },
  { id: 'verse', name: 'Verse', line: 'Short poems, written between two flights.' },
  { id: 'webcraft', name: 'Webcraft', line: 'Builds little sites for things nobody asked about.' },
  { id: 'coding', name: 'Coding', line: 'Small interactive toys, mostly clocks and particles.' },
  { id: 'gardening', name: 'Gardening', line: 'Plants palms on the island and checks on them.' },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trimText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
}
