// Application d'Aucteva : coque avec navigation latérale, vue d'ensemble, outils, dossiers, file de validation, registre, paramètres, connecteur.
import { t, getLang, setLang } from "./i18n.js";
import { api, esc, fmtInt, fmtDay, fmtStamp, ICON, LOGO, stage, stagePill, avisPill, decisionPill, copy, toast, rerender } from "./ui.js";
import { askBar } from "./ask.js";

const NAV = [
  ["overview", "/app", ICON.overview], ["tools", "/app/outils", ICON.tools], ["new", "/app/nouveau", ICON.plus],
  ["assessments", "/app/dossiers", ICON.files], ["queue", "/app/validation", ICON.queue], ["registry", "/app/registre", ICON.registry], ["settings", "/app/parametres", ICON.settings],
];

let cache = { at: 0, rows: null };
export async function registre(force = false) {
  if (!force && cache.rows && Date.now() - cache.at < 8000) return cache.rows;
  const { dossiers } = await api("/registre");
  cache = { at: Date.now(), rows: dossiers };
  return dossiers;
}
export const invalidate = () => { cache = { at: 0, rows: null }; };

export function shellLayout(root, current, { flush = false } = {}) {
  const pending = (cache.rows || []).filter((x) => x.statut === "termine" && (!x.validation || !x.decision)).length;
  root.innerHTML = `
    <a class="skip" href="#vue">${getLang() === "en" ? "Skip to content" : "Aller au contenu"}</a>
    <div class="shell" id="shell">
      <div class="topm"><a class="home" href="/" style="color:#fff;text-decoration:none">${LOGO}</a><button type="button" id="menu" aria-label="Menu" aria-expanded="false">${ICON.menu}</button></div>
      <aside class="side" aria-label="${getLang() === "en" ? "Application" : "Application"}">
        <a class="home" href="/">${LOGO}</a>
        <nav class="side__nav">
          ${NAV.map(([k, h, i]) => `<a href="${h}"${k === current ? ' aria-current="page"' : ""}>${i}<span>${t(`app.${k}`)}</span>${k === "queue" && pending ? `<span class="count">${pending}</span>` : ""}</a>`).join("")}
          <div class="side__sep"></div>
          <a href="/app/connecteur"${current === "connector" ? ' aria-current="page"' : ""}>${ICON.plug}<span>${t("app.connector")}</span></a>
        </nav>
        <div class="side__foot">
          <span class="side__badge">${t("app.demoBadge")}</span>
          <button type="button" class="langbtn" data-lang>${t("lang.code")}</button>
          <a href="/">${ICON.back}${t("app.site")}</a>
        </div>
      </aside>
      <main class="main${flush ? " main--flush" : ""}" id="vue"></main>
    </div>`;
  root.querySelector("[data-lang]").addEventListener("click", () => { setLang(getLang() === "en" ? "fr" : "en"); rerender(); });
  const shell = root.querySelector("#shell"), menu = root.querySelector("#menu");
  menu.addEventListener("click", () => { const o = !shell.classList.contains("is-menu"); shell.classList.toggle("is-menu", o); menu.setAttribute("aria-expanded", String(o)); });
  shell.querySelectorAll(".side a").forEach((a) => a.addEventListener("click", () => shell.classList.remove("is-menu")));
  return root.querySelector("#vue");
}

