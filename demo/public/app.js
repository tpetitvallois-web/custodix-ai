// Interface de Custodix AI. Cinq écrans, routés par le hash de l'URL : accueil, formulaire, examen en cours, dossier, registre.
// Le Worker (worker/index.js) tient le registre des dossiers et fait lire les contrats par Claude.
// Le moteur de règles (engine.js) reste disponible dans le navigateur pour fonctionner hors ligne.

import { analyse, avenant, BRAND, MENTION, STEPS } from "./engine.js";
import { SCENARIOS, CATEGORIES, DATA_TYPES } from "./scenarios.js";

const app = document.getElementById("app");
const STEP_DELAY = 650;
const POLL_MS = 2500;

const AVIS_LABEL = { VERT: "Autorisé", ORANGE: "Autorisé sous conditions", ROUGE: "Non autorisé en l'état" };
const ROLES = ["Avocat", "DPO", "Expert conformité", "Expert IA"];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
const DATA_LABEL = Object.fromEntries(DATA_TYPES);

const emptyForm = () => ({ tool: "", vendor: "", category: "chatbot", useCase: "", dataTypes: [], countries: "", users: "", contract: "", source: "", url: "" });

const state = {
  form: emptyForm(),
  mode: "claude",
  etat: null,
  dossier: null,
  showAvenant: false,
  errors: [],
  busy: false,
};

let stepTimers = [];
let pollTimer = null;

// Mémoire de session : dernier dossier, dossiers hors ligne.
const session = {
  get(key, fallback) { try { const v = sessionStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ } },
};

// Accès au Worker.
async function api(path, body) {
  const r = await fetch(`/api${path}`, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.ok === false) throw new Error(data.erreur || `Le service répond ${r.status}.`);
  return data;
}

async function refreshEtat() {
  try { state.etat = (await api("/etat")); } catch { state.etat = null; }
  return state.etat;
}

// Outils de rendu.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtInt = (n) => new Intl.NumberFormat("fr-FR").format(Number(n) || 0);
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const fmtDate = (iso) => { const [y, m, d] = (iso || "").split("-"); return d ? `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}` : ""; };
const fmtDateTime = (d) => `${fmtDate(d.toISOString().slice(0, 10))} à ${String(d.getHours()).padStart(2, "0")} h ${String(d.getMinutes()).padStart(2, "0")}`;
const fmtStamp = (ms) => fmtDateTime(new Date(ms));
const plural = (n, one, many) => (n > 1 ? many : one);
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const countWords = (t) => (t || "").trim().split(/\s+/).filter(Boolean).length;

function hashShort(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  let h2 = 0x9747b28c;
  for (let i = text.length - 1; i >= 0; i--) { h2 = Math.imul(h2 ^ text.charCodeAt(i), 0x5bd1e995) >>> 0; }
  return (h.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).slice(0, 12).toUpperCase();
}

function dataSummary(list) {
  const items = (list || []).filter((d) => d !== "aucune");
  if (!items.length) return "aucune donnée personnelle";
  return items.map((d) => { const l = DATA_LABEL[d] || d; return l.charAt(0).toLowerCase() + l.slice(1); }).join(", ");
}

// Détails affichés sous chaque étape, calculés sur le résultat réel.
function stepDetails(dossier) {
  const r = dossier.resultat, m = dossier.input || {};
  const words = m.contrat_mots || 0;
  const crit = r.clauses_critiques.length;
  const prot = r.clauses_protectrices.length;
  const total = crit + prot;
  const catLabel = (CATEGORY_LABEL[r.meta.categorie] || "Autre").split(",")[0];
  const lecture = r.lecture ? `, lu par Claude en ${r.lecture.langue || "langue d'origine"}` : "";
  return [
    words ? `${fmtInt(words)} ${plural(words, "mot", "mots")}${lecture}` : "Aucun contrat fourni",
    total ? `${total} ${plural(total, "clause repérée", "clauses repérées")}, ${crit} ${plural(crit, "critique", "critiques")}, ${prot} ${plural(prot, "protectrice", "protectrices")}` : "Aucune clause repérée",
    `${catLabel}, ${dataSummary(r.meta.donnees)}, ${fmtInt(r.meta.utilisateurs)} ${plural(Number(r.meta.utilisateurs), "utilisateur", "utilisateurs")}`,
    `${r.obligations.length} ${plural(r.obligations.length, "obligation applicable", "obligations applicables")}`,
    `${r.score} / 100`,
    AVIS_LABEL[r.verdict],
  ];
}

// Routage.
function route() {
  stepTimers.forEach(clearTimeout); stepTimers = [];
  clearTimeout(pollTimer); pollTimer = null;
  const hash = location.hash || "#/";
  const id = (hash.split("/")[2] || "").toUpperCase();
  if (hash.startsWith("#/analyse")) return renderForm();
  if (hash.startsWith("#/en-cours")) return renderProgress(id);
  if (hash.startsWith("#/rapport")) return renderReport(id);
  if (hash.startsWith("#/registre")) return renderRegistre();
  return renderHome();
}

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

window.addEventListener("hashchange", route);

