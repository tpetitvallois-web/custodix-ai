// Ouverture d'un dossier : parcours guidé (description, documents), suivi de l'analyse, conversation avec l'assistant.
import { t, getLang } from "./i18n.js";
import { api, esc, fmtInt, fmtSize, countWords, ICON, toast, session, avisPill, slug, go } from "./ui.js";
import { shellLayout, invalidate } from "./shell.js";
import { analyse } from "./engine.js";
import { SCENARIOS, CATEGORIES } from "./scenarios.js";
import { readFile } from "./files.js";
import { askBar } from "./ask.js";
export { readFile };

const DEPTS = { fr: ["Juridique", "Ressources humaines", "Marketing", "Service client", "Informatique", "Finance", "Achats", "Direction", "Autre"], en: ["Legal", "Human resources", "Marketing", "Customer service", "IT", "Finance", "Procurement", "Management", "Other"] };
const CAT_EN = { chatbot: "Chatbot, internal assistant", rh: "Human resources, recruitment", marketing: "Marketing, content", support: "Customer support", documents: "Document analysis", code: "Coding assistant", autre: "Other" };
const PERSONAL = [["clients", "Données clients", "Customer data"], ["rh", "Données RH", "HR data"], ["sante", "Données de santé", "Health data"]];
const OTHER = [["confidentiel", "Documents confidentiels", "Confidential documents"], ["code", "Code propriétaire", "Proprietary code"]];
const L = (fr, en) => (getLang() === "en" ? en : fr);

const blank = () => ({ step: 1, tool: "", vendor: "", category: "chatbot", departement: "", useCase: "", personal: "", dataTypes: [], users: "", usage: "interne", countries: "France", responsable: "", complement: "", docs: [], url: "", pasted: "", mode: "claude", source: "" });
let draft = session.get("aucteva.draft", null) || blank();
const save = () => session.set("aucteva.draft", { ...draft, docs: draft.docs.filter((d) => d.status === "ready") });
let etat = null;

const ext = (n) => (n.split(".").pop() || "").toUpperCase().slice(0, 5);

function newHead(v, tab) {
  return `<div class="ph"><div><h1>${t("new.title")}</h1><p>${t("new.sub")}</p></div></div>
    <div class="tabs" role="tablist" style="margin-bottom:20px">
      <a href="/app/nouveau" role="tab" aria-selected="${tab === "chat"}">${ICON.chat}${t("new.tab.chat")}</a>
      <a href="/app/connecteur" role="tab" aria-selected="false">${ICON.plug}${t("new.tab.mcp")}</a>
      <a href="/app/nouveau/formulaire" role="tab" aria-selected="${tab === "guided"}">${ICON.files}${t("new.tab.guided")}</a>
    </div>`;
}
const stepper = (n) => `<ol class="stepper">${[1, 2, 3, 4].map((i) => `<li class="${i === n ? "is-on" : i < n ? "is-done" : ""}"${i === n ? ' aria-current="step"' : ""}><span class="d">${i < n ? ICON.check : i}</span><span class="t">${t(`new.s${i}`)}</span></li>`).join("")}</ol>`;

export function renderNew(root, sub) {
  document.title = `${t("app.new")}, Aucteva`;
  const v = shellLayout(root, "new");
  if (sub !== "formulaire") return renderChatStart(v);
  if (!etat) api("/etat").then((e) => { etat = e; if (draft.step === 2 && location.pathname.startsWith("/app/nouveau")) paint(); }).catch(() => { etat = { lecture: null }; });
  const paint = () => { v.innerHTML = newHead(v, "guided") + stepper(draft.step) + (draft.step === 1 ? step1() : step2()); (draft.step === 1 ? bind1 : bind2)(v, paint); window.scrollTo(0, 0); };
  paint();
}

