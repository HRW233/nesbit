# Nesbit

A small 3D island where a bird reads the live web, builds websites, keeps hobbies, and walks through a GitHub account.

**Live:** https://hrw233.github.io/nesbit/

## What it does

- **Reads the web.** Ask a question and he searches Wikipedia and DuckDuckGo, answers from the actual extract, and files every source under Reading.
- **Builds websites.** Ask for a site and he writes a complete, dependency-free HTML page (poster, editorial, product or zine layout), with Preview, Source, Copy and Download in the studio.
- **Writes code.** Clocks, canvas particles, todo lists, palette mixers, typing effects — each a single runnable HTML file.
- **Reads GitHub.** Public profiles and repositories, with READMEs, star counts and languages.
- **Keeps six hobbies** on his own time: birdwatching, cartography, verse, webcraft, coding and gardening. Gardening plants palms that grow on the island. Everything persists in localStorage.

Click the island to send him somewhere; drag to look around.

## Two ways to run it

### 1. Server (full capability)

```bash
npm install
npm run dev      # http://localhost:3000
```

The Vite dev plugin runs `worker/index.js` as middleware, giving the app `/api/web`, `/api/read`, `/api/github` and optional `/api/chat`. The same handler deploys to a Worker with static assets.

Optional environment variables:

| variable | effect |
| --- | --- |
| `GITHUB_TOKEN` | private repositories and a higher rate limit |
| `OPENAI_API_KEY` | model-written replies (grounded in the fetched pages) |
| `OPENAI_MODEL` | one of the allowlisted models |

Keys stay server-side; the browser never sees them.

### 2. GitHub Pages (this build)

The `.github/workflows/pages.yml` workflow builds `docs/` with `npm run build:pages` and publishes it to Pages. Pages is static, so `src/api.js` falls back to public CORS endpoints: Wikipedia, DuckDuckGo and `api.github.com`. What stays server-only on Pages: reading arbitrary URLs you paste in, private repositories, and the optional model voice.

## Structure

```
src/main.js     scene, camera, click-to-fly, autonomous loop
src/world.js    island terrain, water, palms, lookout, clouds
src/bird.js     bird model, flight steering, wing animation
src/brain.js    intent routing, web grounding, GitHub, hobbies, forge calls
src/forge.js    generated websites, code toys, poems, maps
src/ui.js       chat dock, field-notes rail, studio viewer
src/api.js      server routes with static fallbacks
worker/index.js web search, page reading, GitHub, optional model proxy
```

Hobbies, artifacts and reading history live in localStorage under `nesbit.island.v1`.