// Écran 1 : accueil.
function renderHome() {
  document.title = BRAND;
  app.innerHTML = `
    <section class="home">
      <h1 class="h-display">${esc(BRAND)}</h1>
      <p class="home__slogan">Chaque IA passe par Custodix.</p>
      <p class="home__subtitle">Autorisation et gouvernance des outils d'intelligence artificielle en entreprise.</p>
      <p class="home__intro">${esc(BRAND)} prépare, pour chaque outil d'IA, un avis d'autorisation documenté et validé par un avocat. Déposez un contrat ou des conditions d'utilisation, réels ou fictifs : Claude les lit dans leur langue, le barème du cabinet qualifie le risque.</p>
      <div class="btn-row home__actions">
        <a class="btn" href="#/analyse" data-action="new">Examiner un outil IA</a>
        <a class="btn btn-secondary" href="#/registre">Registre des dossiers</a>
      </div>
      <p class="home__note">Un service conçu pour les directions juridiques, conformité, achats et IT.</p>
      <p class="home__shortcuts">Exemples :
        ${SCENARIOS.map((s) => `<button type="button" class="btn-text" data-load="${esc(s.id)}">${esc(s.tool)}</button>`).join("")}
      </p>
      <p class="home__etat" id="home-etat"></p>
    </section>`;
  app.querySelector("[data-action=new]").addEventListener("click", () => { state.form = emptyForm(); state.errors = []; });
  app.querySelectorAll("[data-load]").forEach((b) => b.addEventListener("click", () => { loadScenario(b.dataset.load); go("#/analyse"); }));
  refreshEtat().then((e) => { const el = app.querySelector("#home-etat"); if (el) el.textContent = etatLine(e); });
  window.scrollTo(0, 0);
}

function etatLine(e) {
  if (!e) return "Service en ligne indisponible : les règles locales restent utilisables.";
  if (e.lecture === "api") return "Lecture par Claude disponible (API).";
  if (e.lecture === "pont") return `Lecture par Claude disponible${e.enAttente ? `, ${e.enAttente} ${plural(e.enAttente, "dossier en attente", "dossiers en attente")}` : ""}.`;
  if (e.lecture === "github") return "Lecture par Claude disponible (lecteur démarré à la demande, une à deux minutes de délai).";
  return "Lecture par Claude momentanément indisponible : les règles locales restent utilisables.";
}

function loadScenario(id) {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) return;
  state.form = { tool: s.tool, vendor: s.vendor, category: s.category, useCase: s.useCase, dataTypes: [...s.dataTypes], countries: s.countries, users: String(s.users), contract: s.contract, source: `Scénario de démonstration ${s.tool}`, url: "" };
  state.errors = [];
}