function step1() {
  const d = draft, en = getLang() === "en";
  const chk = (list) => list.map(([k, fr, enl]) => `<label class="chk"><input type="checkbox" name="dt" value="${k}"${d.dataTypes.includes(k) ? " checked" : ""}><span>${en ? enl : fr}</span></label>`).join("");
  return `<form class="card" id="s1" novalidate>
    <div class="card__head"><h2>${t("new.s1")}</h2><div class="scnbar">${t("new.scenario")} ${SCENARIOS.map((s) => `<button type="button" class="btn btn--ghost btn--sm" data-scn="${s.id}">${esc(s.tool)}</button>`).join("")}</div></div>
    <div class="card__body"><div class="fgrid">
      <div class="field" data-req="tool"><label for="f-tool">${t("f.tool")}</label><input type="text" id="f-tool" name="tool" value="${esc(d.tool)}" autocomplete="off" required></div>
      <div class="field" data-req="vendor"><label for="f-vendor">${t("f.vendor")}</label><input type="text" id="f-vendor" name="vendor" value="${esc(d.vendor)}" autocomplete="off" required></div>
      <div class="field"><label for="f-cat">${t("f.purpose")}</label><select id="f-cat" name="category">${CATEGORIES.map(([k, l]) => `<option value="${k}"${k === d.category ? " selected" : ""}>${esc(en ? CAT_EN[k] : l)}</option>`).join("")}</select></div>
      <div class="field"><label for="f-dept">${t("f.dept")} <span class="opt">(${t("f.optional")})</span></label><select id="f-dept" name="departement"><option value=""></option>${DEPTS.fr.map((x, i) => `<option value="${esc(x)}"${x === d.departement ? " selected" : ""}>${esc(DEPTS[en ? "en" : "fr"][i])}</option>`).join("")}</select></div>
      <div class="field field--full" data-req="useCase"><label for="f-uc">${t("f.usecase")}</label><textarea id="f-uc" name="useCase" rows="3" required aria-describedby="f-uc-h">${esc(d.useCase)}</textarea><span class="hint" id="f-uc-h">${t("f.usecase.h")}</span></div>
      <div class="field" data-req="personal"><span class="label" id="lb-p">${t("f.personal")}</span><div class="seg" role="radiogroup" aria-labelledby="lb-p"><label><input type="radio" name="personal" value="oui"${d.personal === "oui" ? " checked" : ""}><span>${t("f.yes")}</span></label><label><input type="radio" name="personal" value="non"${d.personal === "non" ? " checked" : ""}><span>${t("f.no")}</span></label></div></div>
      <div class="field"><span class="label" id="lb-s">${t("f.scope")}</span><div class="seg" role="radiogroup" aria-labelledby="lb-s"><label><input type="radio" name="usage" value="interne"${d.usage !== "externe" ? " checked" : ""}><span>${t("f.internal")}</span></label><label><input type="radio" name="usage" value="externe"${d.usage === "externe" ? " checked" : ""}><span>${t("f.external")}</span></label></div></div>
      <div class="field field--full" id="ptypes"${d.personal === "oui" ? "" : " hidden"}><span class="label">${t("f.personalTypes")}</span><div class="checks">${chk(PERSONAL)}</div></div>
      <div class="field field--full"><span class="label">${t("f.otherData")} <span class="opt">(${t("f.optional")})</span></span><div class="checks">${chk(OTHER)}</div></div>
      <div class="field"><label for="f-users">${t("f.users")}</label><input type="number" id="f-users" name="users" min="0" step="1" inputmode="numeric" value="${esc(d.users)}"></div>
      <div class="field"><label for="f-countries">${t("f.countries")}</label><input type="text" id="f-countries" name="countries" value="${esc(d.countries)}"></div>
      <div class="field"><label for="f-owner">${t("f.owner")} <span class="opt">(${t("f.optional")})</span></label><input type="text" id="f-owner" name="responsable" value="${esc(d.responsable)}" autocomplete="name"></div>
      <div class="field field--full"><label for="f-more">${t("f.more")} <span class="opt">(${t("f.optional")})</span></label><textarea id="f-more" name="complement" rows="2">${esc(d.complement)}</textarea></div>
    </div></div>
    <div class="formfoot"><p class="formerr" id="err" role="alert"></p><button type="submit" class="btn">${t("f.next")}${ICON.arrow}</button></div>
  </form>`;
}

