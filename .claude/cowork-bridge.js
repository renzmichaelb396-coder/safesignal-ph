/**
 * COWORK BRIDGE — fast GitHub API helpers for Claude Cowork sessions
 * Paste into Chrome console while on github.com/renzmichaelb396-coder/safesignal-ph
 *
 * Usage:
 *   gh.read(path)              -> { content, sha }
 *   gh.update(path, str, msg)  -> commitSha  (single file, create or update)
 *
 * NOTE: gh.read() works via browser session cookies (no PAT needed).
 *       gh.update() requires explicit Authorization header (PAT) — not available
 *       in browser session. Use CM6 web editor for all write operations.
 */
window.gh = {
  read: async (p) => {
    const r = await fetch(`https://api.github.com/repos/renzmichaelb396-coder/safesignal-ph/contents/${p}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } });
    if (!r.ok) return { ok: false, error: await r.text() };
    const d = await r.json();
    return { ok: true, content: atob(d.content.replace(/\n/g,'')), sha: d.sha };
  }
};
// Install: paste this entire file into Chrome DevTools console on github.com
// Then: const { content, sha } = await gh.read('src/components/SomeFile.tsx');