// Écran 2 : formulaire.
function renderForm() {
  document.title = `Examiner un outil, ${BRAND}`;
  const f = state.form;
  const err = (k) => (state.errors.includes(k) ? " is-invalid" : "");
  const e = state.etat;
  const claudeOk = !!(e && e.lecture);
  if (!claudeOk && state.mode === "claude" && e) state.mode = "regles";
  app.innerHTML = `
    <section class="form-page">
      <div class="page-head">
        <h1 class="h-page">Examiner un outil IA</h1>
        <p class="muted">Décrivez l'outil et son usage, puis déposez le contrat : texte collé, fichier PDF, Word ou texte, ou adresse de la page de conditions.</p>
      </div>
      <div class="scenario-row no-print">
        <span class="scenario-row__label">Scénarios de démonstration</span>
        ${SCENARIOS.map((s) => `<button type="button" class="btn btn-secondary" data-load="${esc(s.id)}">Charger ${esc(s.tool)}</button>`).join("")}
      </div>
      <form class="form" id="analysis-form" novalidate>
        <div class="form-grid">
          <div class="field${err("tool")}">
            <label for="f-tool">Nom de l'outil</label>
            <input type="text" id="f-tool" name="tool" value="${esc(f.tool)}" autocomplete="off">
          </div>
          <div class="field${err("vendor")}">
            <label for="f-vendor">Fournisseur</label>
            <input type="text" id="f-vendor" name="vendor" value="${esc(f.vendor)}" autocomplete="off">
          </div>
          <div class="field">
            <label for="f-category">Catégorie</label>
            <select id="f-category" name="category">
              ${CATEGORIES.map(([v, l]) => `<option value="${esc(v)}"${v === f.category ? " selected" : ""}>${esc(l)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="f-users">Nombre d'utilisateurs estimé</label>
            <input type="number" id="f-users" name="users" min="0" step="1" inputmode="numeric" value="${esc(f.users)}">
          </div>
          <div class="field field--full${err("useCase")}">
            <label for="f-usecase">Cas d'usage</label>
            <textarea id="f-usecase" name="useCase" rows="3">${esc(f.useCase)}</textarea>
            <span class="hint">Ce que l'outil fera, pour qui, avec quelles données.</span>
          </div>
          <div class="field field--full">
            <span class="label">Types de données traitées</span>
            <div class="check-list">
              ${DATA_TYPES.map(([v, l]) => `<label class="check"><input type="checkbox" name="dataTypes" value="${esc(v)}"${f.dataTypes.includes(v) ? " checked" : ""}><span>${esc(l)}</span></label>`).join("")}
            </div>
          </div>
          <div class="field field--full">
            <label for="f-countries">Pays d'utilisation</label>
            <input type="text" id="f-countries" name="countries" value="${esc(f.countries)}" placeholder="France, Belgique">
          </div>
          <div class="field field--full">
            <label for="f-url">Adresse des conditions en ligne</label>
            <div class="url-row">
              <input type="url" id="f-url" name="url" value="${esc(f.url)}" placeholder="https://www.exemple.com/terms" autocomplete="off">
              <button type="button" class="btn btn-secondary" id="f-fetch">Récupérer le texte</button>
            </div>
            <span class="hint">Le texte de la page est récupéré et placé ci-dessous, pour relecture avant l'examen.</span>
          </div>
          <div class="field field--full">
            <label for="f-contract">Contrat ou conditions d'utilisation</label>
            <textarea id="f-contract" name="contract" class="contract" spellcheck="false">${esc(f.contract)}</textarea>
            <div class="field-meta">
              <span class="file-pick">
                <label class="btn btn-secondary" for="f-file">Déposer un fichier PDF, Word ou texte</label>
                <input type="file" id="f-file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                <span id="f-source" class="muted small">${esc(f.source)}</span>
              </span>
              <span id="word-count">${fmtInt(countWords(f.contract))} ${plural(countWords(f.contract), "mot", "mots")}</span>
            </div>
          </div>
          <div class="field field--full">
            <span class="label">Lecture du contrat</span>
            <div class="mode-list">
              <label class="mode${claudeOk ? "" : " mode--off"}">
                <input type="radio" name="mode" value="claude"${state.mode === "claude" ? " checked" : ""}${claudeOk ? "" : " disabled"}>
                <span><strong>Lecture par Claude</strong><br>Le contrat est lu intégralement, dans sa langue, par le modèle. Chaque statut est fondé sur une citation vérifiée. De trente secondes à trois minutes.${claudeOk ? "" : " Indisponible pour le moment."}</span>
              </label>
              <label class="mode">
                <input type="radio" name="mode" value="regles"${state.mode === "regles" ? " checked" : ""}>
                <span><strong>Règles locales</strong><br>Douze motifs en français, instantané, sans envoi du contrat au modèle. Conçu pour les scénarios de démonstration.</span>
              </label>
            </div>
            <span class="hint">Dans les deux cas, le barème, les points bloquants et l'avis sont calculés par le code du cabinet, pas par le modèle.</span>
          </div>
        </div>
        ${state.errors.length ? `<p class="form-error">${esc(state.errorText || "Renseignez le nom de l'outil, le fournisseur et le cas d'usage.")}</p>` : ""}
        <div class="form-actions">
          <button type="submit" class="btn" id="f-submit">Lancer l'examen</button>
          <a class="btn-text" href="#/">Retour à l'accueil</a>
        </div>
        <p class="hint form-privacy">Démonstration : les dossiers déposés sont conservés sur le serveur du projet et visibles dans le registre. Ne déposez pas de contrat confidentiel.</p>
      </form>
    </section>`;

  const form = app.querySelector("#analysis-form");
  app.querySelectorAll("[data-load]").forEach((b) => b.addEventListener("click", () => { loadScenario(b.dataset.load); renderForm(); }));

  const setContract = (text, source) => {
    state.form.contract = text;
    state.form.source = source || "";
    const ta = app.querySelector("#f-contract");
    ta.value = text;
    app.querySelector("#f-source").textContent = state.form.source;
    const n = countWords(text);
    app.querySelector("#word-count").textContent = `${fmtInt(n)} ${plural(n, "mot", "mots")}`;
  };

  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.name === "dataTypes" || t.name === "mode") return;
    state.form[t.name] = t.value;
    if (t.name === "contract") {
      const n = countWords(t.value);
      app.querySelector("#word-count").textContent = `${fmtInt(n)} ${plural(n, "mot", "mots")}`;
      if (state.form.source && !state.form.source.startsWith("Texte")) { state.form.source = "Texte modifié"; app.querySelector("#f-source").textContent = state.form.source; }
    }
    if (state.errors.includes(t.name) && t.value.trim()) {
      state.errors = state.errors.filter((k) => k !== t.name);
      t.closest(".field").classList.remove("is-invalid");
      if (!state.errors.length) form.querySelector(".form-error")?.remove();
    }
  });

  form.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "mode") { state.mode = t.value; return; }
    if (t.name !== "dataTypes") return;
    const boxes = [...form.querySelectorAll("input[name=dataTypes]")];
    if (t.checked) {
      if (t.value === "aucune") boxes.forEach((b) => { if (b !== t) b.checked = false; });
      else boxes.forEach((b) => { if (b.value === "aucune") b.checked = false; });
    }
    state.form.dataTypes = boxes.filter((b) => b.checked).map((b) => b.value);
  });

  app.querySelector("#f-file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const btn = app.querySelector("#f-submit");
    try {
      btn.disabled = true;
      toast(`Lecture de ${file.name}`);
      const text = await readFile(file);
      if (countWords(text) < 50) { toast("Le fichier ne contient presque pas de texte lisible (scan sans OCR ?)."); }
      setContract(text, `${file.name}, ${fmtInt(countWords(text))} mots`);
      toast(`${file.name} chargé`);
    } catch (err) {
      toast(err.message || "Fichier illisible");
    } finally { btn.disabled = false; e.target.value = ""; }
  });

  app.querySelector("#f-fetch").addEventListener("click", async () => {
    const url = app.querySelector("#f-url").value.trim();
    if (!url) { app.querySelector("#f-url").focus(); return; }
    const b = app.querySelector("#f-fetch");
    b.disabled = true; b.textContent = "Récupération…";
    try {
      const r = await api("/extraction", { url });
      setContract(r.texte, `${r.titre || r.url}, ${fmtInt(r.mots)} mots`);
      toast("Texte récupéré, relisez-le avant l'examen");
    } catch (err) { toast(err.message); }
    finally { b.disabled = false; b.textContent = "Récupérer le texte"; }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = state.form;
    state.errors = ["tool", "vendor", "useCase"].filter((k) => !String(f[k] || "").trim());
    state.errorText = "";
    if (!state.errors.length && state.mode === "claude" && f.contract.trim().length < 200) { state.errors = ["contract"]; state.errorText = "La lecture par Claude demande un contrat : collez le texte, déposez un fichier ou récupérez une page."; }
    if (state.errors.length) { renderForm(); app.querySelector(".is-invalid input, .is-invalid textarea")?.focus(); return; }
    startAnalysis();
  });
  if (!state.etat) refreshEtat().then(() => { if (location.hash.startsWith("#/analyse")) renderForm(); });
  window.scrollTo(0, 0);
}

// Lecture des fichiers déposés : PDF (pdf.js), Word (.docx), texte.
async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file);
  if (name.endsWith(".docx")) return readDocx(file);
  if (/\.(txt|md|text)$/.test(name) || file.type.startsWith("text/")) return file.text();
  throw new Error("Formats acceptés : PDF, Word (.docx), texte (.txt, .md).");
}

let pdfjs = null;
async function readPdf(file) {
  if (!pdfjs) {
    pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = "", lastY = null, out = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform ? Math.round(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { out.push(line.trim()); line = ""; }
      line += item.str + (item.hasEOL ? "\n" : " ");
      lastY = y;
    }
    out.push(line.trim());
    pages.push(out.filter(Boolean).join("\n"));
  }
  return pages.join("\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script"); s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Bibliothèque indisponible")); document.head.appendChild(s);
  });
}

async function readDocx(file) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file("word/document.xml");
  if (!doc) throw new Error("Document Word illisible");
  const xml = new DOMParser().parseFromString(await doc.async("string"), "application/xml");
  const paras = [...xml.getElementsByTagNameNS("*", "p")].map((p) => [...p.getElementsByTagNameNS("*", "t")].map((t) => t.textContent).join(""));
  return paras.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Lance l'examen : le dossier est créé sur le serveur, l'écran 3 suit son avancement.
async function startAnalysis() {
  const f = state.form;
  const input = { tool: f.tool.trim(), vendor: f.vendor.trim(), category: f.category, useCase: f.useCase.trim(), dataTypes: [...f.dataTypes], countries: f.countries.trim(), users: Number(f.users) || 0, contract: f.contract, source: f.source };
  const btn = app.querySelector("#f-submit");
  if (btn) { btn.disabled = true; btn.textContent = "Dépôt du dossier…"; }
  try {
    const { dossier } = await api("/examens", { ...input, mode: state.mode });
    state.dossier = dossier;
    state.showAvenant = false;
    go(`#/en-cours/${dossier.id}`);
  } catch (err) {
    if (state.mode === "claude") { toast(err.message); if (btn) { btn.disabled = false; btn.textContent = "Lancer l'examen"; } return; }
    // Hors ligne : le moteur de règles tourne dans le navigateur.
    const result = analyse(input, { moteur: "règles v1 (navigateur)" });
    const id = `LOCAL-${hashShort(JSON.stringify(input) + Date.now()).slice(0, 6)}`;
    const dossier = { id, mode: "regles", statut: "termine", cree: Date.now(), input: { ...input, contract: undefined, contrat_mots: countWords(input.contract) }, resultat: result, validation: null, local: true };
    session.set(`custodix.local.${id}`, dossier);
    state.dossier = dossier;
    state.showAvenant = false;
    go(`#/en-cours/${id}`);
  }
}