function bind1(v, paint) {
  const f = v.querySelector("#s1");
  f.addEventListener("input", (e) => {
    const x = e.target;
    if (x.name === "dt") draft.dataTypes = [...f.querySelectorAll("input[name=dt]:checked")].map((i) => i.value);
    else if (x.name) draft[x.name] = x.value;
    if (x.name === "personal") { f.querySelector("#ptypes").hidden = x.value !== "oui"; if (x.value === "non") { draft.dataTypes = draft.dataTypes.filter((k) => !["clients", "rh", "sante"].includes(k)); f.querySelectorAll("#ptypes input").forEach((i) => { i.checked = false; }); } }
    x.closest(".field")?.classList.remove("is-invalid");
    save();
  });
  f.querySelectorAll("[data-scn]").forEach((b) => b.addEventListener("click", () => {
    const s = SCENARIOS.find((x) => x.id === b.dataset.scn);
    const personal = s.dataTypes.some((k) => ["clients", "rh", "sante"].includes(k));
    draft = { ...blank(), tool: s.tool, vendor: s.vendor, category: s.category, useCase: s.useCase, dataTypes: s.dataTypes.filter((k) => k !== "aucune"), personal: personal ? "oui" : "non", users: String(s.users), countries: s.countries, usage: s.id === "support" ? "externe" : "interne", departement: { marketing: "Marketing", support: "Service client", recruiter: "Ressources humaines" }[s.id], responsable: "", step: 1,
      docs: [{ nom: `contrat-${slug(s.tool)}.md`, format: "MD", taille: new Blob([s.contract]).size, mots: countWords(s.contract), texte: s.contract, status: "ready" }], source: `Scénario de démonstration ${s.tool}` };
    save(); paint();
  }));
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const missing = ["tool", "vendor", "useCase"].filter((k) => !String(draft[k] || "").trim());
    if (!draft.personal) missing.push("personal");
    f.querySelectorAll("[data-req]").forEach((el) => el.classList.toggle("is-invalid", missing.includes(el.dataset.req)));
    const err = f.querySelector("#err");
    if (missing.length) { err.textContent = t("f.err.s1"); f.querySelector(".is-invalid input, .is-invalid textarea")?.focus(); return; }
    if (draft.personal === "oui" && !draft.dataTypes.some((k) => ["clients", "rh", "sante"].includes(k))) { err.textContent = t("f.err.personal"); f.querySelector("#ptypes input")?.focus(); return; }
    draft.step = 2; save(); paint();
  });
}

