(function () {
  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function fmtDate(dt) {
    try { return new Date(dt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch { return dt; }
  }
  function num(n) {
    if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n/1_000).toFixed(1) + "k";
    return String(n);
  }
  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return res.json();
  }
  async function fetchText(url) {
    const res = await fetch(url, { credentials: "omit", mode: "cors" });
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return res.text();
  }

  /* ---------- read config ---------- */
  let cfg = {};
  (function readConfig(){
    const el = document.getElementById('trackers-config');
    if (!el) return;
    try {
      const raw = el.textContent.trim();
      cfg = raw ? JSON.parse(raw.startsWith('"') ? JSON.parse(raw) : raw) : {};
    } catch (_) { cfg = {}; }
  })();

  /* ---------- GitHub: repos + commit activity sparkline ---------- */
  async function fetchCommitActivity(owner, repo, retries=6, delayMs=1500) {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/stats/commit_activity`;
    try {
      const res = await fetch(url);
      if (res.status === 202 && retries > 0) {
        await new Promise(r => setTimeout(r, delayMs));
        return fetchCommitActivity(owner, repo, retries - 1, delayMs * 1.25);
      }
      if (!res.ok) throw new Error(`commit_activity ${res.status}`);
      return res.json(); // [{week, total, days:[7]}] x 52
    } catch {
      return null;
    }
  }

  function sparklineFromWeeklyTotals(weeks) {
    if (!Array.isArray(weeks) || weeks.length === 0) return "";
    const totals = weeks.map(w => w.total);
    const max = Math.max(1, ...totals);
    const bars = totals.map(t => {
      const h = Math.max(2, Math.round((t / max) * 28)); // 2..28px
      return `<div class="mini-bar" style="height:${h}px" title="${t} commits"></div>`;
    }).join("");
    return `<div class="mini-chart" aria-hidden="true">${bars}</div>`;
  }

  async function loadGitHubRepos() {
    const mount = $('gh-repos');
    if (!mount) return;

    const user = (cfg.github && cfg.github.username) || 'Syrinx55';
    const per  = (cfg.github && cfg.github.repos_per_page) || 8;

    try {
      const url = `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=updated&per_page=${per}`;
      const repos = await fetchJSON(url);

      if (!Array.isArray(repos) || repos.length === 0) {
        mount.textContent = 'No repositories found.';
        return;
      }

      mount.innerHTML = `<ul class="repo-list">${
        repos.map(r => `
          <li class="repo-item" data-repo="${r.name}">
            <div class="repo-row">
              <a class="repo-name" href="${r.html_url}" target="_blank" rel="noopener">${r.name}</a>
              <span class="repo-meta">★ ${r.stargazers_count} · updated ${fmtDate(r.updated_at)}</span>
            </div>
            <div class="repo-chart-placeholder">Fetching commit activity…</div>
          </li>
        `).join('')
      }</ul>`;

      // Fill commit charts, retrying if GitHub is warming stats (202)
      for (const r of repos) {
        const item = mount.querySelector(`.repo-item[data-repo="${CSS.escape(r.name)}"] .repo-chart-placeholder`);
        if (!item) continue;
        const activity = await fetchCommitActivity(user, r.name);
        if (!activity) {
          item.textContent = 'Commit activity unavailable (try later).';
        } else {
          item.innerHTML = sparklineFromWeeklyTotals(activity);
        }
      }
    } catch (e) {
      console.error('[trackers] GitHub error:', e);
      mount.textContent = 'Failed to load GitHub repos.';
    }
  }

/* ---------- Bioconda: API + badge + README fallback ---------- */
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
async function fetchText(url) {
  const res = await fetch(url, { credentials: "omit", mode: "cors" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function parseBadgeCount(svgText) {
  const text = svgText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const token = text.split(" ").find(t => /\d/.test(t));
  if (!token) return null;
  let s = token.replace(/,/g, "").toLowerCase();
  if (s.endsWith("k")) return Math.round(parseFloat(s) * 1_000);
  if (s.endsWith("m")) return Math.round(parseFloat(s) * 1_000_000);
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

async function getBiocondaFacts(pkg) {
  let latest = null, summary = "", downloads = null;

  // 1) Primary: Anaconda package API
  try {
    const data = await fetchJSON(`https://api.anaconda.org/package/bioconda/${encodeURIComponent(pkg)}`);
    latest = data.latest_version || latest;
    summary = data.summary || summary;
    if (typeof data.ndownloads === "number") {
      downloads = data.ndownloads;
    } else if (Array.isArray(data.files)) {
      downloads = data.files.reduce((acc, f) => acc + (f.ndownloads || 0), 0);
    }
  } catch (_) { /* fall through */ }

  // 2) Fallback: badge endpoints (SVG → parse text)
  if (downloads == null) {
    try {
      const svg = await fetchText(`https://anaconda.org/bioconda/${encodeURIComponent(pkg)}/badges/downloads.svg`);
      const n = parseBadgeCount(svg);
      if (n != null) downloads = n;
    } catch (_) {}
  }
  if (!latest) {
    try {
      const svg = await fetchText(`https://anaconda.org/bioconda/${encodeURIComponent(pkg)}/badges/version.svg`);
      const match = svg.replace(/<[^>]+>/g, " ").match(/\b\d+(?:\.\d+)*(?:-[0-9A-Za-z\.]+)?\b/);
      if (match) latest = match[0];
    } catch (_) {}
  }

  // 3) Last resort: parse recipe README for a version code span
  if (!latest) {
    try {
      const html = await fetchText(`https://bioconda.github.io/recipes/${encodeURIComponent(pkg)}/README.html`);
      const doc = new DOMParser().parseFromString(html, "text/html");
      const codes = Array.from(doc.querySelectorAll("code"));
      for (const c of codes) {
        const t = c.textContent.trim();
        if (/^\d+(?:\.\d+)*(?:-[0-9A-Za-z\.]+)?$/.test(t)) { latest = t; break; }
      }
      // also try first paragraph as a summary
      if (!summary) {
        const p = (doc.querySelector("main") || doc.body).querySelector("p");
        if (p) summary = p.textContent.trim().replace(/\s+/g, " ");
      }
    } catch (_) {}
  }

  return { latest: latest || "—", summary, downloads: downloads ?? 0 };
}

function numFmt(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n/1_000).toFixed(1) + "k";
  return String(n);
}