const ph = (title, sub, actions = "") => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${actions}</div>`;
const skeleton = (n = 6) => `<div class="card"><div style="padding:16px;display:grid;gap:14px">${Array.from({ length: n }, () => `<span class="sk"></span>`).join("")}</div></div>`;
const errBox = (msg) => `<div class="err"><span>${t("tbl.error")} : ${esc(msg)}</span><button type="button" class="btn btn--secondary btn--sm" data-retry>${t("tbl.retry")}</button></div>`;
const lvl = (s) => (s == null ? `<span class="muted">·</span>` : `<span class="lvl"><span class="lvl__bar"><span style="width:${s}%"></span></span>${s}</span>`);
export const dossierHref = (x) => (x.statut === "termine" ? `/app/dossier/${x.id}` : `/app/en-cours/${x.id}`);

// Tableau de dossiers : recherche, filtres, tri, pagination. Reste fluide sur plusieurs centaines de lignes.
function dossierTable(el, rows, { pageSize = 25, compact = false } = {}) {
  const st = { q: "", stage: "", avis: "", sort: "maj", dir: -1, page: 0 };
  const cols = [
    ["outil", t("tbl.tool")], ["cas_usage", t("tbl.usecase")], ["stage", t("tbl.status")], ["score", t("tbl.level")], ["responsable", t("tbl.owner")], ["maj", t("tbl.updated")],
  ];
  const val = (x, k) => (k === "stage" ? stage(x).key : k === "score" ? x.score ?? -1 : k === "maj" ? x.maj || x.cree : String(x[k] || "").toLowerCase());
  el.innerHTML = `
    <div class="card">
      ${compact ? "" : `<div class="filters">
        <label class="search"><span class="sr-only">${t("tbl.search")}</span>${ICON.search}<input type="search" placeholder="${esc(t("tbl.search"))}" data-f="q"></label>
        <label><span class="sr-only">${t("tbl.status")}</span><select class="select" data-f="stage"><option value="">${t("tbl.allStatus")}</option>${["running", "waiting", "prepared", "validated", "decided", "failed"].map((k) => `<option value="${k}">${t(`st.${k}`)}</option>`).join("")}</select></label>
        <label><span class="sr-only">${t("tbl.avis")}</span><select class="select" data-f="avis"><option value="">${t("tbl.allAvis")}</option>${["VERT", "ORANGE", "ROUGE"].map((k) => `<option value="${k}">${t(`avis.${k}`)}</option>`).join("")}</select></label>
      </div>`}
      <div class="tablewrap"><table class="table table--cards"><thead><tr>${cols.map(([k, l]) => `<th scope="col"${compact ? "" : ` aria-sort="none"`}>${compact ? l : `<button type="button" data-sort="${k}">${l}<span class="ar"></span></button>`}</th>`).join("")}<th scope="col"><span class="sr-only">${t("tbl.open")}</span></th></tr></thead><tbody></tbody></table></div>
      <div class="pager" hidden></div>
    </div>`;
  const tbody = el.querySelector("tbody"), pager = el.querySelector(".pager");
  const paint = () => {
    const q = st.q.toLowerCase();
    let list = rows.filter((x) => (!q || `${x.id} ${x.outil} ${x.fournisseur} ${x.cas_usage || ""} ${x.responsable || ""}`.toLowerCase().includes(q)) && (!st.stage || stage(x).key === st.stage) && (!st.avis || x.verdict === st.avis));
    list = list.sort((a, b) => { const va = val(a, st.sort), vb = val(b, st.sort); return (va > vb ? 1 : va < vb ? -1 : 0) * st.dir; });
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    st.page = Math.min(st.page, pages - 1);
    const slice = compact ? list.slice(0, pageSize) : list.slice(st.page * pageSize, st.page * pageSize + pageSize);
    tbody.innerHTML = slice.length ? slice.map((x) => `
      <tr>
        <td class="c-full" data-k=""><a class="t-tool" href="${dossierHref(x)}">${esc(x.outil)}</a><div class="small muted">${esc(x.fournisseur)} · <span class="mono">${esc(x.id)}</span></div></td>
        <td class="c-hide"><span class="t-uc">${esc(x.cas_usage || "")}</span></td>
        <td data-k="${esc(t("tbl.status"))}">${stagePill(x)}${x.verdict ? `<div style="margin-top:6px" class="small">${avisPill(x.verdict)}</div>` : ""}</td>
        <td data-k="${esc(t("tbl.level"))}">${lvl(x.score)}</td>
        <td class="c-hide">${x.responsable ? esc(x.responsable) : `<span class="muted">${t("tbl.notset")}</span>`}</td>
        <td data-k="${esc(t("tbl.updated"))}" class="small muted">${esc(fmtStamp(x.maj || x.cree))}</td>
        <td><a class="btn btn--secondary btn--sm" href="${dossierHref(x)}">${t("tbl.open")}</a></td>
      </tr>`).join("") : `<tr><td colspan="7" class="empty">${t("tbl.empty")}</td></tr>`;
    if (!compact && list.length > pageSize) {
      pager.hidden = false;
      pager.innerHTML = `<span>${st.page * pageSize + 1} à ${Math.min(list.length, (st.page + 1) * pageSize)} ${t("tbl.of")} ${fmtInt(list.length)}</span><span style="display:flex;gap:8px"><button type="button" class="btn btn--secondary btn--sm" data-p="-1"${st.page === 0 ? " disabled" : ""}>${t("tbl.prev")}</button><button type="button" class="btn btn--secondary btn--sm" data-p="1"${st.page >= pages - 1 ? " disabled" : ""}>${t("tbl.next")}</button></span>`;
      pager.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => { st.page += Number(b.dataset.p); paint(); }));
    } else pager.hidden = true;
    el.querySelectorAll("th[aria-sort]").forEach((th) => { const k = th.querySelector("button").dataset.sort; th.setAttribute("aria-sort", k === st.sort ? (st.dir > 0 ? "ascending" : "descending") : "none"); th.querySelector(".ar").innerHTML = k === st.sort ? (st.dir > 0 ? ICON.up : ICON.down) : ""; });
  };
  el.querySelectorAll("[data-f]").forEach((i) => i.addEventListener("input", () => { st[i.dataset.f] = i.value; st.page = 0; paint(); }));
  el.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.sort; st.dir = st.sort === k ? -st.dir : k === "outil" ? 1 : -1; st.sort = k; paint(); }));
  paint();
}

async function withRows(view, render) {
  try { render(await registre()); }
  catch (e) { view.querySelector("[data-body]").innerHTML = errBox(e.message); view.querySelector("[data-retry]")?.addEventListener("click", () => { invalidate(); withRows(view, render); }); }
}

export function renderOverview(root) {
  document.title = `${t("app.overview")}, Aucteva`;
  const v = shellLayout(root, "overview");
  v.innerHTML = `${ph(t("ov.title"), t("ov.sub"), `<a class="btn btn--secondary" href="/app/nouveau/formulaire">${ICON.files}${t("new.tab.guided")}</a>`)}<section class="newask newask--ov"><h2>${t("ov.ask")}</h2><div id="ovask"></div></section><div data-body><div class="kpis">${Array.from({ length: 5 }, () => `<div class="kpi"><span class="sk" style="width:60%"></span><span class="sk" style="height:26px;margin-top:12px;width:40%"></span></div>`).join("")}</div>${skeleton()}</div>`;
  askBar(v.querySelector("#ovask"), { tone: "light", chips: 5 });
  withRows(v, (rows) => {
    const tools = new Set(rows.map((x) => `${x.outil}|${x.fournisseur}`.toLowerCase())).size;
    const running = rows.filter((x) => ["en_attente", "en_cours", "en_attente_api", "en_cours_api", "attente_lecture"].includes(x.statut)).length;
    const pending = rows.filter((x) => x.statut === "termine" && !x.validation).length;
    const decided = rows.filter((x) => x.decision).length;
    const review = rows.filter((x) => x.statut === "erreur" || (x.verdict === "ROUGE" && !x.decision)).length;
    const k = (label, n, hint = "") => `<div class="kpi"><div class="kpi__label">${label}</div><div class="kpi__val">${fmtInt(n)}</div>${hint ? `<div class="kpi__hint">${hint}</div>` : ""}</div>`;
    v.querySelector("[data-body]").innerHTML = `
      <div class="kpis">${k(t("kpi.tools"), tools)}${k(t("kpi.running"), running)}${k(t("kpi.pending"), pending)}${k(t("kpi.decided"), decided)}${k(t("kpi.review"), review, t("kpi.review.hint"))}</div>
      <div class="card__head" style="border:0;padding:0 0 12px"><h2 style="font-size:16px">${t("ov.recent")}</h2><a href="/app/dossiers">${t("ov.all")}</a></div>
      <div id="tbl"></div>`;
    dossierTable(v.querySelector("#tbl"), rows, { pageSize: 8, compact: true });
  });
}

export function renderAssessments(root) {
  document.title = `${t("as.title")}, Aucteva`;
  const v = shellLayout(root, "assessments");
  v.innerHTML = `${ph(t("as.title"), t("as.sub"), `<a class="btn" href="/app/nouveau">${ICON.plus}${t("app.new")}</a>`)}<div data-body>${skeleton(10)}</div>`;
  withRows(v, (rows) => dossierTable(v.querySelector("[data-body]"), rows));
}

// Un outil par ligne : le dossier le plus récent fait foi.
function byTool(rows) {
  const m = new Map();
  for (const x of [...rows].sort((a, b) => (b.maj || b.cree) - (a.maj || a.cree))) {
    const k = `${x.outil}|${x.fournisseur}`.toLowerCase();
    if (!m.has(k)) m.set(k, { last: x, count: 0, lastDone: null });
    const e = m.get(k); e.count++;
    if (!e.lastDone && x.statut === "termine") e.lastDone = x;
  }
  return [...m.values()];
}

export function renderTools(root) {
  document.title = `${t("tools.title")}, Aucteva`;
  const v = shellLayout(root, "tools");
  v.innerHTML = `${ph(t("tools.title"), t("tools.sub"))}<div data-body>${skeleton()}</div>`;
  withRows(v, (rows) => {
    const tools = byTool(rows);
    v.querySelector("[data-body]").innerHTML = `<div class="card"><div class="filters"><label class="search"><span class="sr-only">${t("tbl.search")}</span>${ICON.search}<input type="search" id="q" placeholder="${esc(t("tbl.search"))}"></label></div><div class="tablewrap"><table class="table table--cards"><thead><tr><th>${t("tbl.tool")}</th><th>${t("tbl.count")}</th><th>${t("tbl.avis")}</th><th>${t("tbl.decision")}</th><th>${t("tbl.updated")}</th><th></th></tr></thead><tbody></tbody></table></div></div>`;
    const tb = v.querySelector("tbody");
    const paint = (q = "") => {
      const list = tools.filter((e) => !q || `${e.last.outil} ${e.last.fournisseur}`.toLowerCase().includes(q.toLowerCase()));
      tb.innerHTML = list.length ? list.map((e) => { const d = e.lastDone || e.last; return `<tr><td class="c-full"><a class="t-tool" href="${dossierHref(d)}">${esc(d.outil)}</a><div class="small muted">${esc(d.fournisseur)}</div></td><td data-k="${esc(t("tbl.count"))}" class="num">${e.count}</td><td data-k="${esc(t("tbl.avis"))}">${avisPill(d.verdict)}</td><td data-k="${esc(t("tbl.decision"))}">${decisionPill(d.decision)}</td><td class="small muted c-hide">${esc(fmtDay(d.maj || d.cree))}</td><td><a class="btn btn--secondary btn--sm" href="${dossierHref(d)}">${t("tbl.open")}</a></td></tr>`; }).join("") : `<tr><td colspan="6" class="empty">${t("tbl.empty")}</td></tr>`;
    };
    v.querySelector("#q").addEventListener("input", (e) => paint(e.target.value));
    paint();
  });
}

export function renderQueue(root) {
  document.title = `${t("q.title")}, Aucteva`;
  const v = shellLayout(root, "queue");
  v.innerHTML = `${ph(t("q.title"), t("q.sub"))}<div data-body>${skeleton()}</div>`;
  withRows(v, (rows) => {
    const legal = rows.filter((x) => x.statut === "termine" && !x.validation);
    const dec = rows.filter((x) => x.validation && !x.decision);
    const list = (arr, tab) => arr.length ? arr.slice(0, 60).map((x) => `<div class="qrow"><div><strong>${esc(x.outil)}</strong><span class="m">${esc(x.fournisseur)} · <span class="mono">${esc(x.id)}</span> · ${esc(fmtDay(x.maj || x.cree))}</span></div><div style="display:flex;gap:12px;align-items:center">${avisPill(x.verdict)}<a class="btn btn--secondary btn--sm" href="/app/dossier/${esc(x.id)}/${tab}">${t("tbl.open")}</a></div></div>`).join("") : `<p class="empty">${t("q.none")}</p>`;
    v.querySelector("[data-body]").innerHTML = `<div class="grid2 grid2--queue">
      <section class="card"><div class="card__head"><h2>${t("q.legal")}</h2><span class="pill pill--neutral">${legal.length}</span></div>${list(legal, "decision")}</section>
      <section class="card"><div class="card__head"><h2>${t("q.decision")}</h2><span class="pill pill--neutral">${dec.length}</span></div>${list(dec, "decision")}</section>
    </div>`;
  });
}

export function renderRegistry(root) {
  document.title = `${t("rg.title")}, Aucteva`;
  const v = shellLayout(root, "registry");
  v.innerHTML = `${ph(t("rg.title"), t("rg.sub"))}<div data-body>${skeleton()}</div>`;
  withRows(v, (rows) => {
    const tools = byTool(rows).filter((e) => e.lastDone);
    v.querySelector("[data-body]").innerHTML = `<div class="card">
      <div class="filters"><label class="search"><span class="sr-only">${t("tbl.search")}</span>${ICON.search}<input type="search" id="q" placeholder="${esc(t("tbl.search"))}"></label>
        <select class="select" id="fd" aria-label="${esc(t("tbl.decision"))}"><option value="">${t("tbl.decision")} : ${getLang() === "en" ? "all" : "toutes"}</option><option value="none">${t("wf.pending")}</option>${["autorise", "autorise_conditions", "refuse"].map((k) => `<option value="${k}">${t(`dec.${k}`)}</option>`).join("")}</select></div>
      <div class="tablewrap"><table class="table table--cards"><thead><tr><th>${t("tbl.tool")}</th><th>${t("tbl.usecase")}</th><th>${t("tbl.lastAnalysis")}</th><th>${t("tbl.legal")}</th><th>${t("tbl.decision")}</th><th>${t("tbl.conditions")}</th><th>${t("tbl.docs")}</th><th>${t("tbl.review")}</th></tr></thead><tbody></tbody></table></div></div>`;
    const tb = v.querySelector("tbody");
    const paint = () => {
      const q = v.querySelector("#q").value.toLowerCase(), fd = v.querySelector("#fd").value;
      const list = tools.filter(({ lastDone: d }) => (!q || `${d.outil} ${d.fournisseur} ${d.cas_usage}`.toLowerCase().includes(q)) && (!fd || (fd === "none" ? !d.decision : d.decision?.decision === fd)));
      tb.innerHTML = list.length ? list.map(({ lastDone: d, count }) => {
        const review = d.decision ? fmtDay(new Date(d.decision.iso).setFullYear(new Date(d.decision.iso).getFullYear() + 1)) : null;
        const docs = d.documents?.length ? d.documents.join(", ") : d.source || (d.mots ? `${fmtInt(d.mots)} ${t("d.words")}` : "");
        return `<tr>
          <td class="c-full"><a class="t-tool" href="/app/dossier/${esc(d.id)}">${esc(d.outil)}</a><div class="small muted">${esc(d.fournisseur)}${count > 1 ? ` · ${count} ${t("tbl.count").toLowerCase()}` : ""}</div></td>
          <td class="c-hide"><span class="t-uc">${esc(d.cas_usage || "")}</span></td>
          <td data-k="${esc(t("tbl.lastAnalysis"))}"><span class="mono small">${esc(d.id)}</span><div class="small muted">${esc(fmtDay(d.cree))}</div><div class="small">${avisPill(d.verdict)}</div></td>
          <td data-k="${esc(t("tbl.legal"))}" class="small">${d.validation ? `${esc(d.validation.nom)}<div class="muted">${esc(d.validation.role)}, ${esc(fmtDay(new Date(d.validation.iso).getTime()))}</div>` : `<span class="muted">${t("wf.pending")}</span>`}</td>
          <td data-k="${esc(t("tbl.decision"))}" class="small">${decisionPill(d.decision)}${d.decision ? `<div class="muted">${esc(d.decision.nom)}, ${esc(d.decision.fonction)}</div>` : ""}</td>
          <td data-k="${esc(t("tbl.conditions"))}" class="num">${d.conditions || 0}</td>
          <td class="small muted c-hide">${esc(docs)}</td>
          <td data-k="${esc(t("tbl.review"))}" class="small">${review ? esc(review) : `<span class="muted">·</span>`}</td>
        </tr>`; }).join("") : `<tr><td colspan="8" class="empty">${t("tbl.empty")}</td></tr>`;
    };
    v.querySelector("#q").addEventListener("input", paint); v.querySelector("#fd").addEventListener("input", paint);
    paint();
  });
}

export async function renderSettings(root) {
  document.title = `${t("set.title")}, Aucteva`;
  const v = shellLayout(root, "settings");
  v.innerHTML = `${ph(t("set.title"), "")}
    <div class="card">
      <div class="setrow"><div><h3>${t("set.lang")}</h3><p>${t("set.lang.d")}</p></div><div><div class="seg" role="radiogroup" aria-label="${esc(t("set.lang"))}"><label><input type="radio" name="lang" value="fr"${getLang() === "fr" ? " checked" : ""}><span>Français</span></label><label><input type="radio" name="lang" value="en"${getLang() === "en" ? " checked" : ""}><span>English</span></label></div></div></div>
      <div class="setrow"><div><h3>${t("set.reader")}</h3></div><div id="reader"><span class="sk" style="width:200px"></span></div></div>
      <div class="setrow"><div><h3>${t("set.mcp")}</h3><p>${t("set.mcp.d")}</p></div><div><a class="btn btn--secondary" href="/app/connecteur">${t("app.connector")}</a></div></div>
      <div class="setrow"><div><h3>${t("set.roles")}</h3><p>${t("set.roles.d")}</p></div><div><span class="pill pill--neutral">${ICON.lock}&nbsp;${t("set.soon")}</span></div></div>
      <div class="setrow"><div><h3>${t("set.data")}</h3><p>${t("set.data.d")}</p></div><div class="small"><a href="/confidentialite">${t("footer.privacy")}</a> · <a href="/conditions">${t("footer.terms")}</a></div></div>
    </div>`;
  v.querySelectorAll("input[name=lang]").forEach((i) => i.addEventListener("change", () => { setLang(i.value); rerender(); }));
  try { const e = await api("/etat"); v.querySelector("#reader").innerHTML = e.lecture ? `<span class="pill pill--ok">${t("set.reader.ok")}</span>${e.enAttente ? ` <span class="small muted">${e.enAttente} ${getLang() === "en" ? "queued" : "en attente"}</span>` : ""}` : `<span class="pill pill--neutral">${t("set.reader.off")}</span>`; }
  catch { v.querySelector("#reader").innerHTML = `<span class="pill pill--neutral">${t("set.reader.off")}</span>`; }
}

export function renderConnector(root) {
  document.title = `${t("app.connector")}, Aucteva`;
  const v = shellLayout(root, "connector");
  const url = `${location.origin}/mcp`;
  const en = getLang() === "en";
  v.innerHTML = `${ph(en ? "Connect your assistant" : "Connecter votre assistant", en ? "Aucteva exposes an MCP server. Your assistant, Claude, ChatGPT or another compatible client, can open a file, read the contract and receive the opinion without leaving the conversation." : "Aucteva expose un serveur MCP. Votre assistant, Claude, ChatGPT ou un autre client compatible, peut ouvrir un dossier, lire le contrat et recevoir l'avis, sans quitter la conversation.")}
    <div class="card" style="max-width:900px">
      <div class="card__body">
        <div class="field"><span class="label">${en ? "Server address" : "Adresse du serveur"}</span><div class="code"><code>${esc(url)}</code><button type="button" class="btn btn--secondary btn--sm" id="cp">${t("common.copy")}</button></div></div>
      </div>
      <div class="setrow"><div><h3>Claude</h3></div><div class="small">${en ? "Settings, Connectors, “Add custom connector”, paste the address, no authentication. Then in a conversation: “Review this contract with Aucteva”, followed by the text." : "Réglages, Connecteurs, « Ajouter un connecteur personnalisé », collez l'adresse, sans authentification. Puis dans une conversation : « Examine ce contrat avec Aucteva » suivi du texte."}</div></div>
      <div class="setrow"><div><h3>ChatGPT</h3></div><div class="small">${en ? "Settings, Connectors, developer mode, “Create”, paste the address. Enable the connector in the conversation before asking for the review." : "Réglages, Connecteurs, mode développeur, « Créer », collez l'adresse. Activez le connecteur dans la conversation avant de demander l'examen."}</div></div>
      <div class="setrow"><div><h3>${en ? "Other MCP clients" : "Autres clients MCP"}</h3></div><div class="small">${en ? "Add a remote HTTP MCP server with this address." : "Ajoutez un serveur MCP distant de type HTTP avec cette adresse."}</div></div>
      <div class="setrow"><div><h3>${en ? "How it works" : "Fonctionnement"}</h3></div><div class="small"><p>${en ? "Your assistant reads the contract following the Aucteva reading guide and returns, for each topic, the clause status, the exact quote and a note." : "Votre assistant lit le contrat selon le guide de lecture d'Aucteva et renvoie, pour chaque sujet, le statut de la clause, la citation exacte et une note."}</p><p>${en ? "Aucteva checks every quote word for word, computes the risk level, the blocking issues and the opinion, and records the file in the registry. Four tools: examiner_outil, deposer_lecture, consulter_dossier, registre." : "Aucteva vérifie chaque citation mot pour mot, calcule le niveau de vigilance, les points bloquants et l'avis, et inscrit le dossier au registre. Quatre outils : examiner_outil, deposer_lecture, consulter_dossier, registre."}</p><p class="muted" style="margin:0">${t("d.privacy")}</p></div></div>
    </div>`;
  v.querySelector("#cp").addEventListener("click", () => copy(url));
}