function step2() {
  const d = draft;
  const ok = !!(etat && etat.lecture);
  if (etat && !ok && d.mode === "claude") d.mode = "regles";
  return `<form class="card" id="s2" novalidate>
    <div class="card__head"><h2>${t("new.s2")}</h2><span class="small muted">${esc(d.tool)} · ${esc(d.vendor)}</span></div>
    <div class="card__body" style="display:grid;gap:20px">
      <label class="drop" id="drop" tabindex="0"><input type="file" id="files" multiple accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document">${ICON.upload}<strong>${t("d.drop")}</strong><p>${t("d.drop.h")}</p><span class="btn btn--secondary btn--sm">${t("d.browse")}</span></label>
      <div id="files-list"></div>
      <div class="field"><label for="f-url">${t("d.url")}</label><div class="url-row"><input type="url" id="f-url" value="${esc(d.url)}" placeholder="https://www.exemple.com/terms" autocomplete="off"><button type="button" class="btn btn--secondary" id="fetch">${t("d.fetch")}</button></div></div>
      <details${d.pasted ? " open" : ""}><summary class="small" style="cursor:pointer">${t("d.paste")}</summary><div class="field" style="margin-top:10px"><textarea id="f-paste" rows="6" spellcheck="false" aria-label="${esc(t("d.paste"))}">${esc(d.pasted)}</textarea></div></details>
      <div class="field"><span class="label">${t("d.mode")}</span><div class="modes">
        <label class="mode${ok ? "" : " mode--off"}"><input type="radio" name="mode" value="claude"${d.mode === "claude" ? " checked" : ""}${ok || !etat ? "" : " disabled"}><strong>${t("d.full")}</strong><span>${t("d.full.d")}${etat && !ok ? ` ${t("d.unavailable")}` : ""}</span></label>
        <label class="mode"><input type="radio" name="mode" value="regles"${d.mode === "regles" ? " checked" : ""}><strong>${t("d.rules")}</strong><span>${t("d.rules.d")}</span></label>
      </div></div>
      <p class="small muted" style="margin:0">${t("d.privacy")}</p>
    </div>
    <div class="formfoot"><button type="button" class="btn btn--ghost" id="back">${ICON.back}${t("f.back")}</button><p class="formerr" id="err" role="alert"></p><button type="submit" class="btn" id="go">${t("d.submit")}</button></div>
  </form>`;
}