async function loadDossier(id) {
  if (state.dossier && state.dossier.id === id) return state.dossier;
  if (id.startsWith("LOCAL-")) { const d = session.get(`custodix.local.${id}`, null); if (d) state.dossier = d; return d; }
  const { dossier } = await api(`/examens/${id}`);
  state.dossier = dossier;
  return dossier;
}

// Écran 3 : examen en cours. Le moteur de règles est instantané, la lecture par Claude prend du temps : on attend le serveur.
async function renderProgress(id) {
  if (!id) { go("#/analyse"); return; }
  let d;
  try { d = await loadDossier(id); } catch (err) { app.innerHTML = `<section class="progress"><h1 class="h-page">Dossier introuvable</h1><p class="muted">${esc(err.message)}</p><p><a class="btn" href="#/analyse">Nouvel examen</a></p></section>`; return; }
  if (!d) { go("#/analyse"); return; }
  document.title = `Examen en cours, ${BRAND}`;
  const started = Date.now();
  app.innerHTML = `
    <section class="progress" aria-live="polite">
      <h1 class="h-page progress__title">Examen en cours</h1>
      <p class="progress__sub">${esc(d.input.tool)}, ${esc(d.input.vendor)}. Dossier ${esc(d.id)}.</p>
      <ol class="steps">
        ${STEPS.map((label, i) => `
          <li class="step" data-step="${i}">
            <span class="step__num">${i + 1}</span>
            <span class="step__label">${esc(label)}</span>
            <span class="step__detail"></span>
          </li>`).join("")}
      </ol>
      <p class="progress__wait" id="progress-wait"></p>
      <div id="progress-error"></div>
    </section>`;
  const items = [...app.querySelectorAll(".step")];
  items[0].classList.add("is-active");
  const wait = app.querySelector("#progress-wait");

  const play = (dossier) => {
    const details = stepDetails(dossier);
    items.forEach((li, i) => { li.querySelector(".step__detail").textContent = details[i]; });
    const delay = dossier.mode === "claude" ? 450 : STEP_DELAY;
    STEPS.forEach((_, i) => {
      stepTimers.push(setTimeout(() => {
        items[i].classList.remove("is-active");
        items[i].classList.add("is-done");
        if (items[i + 1]) items[i + 1].classList.add("is-active");
      }, delay * (i + 1)));
    });
    stepTimers.push(setTimeout(() => go(`#/rapport/${dossier.id}`), delay * (STEPS.length + 1)));
  };

  if (d.statut === "termine") { play(d); window.scrollTo(0, 0); return; }

  const showError = (message) => {
    wait.textContent = "";
    app.querySelector("#progress-error").innerHTML = `
      <p class="form-error">${esc(message)}</p>
      <div class="btn-row">
        <button type="button" class="btn" data-action="rules">Reprendre avec les règles locales</button>
        <a class="btn btn-secondary" href="#/analyse">Modifier le dossier</a>
      </div>`;
    app.querySelector("[data-action=rules]").addEventListener("click", () => { state.mode = "regles"; startAnalysis(); });
  };

  const tick = async () => {
    const sec = Math.round((Date.now() - started) / 1000);
    const api_ = state.etat && state.etat.lecture === "api";
    wait.textContent = `Lecture du contrat par Claude${d.input.contrat_mots ? `, ${fmtInt(d.input.contrat_mots)} mots` : ""}. ${sec < 60 ? `${sec} s` : `${Math.floor(sec / 60)} min ${String(sec % 60).padStart(2, "0")} s`}.${!api_ && d.statut === "en_attente" && sec > (state.etat && state.etat.github ? 150 : 45) ? " Le dossier attend un lecteur : s'il reste en attente, basculez sur les règles locales." : ""}`;
    try {
      const { dossier } = await api(`/examens/${id}`);
      d = dossier; state.dossier = dossier;
    } catch (err) { wait.textContent = `Connexion au service perdue : ${err.message}`; }
    if (d.statut === "termine") { items[0].querySelector(".step__detail").textContent = ""; play(d); return; }
    if (d.statut === "erreur") { showError(`La lecture par Claude a échoué : ${d.erreur || "erreur inconnue"}.`); return; }
    if (d.statut === "en_cours" || d.statut === "en_cours_api") { items[0].classList.add("is-done"); items[0].classList.remove("is-active"); items[1].classList.add("is-active"); }
    pollTimer = setTimeout(tick, POLL_MS);
  };
  if (!state.etat) await refreshEtat();
  tick();
  window.scrollTo(0, 0);
}

