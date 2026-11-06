// Outils partagés de l'interface d'Aucteva : accès au serveur, formatage, icônes, notifications, statuts.
import { t, getLang } from "./i18n.js";
import { DIMENSIONS, TOPICS } from "./engine.js";

export const BRAND = "Aucteva";

export async function api(path, body) {
  const r = await fetch(`/api${path}`, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(data.erreur || `Le service répond ${r.status}.`);
  return data;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const loc = () => (getLang() === "en" ? "en-GB" : "fr-FR");
export const fmtInt = (n) => new Intl.NumberFormat(loc()).format(Number(n) || 0);
export const fmtDay = (ms) => (ms ? new Intl.DateTimeFormat(loc(), { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms)) : "");
export const fmtStamp = (ms) => (ms ? new Intl.DateTimeFormat(loc(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms)) : "");
export const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);
export const countWords = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;
export const plural = (n, one, many) => (n > 1 ? many : one);
export const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Session : brouillon du parcours guidé, dossiers hors ligne.
export const session = {
  get(key, fallback) { try { const v = sessionStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ } },
};

let toastTimer = null;
export function toast(text, kind = "") {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
  el.className = `toast${kind ? ` toast--${kind}` : ""}`;
  el.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3600);
}

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  toast(t("common.copied"));
}

// Icônes au trait, 20 px, couleur héritée.
const svg = (d, w = 20) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  overview: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  tools: svg('<path d="M4 7h16M4 12h16M4 17h10"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  files: svg('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5"/>'),
  queue: svg('<path d="M5 12.5 9.5 17 19 7.5"/>'),
  registry: svg('<path d="M4.5 5.5h15v13h-15zM4.5 9.5h15M9.5 9.5v9"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>'),
  plug: svg('<path d="M9 3.5v4M15 3.5v4M7 7.5h10v3a5 5 0 0 1-10 0zM12 15.5v5"/>'),
  back: svg('<path d="M15 6l-6 6 6 6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  clip: svg('<path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l8-8"/>'),
  chat: svg('<path d="M5 5.5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8.5L6 20v-3.5H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M8.5 10h7M8.5 13h4.5"/>'),
  send: svg('<path d="M12 19V5m0 0-6 6m6-6 6 6"/>'),
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>', 18),
  upload: svg('<path d="M12 15.5V4.5m0 0-4 4m4-4 4 4M5 15v3.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V15"/>', 22),
  check: svg('<path d="M5 12.5 9.5 17 19 7.5"/>', 16),
  x: svg('<path d="M6 6l12 12M18 6 6 18"/>', 16),
  menu: svg('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  print: svg('<path d="M7 9V3.5h10V9M7 17H4.5V9.5h15V17H17M7 14h10v6.5H7z"/>', 18),
  link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 18),
  doc: svg('<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5Z"/><path d="M14 3.5V8h4"/>', 18),
  up: svg('<path d="m6 15 6-6 6 6"/>', 16),
  down: svg('<path d="m6 9 6 6 6-6"/>', 16),
  lock: svg('<rect x="5.5" y="10.5" width="13" height="9" rx="1.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 16),
};

export const LOGO = `<span class="logo"><svg class="logo__mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect width="24" height="24" rx="6" fill="currentColor"/><path d="M7 17.5 12 6.5l5 11M8.9 13.5h6.2" fill="none" stroke="var(--logo-ink, #fff)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="logo__word">Aucteva</span></span>`;

// Statut de flux d'un dossier : où il en est entre préparation, validation et décision.
export function stage(x) {
  if (x.statut === "erreur") return { key: "failed", tone: "danger" };
  if (x.statut === "attente_lecture") return { key: "waiting", tone: "neutral" };
  if (x.statut !== "termine") return { key: "running", tone: "info" };
  if (x.decision) return { key: "decided", tone: "ok" };
  if (x.validation) return { key: "validated", tone: "info" };
  return { key: "prepared", tone: "neutral" };
}
export const stagePill = (x) => { const s = stage(x); return `<span class="pill pill--${s.tone}">${esc(t(`st.${s.key}`))}</span>`; };
export const avisPill = (verdict) => verdict ? `<span class="avis avis--${esc(verdict)}"><i aria-hidden="true"></i>${esc(t(`avis.${verdict}`))}</span>` : `<span class="muted">${esc(t("avis.none"))}</span>`;
export const decisionPill = (dec) => dec ? `<span class="avis avis--${dec.decision === "autorise" ? "VERT" : dec.decision === "refuse" ? "ROUGE" : "ORANGE"}"><i aria-hidden="true"></i>${esc(t(`dec.${dec.decision}`))}</span>` : `<span class="muted">${esc(t("wf.pending"))}</span>`;

// Statut des clauses et des domaines.
export const CLAUSE = { protectrice: "ok", "ambiguë": "warn", dangereuse: "danger", absent: "review", absentNA: "neutral" };
export const CLAUSE_LABEL = {
  fr: { protectrice: "Protectrice", "ambiguë": "Ambiguë", dangereuse: "Dangereuse", absent: "À examiner", absentNA: "Non requise" },
  en: { protectrice: "Protective", "ambiguë": "Ambiguous", dangereuse: "Risky", absent: "To review", absentNA: "Not required" },
};
export const clauseLabel = (k) => CLAUSE_LABEL[getLang()][k] || k;
export const clausePill = (k) => `<span class="cl cl--${CLAUSE[k] || "neutral"}">${esc(clauseLabel(k))}</span>`;

// Constats par sujet. Les dossiers anciens n'ont pas « constats » : on les reconstitue depuis les clauses.
export function constatsOf(r) {
  if (Array.isArray(r.constats) && r.constats.length) return r.constats;
  const byLabel = new Map(TOPICS.map((x) => [x.label, x]));
  const out = new Map(TOPICS.map((x) => [x.id, { topic: x.id, sujet: x.label, statut: "absent", citation: null, note: null, base: x.legal, pertinent: false }]));
  for (const c of r.clauses_critiques || []) { const x = byLabel.get(c.sujet); if (x) out.set(x.id, { ...out.get(x.id), statut: c.statut, citation: (c.extrait || "").replace(/…$/, ""), note: c.note, partiel: /…$/.test(c.extrait || "") }); }
  for (const c of r.clauses_protectrices || []) { const x = byLabel.get(c.sujet); if (x) out.set(x.id, { ...out.get(x.id), statut: "protectrice", citation: (c.extrait || "").replace(/…$/, ""), note: c.note, partiel: /…$/.test(c.extrait || "") }); }
  for (const c of r.clauses_manquantes || []) { const x = byLabel.get(c.sujet); if (x) out.set(x.id, { ...out.get(x.id), pertinent: true }); }
  return [...out.values()];
}

const RANK = { dangereuse: 4, "ambiguë": 3, absent: 2, protectrice: 1, absentNA: 0 };
export const statusKey = (c) => (c.statut === "absent" ? (c.pertinent ? "absent" : "absentNA") : c.statut);
export function dimensionsOf(r) {
  const cs = constatsOf(r);
  return DIMENSIONS.map((d) => {
    const items = d.topics.map((id) => cs.find((c) => c.topic === id)).filter(Boolean);
    const worst = items.map(statusKey).sort((a, b) => RANK[b] - RANK[a])[0] || "absentNA";
    return { id: d.id, items, status: worst };
  });
}