function bind2(v, paint) {
  const f = v.querySelector("#s2"), list = v.querySelector("#files-list"), drop = v.querySelector("#drop"), input = v.querySelector("#files");
  const paintFiles = () => {
    list.innerHTML = draft.docs.length ? `<div class="tablewrap"><table class="table files"><thead><tr><th>${t("d.name")}</th><th>${t("d.format")}</th><th>${t("d.size")}</th><th>${t("d.state")}</th><th><span class="sr-only">${t("d.remove")}</span></th></tr></thead><tbody>
      ${draft.docs.map((x, i) => `<tr><td>${esc(x.nom)}</td><td class="mono small">${esc(x.format)}</td><td class="small muted">${x.taille ? esc(fmtSize(x.taille)) : "·"}</td><td class="small">${x.status === "ready" ? `<span class="st-ok">${t("d.ready")}</span>, ${fmtInt(x.mots)} ${t("d.words")}` : x.status === "error" ? `<span class="st-err">${esc(x.error)}</span>` : `<span class="muted">${t("d.reading")}</span>`}</td><td><button type="button" class="iconbtn" data-rm="${i}" aria-label="${esc(t("d.remove"))} ${esc(x.nom)}">${ICON.x}</button></td></tr>`).join("")}
    </tbody></table></div>` : "";
    list.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { draft.docs.splice(Number(b.dataset.rm), 1); save(); paintFiles(); }));
  };
  const add = async (files) => {
    for (const file of [...files].slice(0, Math.max(0, 6 - draft.docs.length))) {
      const doc = { nom: file.name, format: ext(file.name), taille: file.size, mots: 0, status: "reading" };
      draft.docs.push(doc); paintFiles();
      try { const { texte, pages } = await readFile(file); const n = countWords(texte); if (n < 20) throw new Error(L("Presque aucun texte lisible (scan sans OCR ?)", "Almost no readable text (scan without OCR?)")); Object.assign(doc, { texte, pages, mots: n, status: "ready" }); }
      catch (e) { Object.assign(doc, { status: "error", error: e.message || "Erreur" }); }
      save(); paintFiles();
    }
  };
  input.addEventListener("change", (e) => { add(e.target.files); e.target.value = ""; });
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
  drop.addEventListener("drop", (e) => add(e.dataTransfer.files));
  v.querySelector("#f-url").addEventListener("input", (e) => { draft.url = e.target.value; save(); });
  v.querySelector("#f-paste").addEventListener("input", (e) => { draft.pasted = e.target.value; save(); });
  f.querySelectorAll("input[name=mode]").forEach((i) => i.addEventListener("change", () => { draft.mode = i.value; save(); }));
  v.querySelector("#fetch").addEventListener("click", async (e) => {
    const url = draft.url.trim(); if (!url) { v.querySelector("#f-url").focus(); return; }
    const b = e.currentTarget; b.disabled = true;
    try { const r = await api("/extraction", { url }); draft.docs.push({ nom: r.titre || r.url, format: "URL", taille: new Blob([r.texte]).size, mots: r.mots, texte: r.texte, status: "ready" }); save(); paintFiles(); toast(L("Texte récupéré", "Text fetched")); }
    catch (err) { toast(err.message, "err"); } finally { b.disabled = false; }
  });
  v.querySelector("#back").addEventListener("click", () => { draft.step = 1; save(); paint(); });
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const docs = draft.docs.filter((x) => x.status === "ready");
    if (draft.pasted.trim()) docs.push({ nom: L("Texte collé", "Pasted text"), format: "TXT", taille: new Blob([draft.pasted]).size, mots: countWords(draft.pasted), texte: draft.pasted });
    let contract = "";
    const metas = docs.map((x, i) => {
      if (contract) contract += "\n\n";
      if (docs.length > 1) contract += `=== Document ${i + 1} : ${x.nom} ===\n`;
      const tx = x.texte.trimStart(), lead = x.texte.length - tx.length; // le serveur retire les espaces de tête
      const debut = contract.length;
      contract += tx;
      return { nom: x.nom, format: x.format, taille: x.taille, mots: x.mots, debut, pages: Array.isArray(x.pages) && x.pages.length > 1 ? x.pages.map((p) => Math.max(0, p - lead) + debut) : undefined };
    });
    const err = v.querySelector("#err");
    if (draft.mode === "claude" && contract.trim().length < 200) { err.textContent = t("d.err.none"); return; }
    const dataTypes = draft.personal === "non" && !draft.dataTypes.length ? ["aucune"] : draft.dataTypes;
    const payload = { tool: draft.tool, vendor: draft.vendor, category: draft.category, useCase: draft.useCase, dataTypes, countries: draft.countries, users: Number(draft.users) || 0, contract, source: draft.source || docs.map((x) => x.nom).join(", "), departement: draft.departement, usage: draft.usage, responsable: draft.responsable, complement: draft.complement, documents: metas, mode: draft.mode };
    const go = v.querySelector("#go"); go.disabled = true; err.textContent = "";
    try {
      const { dossier } = await api("/examens", payload);
      invalidate(); draft = blank(); save();
      go(`/app/en-cours/${dossier.id}`);
    } catch (x) {
      if (draft.mode === "claude") { err.textContent = x.message; go.disabled = false; return; }
      // Service indisponible : le moteur de règles tourne dans le navigateur.
      const id = `LOCAL-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      const { contract: c, mode, ...meta } = payload;
      const d = { id, mode: "regles", statut: "termine", cree: Date.now(), maj: Date.now(), input: { ...meta, contrat_mots: countWords(c) }, resultat: analyse(payload, { moteur: "règles v1 (navigateur)" }), validation: null, decision: null, local: true, texte: c };
      session.set(`aucteva.local.${id}`, d); draft = blank(); save();
      go(`/app/dossier/${id}`);
    }
  });
  paintFiles();
}

// Étape 3 : suivi de l'analyse. Chaque étape suit un état réel du dossier côté serveur.
let timers = [];
export const clearTimers = () => { timers.forEach((x) => { clearTimeout(x); clearInterval(x); }); timers = []; };

export async function renderProgress(root, id) {
  document.title = `${t("pg.title")}, Aucteva`;
  const v = shellLayout(root, "new");
  let d;
  try { d = (await api(`/examens/${id}`)).dossier; } catch (e) { v.innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const rules = d.mode === "regles";
  const docs = d.input.documents || [];
  const started = d.cree || Date.now();
  v.innerHTML = `${stepper(3)}
    <div class="card prog" style="max-width:none"><div class="card__body">
      <div class="crumbs"><span class="mono">${esc(d.id)}</span></div>
      <h1 style="font-size:22px">${t("pg.title")}</h1>
      <p class="muted" style="margin:4px 0 0">${esc(d.input.tool)} · ${esc(d.input.vendor)}</p>
      <div id="bar"${rules ? " hidden" : ""}><div class="prog__bar" role="progressbar" aria-label="${esc(t("pg.estimate"))}"><span id="fill"></span></div><div class="prog__meta"><span>${t("pg.estimate")}</span><span id="clock"></span></div></div>
      <ol class="plist" id="steps"></ol>
      <div id="perr"></div>
    </div></div>`;
  const words = d.input.contrat_mots || 0;
  const steps = rules
    ? [["pg.1", `${docs.length || 1} ${L("document", "document")}${docs.length > 1 ? "s" : ""}`], ["pg.2", `${fmtInt(words)} ${t("d.words")}`], ["pg.rules", ""], ["pg.6", ""]]
    : [["pg.1", docs.length ? docs.map((x) => x.nom).join(", ") : `${fmtInt(words)} ${t("d.words")}`], ["pg.2", `${fmtInt(words)} ${t("d.words")}`], ["pg.3", ""], ["pg.4", ""], ["pg.5", ""], ["pg.6", ""]];
  const paintSteps = (doneUpTo, detail = {}) => {
    v.querySelector("#steps").innerHTML = steps.map(([k, det], i) => `<li class="${i < doneUpTo ? "is-done" : i === doneUpTo ? "is-on" : ""}"><span class="ic">${i < doneUpTo ? ICON.check : ""}</span><span>${t(k)}<span class="det">${esc(detail[i] ?? det)}</span></span></li>`).join("");
  };
  const expected = Math.max(35, Math.min(150, 25 + words / 120));
  const finish = (dd) => {
    clearTimers();
    const L2 = dd.resultat?.lecture;
    paintSteps(steps.length, rules ? {} : { 4: L2?.citations ? `${L2.citations.verifiees} / ${L2.citations.total} ${t("ws.cites")}` : "" });
    const fill = v.querySelector("#fill"); if (fill) fill.style.width = "100%";
    invalidate();
    timers.push(setTimeout(() => { go(`/app/dossier/${dd.id}`); }, rules ? 900 : 1400));
  };
  if (d.statut === "termine") { finish(d); return; }
  const tick = () => {
    const sec = (Date.now() - started) / 1000;
    const fill = v.querySelector("#fill"); if (fill) fill.style.width = `${Math.round(92 * (1 - Math.exp(-sec / expected)))}%`;
    const c = v.querySelector("#clock"); if (c) c.textContent = `${Math.floor(sec / 60) ? `${Math.floor(sec / 60)} min ` : ""}${Math.floor(sec % 60)} s ${t("pg.elapsed")}`;
  };
  tick(); timers.push(setInterval(tick, 1000));
  const poll = async () => {
    try { d = (await api(`/examens/${id}`)).dossier; } catch { /* nouvelle tentative */ }
    if (d.statut === "termine") return finish(d);
    if (d.statut === "erreur") {
      clearTimers();
      v.querySelector("#perr").innerHTML = `<p class="err" style="margin-top:16px">${t("pg.fail")} : ${esc(d.erreur || "")}</p><div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="btn" id="rr">${t("pg.retryRules")}</button><a class="btn btn--secondary" href="/app/nouveau/formulaire">${t("pg.edit")}</a></div>`;
      v.querySelector("#rr").addEventListener("click", async () => { try { const c = (await api(`/examens/${id}/contrat`)).texte; const i = d.input; const r = await api("/examens", { tool: i.tool, vendor: i.vendor, category: i.category, useCase: i.useCase, dataTypes: i.dataTypes, countries: i.countries, users: i.users, contract: c, source: i.source, departement: i.departement, usage: i.usage, responsable: i.responsable, documents: i.documents, mode: "regles" }); go(`/app/en-cours/${r.dossier.id}`); } catch (e) { toast(e.message, "err"); } });
      return;
    }
    const running = d.statut === "en_cours" || d.statut === "en_cours_api";
    const sec = (Date.now() - started) / 1000;
    paintSteps(running ? 3 : 2, { 2: d.statut === "attente_lecture" ? L("Lecture attendue depuis l'assistant connecté", "Awaiting reading from the connected assistant") : !running && sec > 150 ? t("pg.slow") : "" });
    timers.push(setTimeout(poll, 2500));
  };
  paintSteps(2); poll();
}

// Conversation : l'assistant réclame ce qui manque, lit les pièces jointes et ouvre le dossier.
let pending = [];
async function addPieces(files) {
  for (const file of [...(files || [])].slice(0, 6)) {
    try { toast(`${L("Lecture de", "Reading")} ${file.name}`); const { texte } = await readFile(file); if (countWords(texte) < 20) { toast(`${file.name} : ${L("presque aucun texte lisible", "almost no readable text")}`, "err"); continue; } pending.push({ nom: file.name, texte }); }
    catch (e) { toast(e.message, "err"); }
  }
}
const composer = (ph) => `<form class="composer" id="cf" novalidate>
  <div class="composer__pieces" id="cp"></div>
  <div class="composer__row">
    <label class="iconbtn" for="cfile" title="${esc(L("Déposer un document", "Attach a document"))}">${ICON.clip}<span class="sr-only">${L("Déposer un document", "Attach a document")}</span></label>
    <input type="file" id="cfile" multiple accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
    <textarea id="ci" rows="1" aria-label="${esc(ph)}" placeholder="${esc(ph)}"></textarea>
    <button type="submit" class="iconbtn iconbtn--send" id="cs" aria-label="${L("Envoyer", "Send")}">${ICON.send}</button>
  </div></form>`;
function bindComposer(v, onSend) {
  const input = v.querySelector("#ci"), piecesEl = v.querySelector("#cp");
  const paintP = () => { piecesEl.innerHTML = pending.map((p, i) => `<span class="chip">${esc(p.nom)}, ${fmtInt(countWords(p.texte))} ${t("d.words")} <button type="button" data-rm="${i}" aria-label="${esc(t("d.remove"))}">×</button></span>`).join(""); piecesEl.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { pending.splice(Number(b.dataset.rm), 1); paintP(); })); };
  const grow = () => { input.style.height = "auto"; input.style.height = `${Math.min(160, input.scrollHeight)}px`; };
  input.addEventListener("input", grow);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); v.querySelector("#cf").requestSubmit(); } });
  v.querySelector("#cfile").addEventListener("change", async (e) => { await addPieces(e.target.files); e.target.value = ""; paintP(); input.focus(); });
  v.querySelector("#cf").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !pending.length) { input.focus(); return; }
    const pieces = pending.splice(0); input.value = ""; grow(); paintP();
    const ok = await onSend(text, pieces);
    if (!ok) { pending.unshift(...pieces); input.value = text; paintP(); }
  });
  paintP();
  return { input };
}

function renderChatStart(v) {
  v.innerHTML = newHead(v, "chat") + `<section class="newask"><h2>${t("ov.ask")}</h2><div id="nask"></div></section>
    <h2 class="h-sub">${t("new.alt")}</h2>
    <div class="list-links list-links--2">
      <a href="/app/connecteur"><strong>${t("way.mcp.t")}</strong><span>${t("way.mcp.d")}</span></a>
      <a href="/app/nouveau/formulaire"><strong>${t("way.form.t")}</strong><span>${t("way.form.d")}</span></a>
    </div>`;
  askBar(v.querySelector("#nask"), { tone: "light", chips: 8, autofocus: true });
}

export async function renderConversation(root, id) {
  document.title = `${L("Conversation", "Conversation")} ${id}, Aucteva`;
  const v = shellLayout(root, "new");
  let c;
  try { c = (await api(`/conversations/${id}`)).conversation; }
  catch (e) { v.innerHTML = `<div class="err">${esc(e.message)}</div><p style="margin-top:12px"><a class="btn" href="/app/nouveau">${t("conv.new")}</a></p>`; return; }
  v.innerHTML = `<div class="ph"><div><div class="crumbs"><a href="/app/nouveau">${t("new.tab.chat")}</a> / <span class="mono">${esc(id)}</span></div><h1 id="ct"></h1></div><a class="btn btn--secondary" href="/app/nouveau">${t("conv.new")}</a></div>
    <div class="chat"><div class="chat__list" id="cl" aria-live="polite"></div>${composer(t("conv.reply"))}</div>`;
  const list = v.querySelector("#cl");
  let at = Date.now();
  const busy = () => c.statut === "en_attente" || c.statut === "en_cours";
  const paint = () => {
    v.querySelector("#ct").textContent = c.dossier?.outil ? `${c.dossier.outil}${c.dossier.fournisseur ? `, ${c.dossier.fournisseur}` : ""}` : L("Examen d'un outil d'IA", "AI tool review");
    list.innerHTML = c.messages.map((m) => `<div class="msg msg--${m.role === "user" ? "user" : "assistant"}"><div class="msg__text">${esc(m.text)}</div>
      ${m.pieces?.length ? `<div class="msg__pieces">${m.pieces.map((p) => `<span class="chip">${esc(p.nom)}, ${fmtInt(p.mots)} ${t("d.words")}</span>`).join("")}</div>` : ""}
      ${m.dossier ? `<a class="dcard" href="/app/dossier/${esc(m.dossier.id)}">${avisPill(m.dossier.verdict)}<span class="muted small">${t("ws.vigilance")} ${m.dossier.score} / 100</span><span class="go">${t("tbl.open")} ${esc(m.dossier.id)}${ICON.arrow}</span></a>` : ""}</div>`).join("")
      + (busy() ? `<div class="msg msg--assistant"><span class="wait"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span id="cw">${c.pieces.length ? L("Lecture en cours", "Reading") : L("Réponse en cours", "Replying")}</span></span></div>` : "")
      + (c.statut === "erreur" ? `<div class="msg msg--assistant"><div class="msg__text">${L("La réponse a échoué", "The reply failed")} : ${esc(c.erreur || "")}. ${L("Renvoyez votre message.", "Send your message again.")}</div></div>` : "");
    v.querySelector("#cs").disabled = busy(); v.querySelector("#ci").disabled = busy();
    list.lastElementChild?.scrollIntoView({ block: "end" });
  };
  const send = async (text, pieces) => {
    try { c = (await api(`/conversations/${id}/messages`, { text, pieces })).conversation; at = Date.now(); paint(); poll(); return true; }
    catch (e) { toast(e.message, "err"); return false; }
  };
  bindComposer(v, send);
  const poll = async () => {
    clearTimers();
    if (!busy()) { v.querySelector("#ci").focus(); return; }
    const w = v.querySelector("#cw"); if (w) w.textContent = `${c.pieces.length ? L("Lecture en cours", "Reading") : L("Réponse en cours", "Replying")}, ${Math.round((Date.now() - at) / 1000)} s`;
    try { const r = (await api(`/conversations/${id}`)).conversation; if (r.maj !== c.maj || r.statut !== c.statut) { c = r; paint(); if (c.dossierId) invalidate(); } } catch { /* nouvelle tentative */ }
    timers.push(setTimeout(poll, 2000));
  };
  paint(); poll();
}