// Écran 4 : dossier d'autorisation.
async function renderReport(id) {
  let d = null;
  if (id) { try { d = await loadDossier(id); } catch { d = null; } }
  if (!d && !id && state.dossier) d = state.dossier;
  if (!d) { app.innerHTML = `<section class="report"><h1 class="h-page">Dossier introuvable</h1><p class="muted">Le dossier ${esc(id)} n'existe pas ou n'est plus disponible.</p><p><a class="btn" href="#/analyse">Nouvel examen</a> <a class="btn btn-secondary" href="#/registre">Registre</a></p></section>`; return; }
  if (d.statut !== "termine") { go(`#/en-cours/${d.id}`); return; }
  const r = d.resultat;
  const m = r.meta;
  const sig = d.validation;
  document.title = `Dossier d'autorisation ${d.id}, ${BRAND}`;

  const risks = r.risques.map((x) => `
    <div class="row">
      <span class="row__tag row__tag--${slug(x.gravite)}">${esc(x.gravite)}</span>
      <div>
        <div class="row__title">${esc(x.titre)}</div>
        <div class="row__detail">${esc(x.detail)}</div>
        <div class="row__base">${esc(x.base)}</div>
      </div>
    </div>`).join("");

  const critical = r.clauses_critiques.map((c) => `
    <div class="row">
      <span class="row__tag row__tag--${slug(c.statut)}">${esc(c.statut)}</span>
      <div>
        <div class="row__title">${esc(c.sujet)}</div>
        <blockquote class="quote">${esc(c.extrait)}</blockquote>
        ${c.note ? `<div class="row__note">${esc(c.note)}</div>` : ""}
        <div class="row__base">${esc(c.base)}</div>
      </div>
    </div>`).join("");

  const protective = r.clauses_protectrices.map((c) => `
    <div class="row row--plain">
      <div class="row__title">${esc(c.sujet)}</div>
      <blockquote class="quote">${esc(c.extrait)}</blockquote>
      ${c.note ? `<div class="row__note">${esc(c.note)}</div>` : ""}
    </div>`).join("");

  const missing = r.clauses_manquantes.map((c) => `
    <div class="row row--kv">
      <div class="row__title">${esc(c.sujet)}</div>
      <div class="row__base">${esc(c.base)}</div>
    </div>`).join("");

  const obligations = r.obligations.map((o) => `
    <div class="row row--kv">
      <div>${esc(o.texte)}</div>
      <div class="row__base">${esc(o.source)}</div>
    </div>`).join("");

  const fixes = r.clauses_correctives.map((c) => `
    <div class="pair">
      <div class="pair__subject">${esc(c.sujet)}</div>
      <div>${esc(c.texte)}</div>
    </div>`).join("");

  const L = r.lecture;
  const lecture = L ? `
      <section class="section">
        <h2 class="h-section">Lecture du contrat</h2>
        <dl class="meta-list meta-list--tight">
          <div><dt>Document</dt><dd>${esc(L.type_document || "Non précisé")}</dd></div>
          <div><dt>Parties</dt><dd>${esc(L.parties || "Non précisé")}</dd></div>
          <div><dt>Langue</dt><dd>${esc(L.langue || "Non précisé")}</dd></div>
          <div><dt>Citations vérifiées</dt><dd>${L.citations ? `${L.citations.verifiees} sur ${L.citations.total}` : "Sans objet"}${L.citations && L.citations.total && L.confiance < 80 ? " (lecture à confirmer)" : ""}</dd></div>
        </dl>
        ${L.observations && L.observations.length ? `<div class="observations">${L.observations.map((o) => `<p>${esc(o)}</p>`).join("")}</div>` : ""}
        <p class="muted small">Chaque statut de clause repose sur une citation retrouvée mot pour mot dans le contrat. Une citation introuvable ramène le sujet à « absent ».</p>
      </section>` : "";

  app.innerHTML = `
    <article class="report">
      <div class="print-only print-brand">${esc(BRAND)}</div>
      <header class="report-head">
        <div class="report-head__kicker">Dossier d'autorisation ${esc(d.id)}</div>
        <h1 class="h-page">${esc(m.outil)}</h1>
        <div class="report-head__vendor">${esc(m.fournisseur)}</div>
        <dl class="meta-list">
          <div><dt>Date</dt><dd>${esc(fmtDate(m.date))}</dd></div>
          <div><dt>Catégorie</dt><dd>${esc(CATEGORY_LABEL[m.categorie] || m.categorie)}</dd></div>
          <div><dt>Pays d'utilisation</dt><dd>${esc(m.pays || "Non précisé")}</dd></div>
          <div><dt>Utilisateurs estimés</dt><dd>${fmtInt(m.utilisateurs)}</dd></div>
          <div><dt>Données traitées</dt><dd>${esc(dataSummary(m.donnees))}</dd></div>
          <div><dt>Niveau d'enjeu juridique</dt><dd>${esc(r.niveau_juridique)}</dd></div>
          <div><dt>Contrat</dt><dd>${d.input.source ? esc(d.input.source) : d.input.contrat_mots ? `${fmtInt(d.input.contrat_mots)} mots` : "Non fourni"}</dd></div>
          <div><dt>Lecture</dt><dd>${esc(m.moteur)}</dd></div>
        </dl>
        <div id="banner">${bannerHtml(sig)}</div>
      </header>

      <section class="avis" aria-label="Avis">
        <div>
          <div class="avis__label">Avis</div>
          <div class="avis__line"><span class="avis__dot avis__dot--${esc(r.verdict)}" aria-hidden="true"></span><span>${esc(AVIS_LABEL[r.verdict])}</span></div>
        </div>
        <div class="score">
          <div class="score__label">Niveau de vigilance</div>
          <div class="score__value">${r.score}<small>sur 100</small></div>
          <div class="score__bar" role="img" aria-label="Niveau de vigilance ${r.score} sur 100"><span style="width:${r.score}%"></span></div>
          <div class="score__legend">Moins de 35 : autorisé. De 35 à 64 : sous conditions. 65 et plus : non autorisé en l'état.</div>
        </div>
      </section>

      <section class="section">
        <h2 class="h-section">Résumé exécutif</h2>
        <div class="summary">${r.resume.map((s) => `<p>${esc(s)}</p>`).join("")}</div>
      </section>

      ${r.points_bloquants.length ? `
      <section class="section section--blockers">
        <h2 class="h-section">${r.points_bloquants.length} ${plural(r.points_bloquants.length, "point bloquant", "points bloquants")}</h2>
        <ul class="dash-list">${r.points_bloquants.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </section>` : ""}

      ${lecture}

      <section class="section">
        <h2 class="h-section">Risques identifiés</h2>
        ${r.risques.length ? `<div class="rows">${risks}</div>` : `<p class="muted">Aucun risque relevé dans le périmètre analysé.</p>`}
      </section>

      <section class="section">
        <h2 class="h-section">Clauses analysées</h2>
        ${r.clauses_critiques.length ? `<div class="rows">${critical}</div>` : `<p class="muted">Aucune clause dangereuse ou ambiguë dans le contrat fourni.</p>`}
      </section>

      <section class="section">
        <details class="fold" id="fold-protective">
          <summary>
            <h2 class="h-section">Clauses protectrices (${r.clauses_protectrices.length})</h2>
            <span class="fold__hint fold__hint--closed">Afficher</span>
            <span class="fold__hint fold__hint--open">Masquer</span>
          </summary>
          <div class="fold__body">
            ${r.clauses_protectrices.length ? `<div class="rows">${protective}</div>` : `<p class="muted">Aucune clause protectrice relevée.</p>`}
          </div>
        </details>
      </section>

      <section class="section">
        <h2 class="h-section">Clauses manquantes</h2>
        ${r.clauses_manquantes.length ? `<div class="rows">${missing}</div>` : `<p class="muted">Aucune clause attendue ne manque.</p>`}
      </section>

      <section class="section">
        <h2 class="h-section">Obligations RGPD et AI Act applicables</h2>
        <div class="rows">${obligations}</div>
      </section>

      <section class="section">
        <h2 class="h-section">Conditions d'usage</h2>
        ${r.conditions.length ? `<ul class="dash-list">${r.conditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p class="muted">Aucune condition : l'outil n'est pas autorisé en l'état.</p>`}
      </section>

      <section class="section">
        <h2 class="h-section">Mesures recommandées</h2>
        <ol class="num-list">${r.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
      </section>

      <section class="section">
        <h2 class="h-section">Clauses correctives proposées</h2>
        ${r.clauses_correctives.length ? `<div class="pair-list">${fixes}</div>` : `<p class="muted">Aucune clause corrective nécessaire.</p>`}
      </section>

      <section class="section">
        <div class="validation" id="validation">${validationHtml(sig)}</div>
      </section>

      <section class="section avenant${state.showAvenant ? "" : " no-print"}" id="avenant-section" ${state.showAvenant ? "" : "hidden"}>
        <h2 class="h-section">Avenant type</h2>
        <p class="muted small">Document de travail généré à partir des clauses correctives. À relire et à négocier par un avocat.</p>
        <pre id="avenant-text">${esc(avenant(r))}</pre>
        <div class="btn-row no-print">
          <button type="button" class="btn btn-secondary" data-action="copy">Copier</button>
          <button type="button" class="btn btn-secondary" data-action="download">Télécharger .txt</button>
        </div>
      </section>

      <div class="report-actions no-print">
        <button type="button" class="btn" data-action="avenant">${state.showAvenant ? "Masquer l'avenant" : "Générer l'avenant type"}</button>
        <button type="button" class="btn btn-secondary" data-action="print">Exporter en PDF</button>
        <a class="btn btn-secondary" href="#/analyse" data-action="new">Nouvel examen</a>
        <a class="btn-text" href="#/registre">Registre des dossiers</a>
      </div>

      <div class="mention">
        ${esc(r.mention || MENTION)}
        <div class="small">${esc(d.id)}, ${esc(fmtDate(m.date))}.</div>
      </div>
    </article>`;

  app.querySelector("[data-action=avenant]").addEventListener("click", (e) => {
    state.showAvenant = !state.showAvenant;
    const sec = app.querySelector("#avenant-section");
    sec.hidden = !state.showAvenant;
    sec.classList.toggle("no-print", !state.showAvenant);
    e.currentTarget.textContent = state.showAvenant ? "Masquer l'avenant" : "Générer l'avenant type";
    if (state.showAvenant) sec.scrollIntoView({ block: "start" });
  });
  app.querySelector("[data-action=copy]").addEventListener("click", async () => {
    const text = app.querySelector("#avenant-text").textContent;
    try { await navigator.clipboard.writeText(text); toast("Avenant copié"); }
    catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Avenant copié"); }
  });
  app.querySelector("[data-action=download]").addEventListener("click", () => {
    const text = app.querySelector("#avenant-text").textContent;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `avenant-${slug(m.outil)}-${d.id}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  app.querySelector("[data-action=print]").addEventListener("click", () => window.print());
  app.querySelector("[data-action=new]").addEventListener("click", () => { state.form = emptyForm(); state.dossier = null; state.errors = []; });
  bindValidation(d);
  window.scrollTo(0, 0);
}

function bannerHtml(sig) {
  if (!sig) return `<div class="banner">En attente de validation par un avocat</div>`;
  return `<div class="banner banner--signed">Avis validé par ${esc(sig.nom)}, ${esc(sig.role)}, le ${esc(sig.when)}</div>`;
}

function validationHtml(sig) {
  if (sig) {
    return `
      <h2 class="h-section">Validation par un avocat</h2>
      <p class="validation__done">Avis validé par ${esc(sig.nom)}, ${esc(sig.role)}, le ${esc(sig.when)}</p>
      <p class="validation__sig">Identifiant de signature ${esc(sig.hash)}</p>`;
  }
  return `
    <h2 class="h-section">Validation par un avocat</h2>
    <p class="validation__intro">L'avis n'a de valeur qu'une fois relu et validé par un avocat du cabinet.</p>
    <form id="sign-form" novalidate>
      <div class="form-grid">
        <div class="field">
          <label for="s-name">Nom</label>
          <input type="text" id="s-name" name="name" autocomplete="name">
        </div>
        <div class="field">
          <label for="s-role">Rôle</label>
          <select id="s-role" name="role">${ROLES.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
        </div>
      </div>
      <button type="submit" class="btn">Valider l'avis</button>
    </form>`;
}

function bindValidation(d) {
  const form = app.querySelector("#sign-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom = form.elements.name.value.trim();
    const role = form.elements.role.value;
    if (!nom) { form.querySelector("#s-name").closest(".field").classList.add("is-invalid"); form.querySelector("#s-name").focus(); return; }
    let sig;
    if (d.local) {
      const now = new Date();
      sig = { nom, role, when: fmtDateTime(now), iso: now.toISOString(), hash: hashShort(`${d.id}|${nom}|${role}|${now.toISOString()}|${d.resultat.verdict}|${d.resultat.score}`) };
      d.validation = sig; session.set(`custodix.local.${d.id}`, d);
    } else {
      try { const { dossier } = await api(`/examens/${d.id}/validation`, { nom, role }); state.dossier = dossier; sig = dossier.validation; }
      catch (err) { toast(err.message); return; }
    }
    app.querySelector("#validation").innerHTML = validationHtml(sig);
    app.querySelector("#banner").innerHTML = bannerHtml(sig);
  });
}

// Écran 5 : registre des dossiers.
async function renderRegistre() {
  document.title = `Registre des dossiers, ${BRAND}`;
  app.innerHTML = `
    <section class="registre">
      <div class="page-head">
        <h1 class="h-page">Registre des dossiers</h1>
        <p class="muted">Chaque examen déposé sur le service, avec son avis et sa validation. Les examens hors ligne restent dans le navigateur.</p>
      </div>
      <div id="registre-body"><p class="muted">Chargement…</p></div>
      <div class="btn-row"><a class="btn" href="#/analyse" data-action="new">Nouvel examen</a><a class="btn-text" href="#/">Accueil</a></div>
    </section>`;
  app.querySelector("[data-action=new]").addEventListener("click", () => { state.form = emptyForm(); state.errors = []; });
  const body = app.querySelector("#registre-body");
  try {
    const { dossiers } = await api("/registre");
    if (!dossiers.length) { body.innerHTML = `<p class="muted">Aucun dossier pour le moment.</p>`; return; }
    const statut = (x) => x.statut === "termine" ? (x.verdict ? AVIS_LABEL[x.verdict] : "") : x.statut === "erreur" ? "Lecture échouée" : "En cours";
    body.innerHTML = `
      <table class="table">
        <thead><tr><th>Dossier</th><th>Date</th><th>Outil</th><th>Fournisseur</th><th>Avis</th><th>Niveau</th><th>Lecture</th><th>Validation</th></tr></thead>
        <tbody>
          ${dossiers.map((x) => `
            <tr data-id="${esc(x.id)}">
              <td><a href="#/${x.statut === "termine" ? "rapport" : "en-cours"}/${esc(x.id)}">${esc(x.id)}</a></td>
              <td>${esc(fmtStamp(x.cree))}</td>
              <td>${esc(x.outil)}</td>
              <td>${esc(x.fournisseur)}</td>
              <td>${x.verdict ? `<span class="avis__dot avis__dot--${esc(x.verdict)} avis__dot--small" aria-hidden="true"></span>` : ""}${esc(statut(x))}</td>
              <td>${x.score ?? ""}</td>
              <td>${esc(x.moteur || (x.mode === "claude" ? "Claude" : "règles"))}</td>
              <td>${x.validation ? `${esc(x.validation.nom)}, ${esc(x.validation.role)}` : "En attente"}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  } catch (err) {
    body.innerHTML = `<p class="form-error">Registre indisponible : ${esc(err.message)}</p>`;
  }
  window.scrollTo(0, 0);
}

let toastTimer = null;
function toast(text) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 3200);
}

refreshEtat();
route();