async function loadBioconda() {
  const mount = document.getElementById('bioconda-pkgs');
  if (!mount) return;

  const pkgs = (window.__biocfg && Array.isArray(window.__biocfg)) ? window.__biocfg : (
    (window.TRACKERS && window.TRACKERS.bioconda && Array.isArray(window.TRACKERS.bioconda.packages))
      ? window.TRACKERS.bioconda.packages
      : []
  );
  if (pkgs.length === 0) { mount.textContent = 'No Bioconda packages configured.'; return; }

  try {
    const results = await Promise.all(pkgs.map(async (pkg) => {
      const facts = await getBiocondaFacts(pkg);
      const link = `https://anaconda.org/bioconda/${encodeURIComponent(pkg)}`;
      return { pkg, link, ...facts };
    }));

    const maxDl = Math.max(1, ...results.map(r => r.downloads || 0));

    mount.innerHTML = `<ul class="bioconda-list">${
      results.map(r => `
        <li class="bioconda-item">
          <div class="pkg-row">
            <a class="pkg-name" href="${r.link}" target="_blank" rel="noopener">${r.pkg}</a>
            <span class="pkg-meta">v${r.latest}</span>
          </div>
          <div class="dl-row">
            <div class="dl-bar" style="width:${Math.max(4, Math.round((r.downloads / maxDl) * 100))}%"></div>
            <span class="dl-count">${numFmt(r.downloads)} downloads</span>
          </div>
          ${ r.summary ? `<div class="pkg-summary">${r.summary}</div>` : `` }
        </li>
      `).join('')
    }</ul>`;
  } catch (e) {
    console.error('[trackers] Bioconda error:', e);
    mount.textContent = 'Failed to load Bioconda packages.';
  }
}

  document.addEventListener('DOMContentLoaded', () => {
    loadGitHubRepos();
    loadBioconda();
  });
})();
