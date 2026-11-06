// Dossier d'analyse : document source et analyse côte à côte, dossier de synthèse, validation juridique et décision d'utilisation.
import { t, getLang } from "./i18n.js";
import { LOGO, api, esc, fmtInt, fmtDay, ICON, avisPill, decisionPill, stagePill, dimensionsOf, constatsOf, statusKey, CLAUSE, clausePill, copy, toast, session, slug, go } from "./ui.js";
import { shellLayout, invalidate } from "./shell.js";
import { avenant, amendmentClauses, MENTION, TOPICS } from "./engine.js";
import { fold, locate, renderDoc, sectionOf, scrollWithin } from "./doc.js";

const L = (fr, en) => (getLang() === "en" ? en : fr);
const ROLES = ["Avocat", "Avocat associé"];
const CAT = { chatbot: "Chatbot, assistant interne", rh: "Ressources humaines, recrutement", marketing: "Marketing, contenus", support: "Support client", documents: "Analyse de documents", code: "Assistant de code", autre: "Autre" };
const DATA = { aucune: "Aucune donnée personnelle", clients: "Données clients", rh: "Données RH", sante: "Données de santé", confidentiel: "Documents confidentiels", code: "Code propriétaire" };

let cur = { id: null, d: null, texte: null };

async function load(id) {
  if (id.startsWith("LOCAL-")) { const d = session.get(`aucteva.local.${id}`, null); return { d, texte: d?.texte || "" }; }
  const [{ dossier }, txt] = await Promise.all([api(`/examens/${id}`), api(`/examens/${id}/contrat`).catch(() => ({ texte: "" }))]);
  return { d: dossier, texte: txt.texte || "" };
}

export async function renderDossier(root, id, tab = "analyse") {
  const v = shellLayout(root, "assessments", { flush: true });
  if (cur.id !== id || !cur.d) {
    v.innerHTML = `<div class="ws__head"><span class="sk" style="width:240px;height:22px"></span><div style="height:80px"></div></div><div class="ws__body"><span class="sk" style="height:300px"></span></div>`;
    try { const r = await load(id); if (!r.d) throw new Error(L("Dossier introuvable.", "File not found.")); cur = { id, ...r }; }
    catch (e) { v.innerHTML = `<div class="main"><div class="err">${esc(e.message)}</div><p style="margin-top:12px"><a class="btn" href="/app/dossiers">${t("app.assessments")}</a></p></div>`; return; }
  }
  const d = cur.d;
  if (d.statut !== "termine") { go(`/app/en-cours/${id}`); return; }
  const r = d.resultat, m = r.meta;
  document.title = `${m.outil}, ${d.id}, Aucteva`;
  const base = `/app/dossier/${d.id}`;
  const done = (x) => (x ? "is-done" : "is-todo");
  v.innerHTML = `
    <div class="ws__head no-print">
      <div class="crumbs"><a href="/app/dossiers">${t("app.assessments")}</a> / <span class="mono">${esc(d.id)}</span></div>
      <div class="ws__top">
        <div><h1>${esc(m.outil)}</h1><div class="ws__vendor">${esc(m.fournisseur)}${d.input.departement ? ` · ${esc(d.input.departement)}` : ""}${d.input.responsable ? ` · ${esc(d.input.responsable)}` : ""}</div>
          <div class="ws__meta">${stagePill(d)}${avisPill(r.verdict)}<span class="pill pill--neutral">${t("ws.vigilance")} ${r.score} / 100</span>${r.lecture?.citations?.total ? `<span class="pill pill--neutral">${r.lecture.citations.verifiees} / ${r.lecture.citations.total} ${t("ws.cites")}</span>` : ""}</div></div>
        <div class="ws__actions"><button type="button" class="btn btn--secondary btn--sm" data-a="link">${ICON.link}${t("ws.copyLink")}</button><button type="button" class="btn btn--secondary btn--sm" data-a="print">${ICON.print}${t("ws.export")}</button></div>
      </div>
      <div class="wf" aria-label="${L("Étapes du dossier", "File stages")}">
        <div class="is-done"><strong>${t("wf.ai")}</strong><div class="s">${esc(fmtDay(d.cree))} · ${t("wf.ai.d")}</div></div>
        <div class="${done(d.validation)}"><strong>${t("wf.law")}</strong><div class="s">${d.validation ? `${esc(d.validation.nom)}, ${esc(d.validation.role)}, ${esc(d.validation.when || "")}` : t("wf.pending")}</div></div>
        <div class="${done(d.decision)}"><strong>${t("wf.co")}</strong><div class="s">${d.decision ? `${esc(t(`dec.${d.decision.decision}`))}, ${esc(d.decision.nom)}` : d.validation ? t("wf.pending") : t("wf.locked")}</div></div>
      </div>
      <nav class="ws__tabs" aria-label="${L("Sections du dossier", "File sections")}">
        <a href="${base}"${tab === "analyse" ? ' aria-current="page"' : ""}>${t("ws.analysis")}</a>
        <a href="${base}/synthese"${tab === "synthese" ? ' aria-current="page"' : ""}>${t("ws.summary")}</a>
        <a href="${base}/decision"${tab === "decision" ? ' aria-current="page"' : ""}>${t("ws.decision")}</a>
      </nav>
    </div>
    <div class="ws__body" id="wsb"></div>`;
  v.querySelector("[data-a=link]").addEventListener("click", () => copy(`${location.origin}${base}`));
  v.querySelector("[data-a=print]").addEventListener("click", () => { if (tab !== "synthese") { go(`${base}/synthese`); setTimeout(() => window.print(), 600); } else window.print(); });
  const body = v.querySelector("#wsb");
  if (tab === "synthese") return paintSummary(body, d);
  if (tab === "decision") return paintDecision(body, d, () => renderDossier(root, id, "decision"));
  paintAnalysis(body, d, cur.texte);
}

// Onglet Analyse : document source à gauche, analyse à droite, chaque citation relie les deux.
function paintAnalysis(body, d, texte) {
  const r = d.resultat;
  const cs = constatsOf(r);
  const dims = dimensionsOf(r);
  const F = texte ? fold(texte) : null;
  const ranges = [], located = new Map();
  if (F) for (const c of cs) { const loc = c.citation && locate(F, c.citation); if (loc) { ranges.push({ start: loc[0], end: loc[1], cls: `cite--${CLAUSE[statusKey(c)]}`, key: c.topic }); located.set(c.topic, loc[0]); } }
  const doc = texte ? renderDoc(texte, ranges) : null;
  const DOCS = d.input.documents || [];
  // Où se trouve un passage : document source, page (PDF), section, ligne.
  const where = (off) => {
    const n = doc.lineOf(off), s = sectionOf(doc.sections, n);
    let src = null, page = null;
    for (const x of DOCS) if ((x.debut || 0) <= off) src = x;
    if (src?.pages?.length) { page = 0; for (let i = 0; i < src.pages.length; i++) if (src.pages[i] <= off) page = i + 1; }
    return { line: n, section: s?.title || null, page, src: src?.nom || null };
  };
  const refText = (w) => [w.section, `${t("ws.line")} ${w.line}`, w.page ? `${t("ws.page")} ${w.page}` : null].filter(Boolean).join(" · ") + (DOCS.length > 1 && w.src ? ` · ${w.src}` : "");
  const ref = (topic) => (doc && located.has(topic) ? esc(refText(where(located.get(topic)))) : "");
  const docs = DOCS.length ? DOCS.map((x) => x.nom).join(", ") : d.input.source || L("Contrat", "Contract");
  const FIX = Object.fromEntries(TOPICS.map((x) => [x.id, x.fix]));
  const order = [...located.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k); // observations dans l'ordre du texte
  const human = [
    ...cs.filter((c) => c.statut === "ambiguë").map((c) => `${c.sujet} : ${L("formulation ambiguë", "ambiguous wording")}.`),
    ...cs.filter((c) => c.statut === "absent" && c.pertinent).map((c) => `${c.sujet} : ${L("aucune clause dans le contrat", "no clause in the contract")}.`),
    ...cs.filter((c) => c.citation && F && !located.has(c.topic)).map((c) => `${c.sujet} : ${L("passage à localiser manuellement", "passage to locate manually")}.`),
  ];
  const L2 = r.lecture;
  body.innerHTML = `
    ${getLang() === "en" ? `<p class="small muted" style="margin:0 0 12px">${t("ws.contentFr")}</p>` : ""}
    <div class="tabs mobtabs" role="tablist"><button type="button" role="tab" aria-selected="false" data-mob="doc">${t("ws.tab.doc")}</button><button type="button" role="tab" aria-selected="true" data-mob="an">${t("ws.tab.an")}</button></div>
    <div class="panes" data-mob="an">
      <section class="pane pane--doc" aria-label="${esc(t("ws.doc"))}">
        <div class="pane__head"><div class="pane__title">${ICON.doc}<span title="${esc(docs)}">${esc(docs)}</span></div><span class="small muted" style="margin-left:auto">${fmtInt(d.input.contrat_mots || 0)} ${t("d.words")}</span></div>
        ${doc ? `<div class="pane__tools">
          <label class="search"><span class="sr-only">${t("ws.search")}</span>${ICON.search}<input type="search" id="dq" placeholder="${esc(t("ws.search"))}"></label>
          <span class="hits" id="dh" aria-live="polite"></span>
          <button type="button" class="btn btn--ghost btn--sm" id="dp" aria-label="${L("Résultat précédent", "Previous match")}">${ICON.up}</button><button type="button" class="btn btn--ghost btn--sm" id="dn" aria-label="${L("Résultat suivant", "Next match")}">${ICON.down}</button>
          ${doc.sections.length > 1 ? `<label><span class="sr-only">${t("ws.sections")}</span><select class="select" id="ds"><option value="">${t("ws.sections")}</option>${doc.sections.map((s) => `<option value="${s.n}">${esc(s.title)}</option>`).join("")}</select></label>` : ""}
        </div>
        <div class="focusbar" id="fb" aria-live="polite"><span class="muted small">${t("ws.pick")}</span></div>
        <div class="doc" id="doc" tabindex="0">${doc.html}</div>` : `<div class="card__body"><p class="muted">${t("ws.noDoc")}</p></div>`}
      </section>
      <div class="an">
        <section class="card sumcard">
          <div class="sumcard__top"><div><div class="sumcard__lbl">${t("ws.proposed")}</div><div class="sumcard__avis">${avisPill(r.verdict)}</div><div class="prepared" style="margin-top:6px">${t("ws.prepared")}</div></div>
            <div class="sumcard__score"><div class="sumcard__lbl">${t("ws.vigilance")}</div><div class="v">${r.score}<small>/ 100</small></div></div></div>
          <div class="scale" role="img" aria-label="${t("ws.vigilance")} ${r.score} / 100"><i style="left:calc(${r.score}% - 1px)"></i></div>
          <div class="scale__lg"><span>${L("Autorisé", "Approved")} &lt; 35</span><span>35 à 64</span><span>≥ 65 ${L("non autorisé", "not approved")}</span></div>
          <div class="sumcard__resume">${r.resume.map((s) => `<p>${esc(s)}</p>`).join("")}</div>
        </section>
        ${r.points_bloquants.length ? `<section class="card blockers"><div class="card__head"><h2>${t("ws.blockers")}</h2></div><div class="card__body"><ul class="blist">${r.points_bloquants.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></div></section>` : ""}
        <section class="card" aria-label="${L("Huit domaines de vigilance", "Eight review areas")}">
          <div class="card__head"><h2>${L("Domaines de vigilance", "Review areas")}</h2><span class="small muted">${L("Catégories d'examen, pas une certification", "Review categories, not a certification")}</span></div>
          ${dims.map((dm, i) => `<div class="dim${dm.status === "dangereuse" || dm.status === "ambiguë" ? " is-open" : ""}" data-dim="${dm.id}">
            <button type="button" aria-expanded="${dm.status === "dangereuse" || dm.status === "ambiguë"}"><span class="n">${i + 1}</span><span class="lbl">${esc(t(`dim.${dm.id}`))}</span>${clausePill(dm.status)}<span class="chev">${ICON.down}</span></button>
            <div class="dim__body">${dm.items.map((c) => {
              const k = statusKey(c);
              return `<div class="topic"><div class="topic__h"><span>${esc(c.sujet)}</span>${clausePill(k)}</div>
                ${c.note ? `<p class="topic__note">${esc(c.note)}</p>` : ""}
                ${c.citation ? `<q lang="${esc((L2?.langue || "").startsWith("angl") ? "en" : "fr")}">${esc(c.citation)}</q>
                  <div class="topic__f"><span>${located.has(c.topic) ? ref(c.topic) : t("ws.notLocated")}</span>${located.has(c.topic) ? `<button type="button" class="link-btn" data-go="${esc(c.topic)}">${t("ws.locate")}</button>` : ""}</div>`
                : `<p class="small muted" style="margin:6px 0 0">${t("ws.absent")} ${k === "absent" ? t("ws.absent.review") : ""}</p>`}
                ${["dangereuse", "ambiguë", "absent"].includes(k) ? `<div class="todo"><strong>${t("ws.check")}</strong> ${esc(t(`ws.check.${k}`))}${FIX[c.topic] ? `<details><summary>${t("ws.fix")}</summary><p>${esc(FIX[c.topic])}</p></details>` : ""}</div>` : ""}
                <div class="topic__f" style="margin-top:4px"><span>${esc(c.base || "")}</span></div></div>`;
            }).join("")}</div></div>`).join("")}
        </section>
        <section class="card"><div class="card__head"><h2>${t("ws.conditions")}</h2></div><div class="card__body">${r.conditions.length ? `<ul class="blist">${r.conditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p class="muted" style="margin:0">${L("Aucune condition : l'outil n'est pas autorisé en l'état.", "No conditions: the tool is not approved as is.")}</p>`}</div></section>
        <section class="card"><div class="card__head"><h2>${t("ws.human")}</h2><span class="pill pill--info">${human.length}</span></div><div class="card__body">${human.length ? `<ul class="blist">${human.map((h) => `<li>${esc(h)}</li>`).join("")}</ul>` : `<p class="muted" style="margin:0">${L("Aucun point ouvert relevé. La validation de l'avocat reste requise.", "No open point found. The lawyer's approval is still required.")}</p>`}</div></section>
        ${L2?.observations?.length ? `<section class="card"><div class="card__head"><h2>${t("ws.observations")}</h2><span class="small muted">${esc(L2.type_document || "")}${L2.langue ? `, ${esc(L2.langue)}` : ""}</span></div><div class="card__body"><ul class="blist">${L2.observations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul></div></section>` : ""}
        <p class="small" style="margin:0"><a class="btn" href="/app/dossier/${esc(d.id)}/decision">${d.validation ? t("ws.decision") : t("val.submit")}</a></p>
      </div>
    </div>`;

  body.querySelectorAll(".dim > button").forEach((b) => b.addEventListener("click", () => { const el = b.parentElement; const o = !el.classList.contains("is-open"); el.classList.toggle("is-open", o); b.setAttribute("aria-expanded", String(o)); }));
  const panes = body.querySelector(".panes");
  body.querySelectorAll("[data-mob]").forEach((b) => { if (b.tagName === "BUTTON") b.addEventListener("click", () => { panes.dataset.mob = b.dataset.mob; body.querySelectorAll("button[data-mob]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); }); });
  if (!doc) return;
  const docEl = body.querySelector("#doc");
  const fb = body.querySelector("#fb");
  const dimOf = (topic) => dims.find((x) => x.items.some((c) => c.topic === topic));
  const focus = (topic, { scroll = true, mobile = true } = {}) => {
    const id = doc.anchors.get(topic); const mark = id && body.querySelector(`#${id}`);
    if (!mark) return;
    if (mobile) { panes.dataset.mob = "doc"; body.querySelectorAll("button[data-mob]").forEach((x) => x.setAttribute("aria-selected", String(x.dataset.mob === "doc"))); }
    body.querySelectorAll(".cite.is-focus").forEach((x) => x.classList.remove("is-focus"));
    body.querySelectorAll(`.cite[data-key="${mark.dataset.key}"]`).forEach((x) => { x.classList.add("is-focus"); x.classList.remove("flash"); void x.offsetWidth; x.classList.add("flash"); });
    const c = cs.find((x) => x.topic === topic), dm = dimOf(topic), i = order.indexOf(topic);
    fb.innerHTML = `<div class="focusbar__main"><div class="focusbar__ref">${ref(topic)}</div><div class="focusbar__obs"><span>${esc(dm ? t(`dim.${dm.id}`) : c.sujet)}</span>${clausePill(statusKey(c))}</div></div>
      <div class="focusbar__nav"><span class="small muted">${t("ws.passage")} ${i + 1} ${t("ws.of")} ${order.length}</span><button type="button" class="iconbtn" data-step="-1" aria-label="${L("Passage précédent", "Previous passage")}">${ICON.up}</button><button type="button" class="iconbtn" data-step="1" aria-label="${L("Passage suivant", "Next passage")}">${ICON.down}</button></div>`;
    fb.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => focus(order[(i + Number(b.dataset.step) + order.length) % order.length], { mobile: false })));
    if (!scroll) return;
    if (getComputedStyle(body.querySelector(".pane--doc")).position === "sticky") scrollWithin(docEl, mark); else { mark.scrollIntoView({ block: "center" }); }
  };
  body.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => focus(b.dataset.go)));
  // Clic sur un passage surligné : ouvre le domaine correspondant.
  docEl.addEventListener("click", (e) => {
    const mk = e.target.closest(".cite"); if (!mk) return;
    focus(mk.dataset.key, { scroll: false, mobile: false });
    const dm = [...body.querySelectorAll(".dim")].find((x) => x.querySelector(`[data-go="${mk.dataset.key}"]`));
    if (dm) { dm.classList.add("is-open"); dm.querySelector("button").setAttribute("aria-expanded", "true"); dm.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  });
  const sel = body.querySelector("#ds");
  if (sel) sel.addEventListener("change", () => { const el = body.querySelector(`#ln-${sel.value}`); if (el) scrollWithin(docEl, el, 10); });
  // Recherche dans le document : lignes trouvées, navigation précédent et suivant.
  let hits = [], hi = -1;
  const q = body.querySelector("#dq"), hEl = body.querySelector("#dh");
  const show = () => { body.querySelectorAll(".ln.is-cur").forEach((x) => x.classList.remove("is-cur")); if (hi >= 0 && hits[hi]) { hits[hi].classList.add("is-cur"); scrollWithin(docEl, hits[hi], 60); } hEl.textContent = q.value.trim().length > 1 ? `${hits.length ? hi + 1 : 0} / ${hits.length}` : ""; };
  q.addEventListener("input", () => {
    body.querySelectorAll(".ln.is-hit").forEach((x) => x.classList.remove("is-hit"));
    const s = fold(q.value).f.trim(); hits = []; hi = -1;
    if (s.length > 1) { body.querySelectorAll(".doc .ln[data-l]").forEach((ln) => { if (fold(ln.textContent).f.includes(s)) { ln.classList.add("is-hit"); hits.push(ln); } }); if (hits.length) hi = 0; }
    show();
  });
  q.addEventListener("keydown", (e) => { if (e.key === "Enter" && hits.length) { e.preventDefault(); hi = (hi + (e.shiftKey ? -1 : 1) + hits.length) % hits.length; show(); } });
  body.querySelector("#dn").addEventListener("click", () => { if (hits.length) { hi = (hi + 1) % hits.length; show(); } });
  body.querySelector("#dp").addEventListener("click", () => { if (hits.length) { hi = (hi - 1 + hits.length) % hits.length; show(); } });
  // Premier domaine critique : son passage est mis en évidence d'emblée.
  const first = dims.find((x) => x.status === "dangereuse") || dims.find((x) => x.status === "ambiguë");
  const fc = first?.items.find((c) => doc.anchors.has(c.topic));
  if (fc) requestAnimationFrame(() => focus(fc.topic, { mobile: false }));
}

// Onglet Dossier de synthèse : le document à relire, exportable en PDF.
function paintSummary(body, d) {
  const r = d.resultat, m = r.meta, i = d.input;
  const cs = constatsOf(r);
  const crit = cs.filter((c) => c.statut === "dangereuse" || c.statut === "ambiguë");
  const unresolved = [...cs.filter((c) => c.statut === "ambiguë"), ...cs.filter((c) => c.statut === "absent" && c.pertinent)];
  const docs = i.documents?.length ? i.documents.map((x) => `${x.nom} (${x.format}${x.mots ? `, ${fmtInt(x.mots)} mots` : ""})`).join(" ; ") : i.source || `${fmtInt(i.contrat_mots || 0)} mots`;
  const statusLine = d.decision ? `<div class="status status--ok">Décision enregistrée : ${esc(t(`dec.${d.decision.decision}`))}, par ${esc(d.decision.nom)}, ${esc(d.decision.fonction)}, le ${esc(d.decision.when)}.</div>`
    : d.validation ? `<div class="status status--ok">Avis validé par ${esc(d.validation.nom)}, ${esc(d.validation.role)}, le ${esc(d.validation.when)}. Décision d'utilisation en attente.</div>`
    : `<div class="status">Avis préparé par l'IA. Document de travail nécessitant l'examen d'un avocat.</div>`;
  body.innerHTML = `
    ${getLang() === "en" ? `<p class="small muted no-print" style="max-width:860px;margin:0 auto 12px">${t("ws.contentFr")}</p>` : ""}
    <article class="paper">
      <div class="paper__brand"><span class="paper__logo" style="color:var(--navy)">${LOGO}</span><span>Dossier ${esc(d.id)} · ${esc(fmtDay(d.cree))}</span></div>
      <div class="small muted">Dossier de synthèse</div>
      <h1>${esc(m.outil)}</h1>
      <div class="muted">${esc(m.fournisseur)}</div>
      ${statusLine}

      <h2>Identification de l'outil</h2>
      <dl class="kv">
        <dt>Outil</dt><dd>${esc(m.outil)}</dd><dt>Fournisseur</dt><dd>${esc(m.fournisseur)}</dd>
        <dt>Finalité</dt><dd>${esc(CAT[m.categorie] || m.categorie)}</dd>
        ${i.departement ? `<dt>Département</dt><dd>${esc(i.departement)}</dd>` : ""}
        <dt>Usage</dt><dd>${i.usage === "externe" ? "Externe, clients ou public" : i.usage === "interne" ? "Interne" : "Non précisé"}</dd>
        <dt>Données traitées</dt><dd>${esc((m.donnees || []).map((x) => DATA[x] || x).join(", ") || "Non précisé")}</dd>
        <dt>Utilisateurs</dt><dd>${fmtInt(m.utilisateurs)}</dd><dt>Pays</dt><dd>${esc(m.pays || "Non précisé")}</dd>
        ${i.responsable ? `<dt>Responsable</dt><dd>${esc(i.responsable)}</dd>` : ""}
      </dl>

      <h2>Cas d'usage</h2>
      <p>${esc(m.cas_usage)}</p>${i.complement ? `<p class="muted">${esc(i.complement)}</p>` : ""}

      <h2>Documents examinés</h2>
      <p>${esc(docs)}</p>
      <p class="small muted">Lecture : ${esc(m.moteur)}${r.lecture?.citations?.total ? `. ${r.lecture.citations.verifiees} citations sur ${r.lecture.citations.total} retrouvées mot pour mot dans le texte` : ""}.</p>

      <h2>Proposition d'avis</h2>
      <p style="font-size:16px">${avisPill(r.verdict)} · Niveau de vigilance ${r.score} sur 100</p>
      ${r.resume.map((s) => `<p>${esc(s)}</p>`).join("")}
      ${r.points_bloquants.length ? `<p><strong>Points bloquants.</strong> ${r.points_bloquants.map(esc).join(" ")}</p>` : ""}

      <h2>Synthèse des risques</h2>
      ${r.risques.length ? r.risques.map((x) => `<div class="obs"><div class="obs__h"><span>${esc(x.titre)}</span><span class="tag">${esc(x.gravite)}</span></div><p style="margin:6px 0 4px">${esc(x.detail)}</p><div class="base">${esc(x.base)}</div></div>`).join("") : `<p class="muted">Aucun risque relevé dans le périmètre analysé.</p>`}

      <h2>Observations contractuelles</h2>
      ${crit.length ? crit.map((c) => `<div class="obs"><div class="obs__h"><span>${esc(c.sujet)}</span>${clausePill(statusKey(c))}</div>${c.note ? `<p style="margin:6px 0 0">${esc(c.note)}</p>` : ""}${c.citation ? `<blockquote>${esc(c.citation)}</blockquote>` : ""}<div class="base">${esc(c.base)}</div></div>`).join("") : `<p class="muted">Aucune clause dangereuse ou ambiguë relevée.</p>`}
      ${r.lecture?.observations?.length ? `<p style="margin-top:14px"><strong>Autres constats de lecture.</strong></p><ul>${r.lecture.observations.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}

      <h2>Conditions proposées</h2>
      ${r.conditions.length ? `<ul>${r.conditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : `<p class="muted">Aucune condition : l'outil n'est pas autorisé en l'état.</p>`}

      <h2>Points non résolus</h2>
      ${unresolved.length ? `<ul>${unresolved.map((c) => `<li>${esc(c.sujet)} : ${c.statut === "ambiguë" ? "formulation ambiguë, à préciser avec le fournisseur" : "aucune clause, à obtenir du fournisseur"}.</li>`).join("")}</ul>` : `<p class="muted">Aucun.</p>`}

      <h2>Obligations applicables</h2>
      <ul>${r.obligations.map((o) => `<li>${esc(o.texte)} <span class="muted small">(${esc(o.source)})</span></li>`).join("")}</ul>

      <h2>Mesures recommandées</h2>
      <ol>${r.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>

      ${amendmentClauses(r).length ? `<h2>Avenant type</h2>
      <p class="small muted no-print">Document de travail généré à partir des clauses correctives. À relire et à négocier par un avocat.</p>
      <div class="no-print" style="display:flex;gap:8px;margin-bottom:10px"><button type="button" class="btn btn--secondary btn--sm" id="av-show">${t("ws.amendment")}</button><button type="button" class="btn btn--secondary btn--sm" id="av-copy">${t("common.copy")}</button><button type="button" class="btn btn--secondary btn--sm" id="av-dl">${t("common.download")} .txt</button></div>
      <pre class="amend" id="av" hidden>${esc(avenant(r))}</pre>` : ""}

      <h2>Validation et décision</h2>
      <dl class="kv">
        <dt>Avis préparé</dt><dd>Par Aucteva le ${esc(fmtDay(d.cree))}, document de travail.</dd>
        <dt>Validation juridique</dt><dd>${d.validation ? `${esc(d.validation.nom)}, ${esc(d.validation.role)}, le ${esc(d.validation.when)}. Empreinte ${esc(d.validation.hash)}.` : "En attente."}</dd>
        <dt>Décision d'utilisation</dt><dd>${d.decision ? `${esc(t(`dec.${d.decision.decision}`))}, par ${esc(d.decision.nom)}, ${esc(d.decision.fonction)}, le ${esc(d.decision.when)}. Empreinte ${esc(d.decision.hash)}.${d.decision.motif ? `<br>${esc(d.decision.motif)}` : ""}` : "En attente."}</dd>
      </dl>
      <div class="mention">${esc(r.mention || MENTION)} Les domaines examinés sont des catégories d'examen et ne constituent pas une certification de conformité. Démonstration : les identités déclarées ne sont pas vérifiées.</div>
    </article>`;
  const av = body.querySelector("#av");
  if (av) {
    body.querySelector("#av-show").addEventListener("click", () => { av.hidden = !av.hidden; });
    body.querySelector("#av-copy").addEventListener("click", () => copy(av.textContent));
    body.querySelector("#av-dl").addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([av.textContent], { type: "text/plain;charset=utf-8" })); a.download = `avenant-${slug(m.outil)}-${d.id}.txt`; document.body.appendChild(a); a.click(); a.remove(); });
  }
}

// Onglet Validation et décision : trois temps distincts, chacun tracé.
function paintDecision(body, d, refresh) {
  const r = d.resultat;
  const sig = d.validation, dec = d.decision;
  body.innerHTML = `<div class="wfcards">
    <section class="wfcard is-done"><div class="wfcard__h"><span class="k">1</span><div><h2>${t("wf.ai")}</h2><p>${t("wf.ai.d")}</p></div></div>
      <div class="wfcard__b"><div class="done-line">${avisPill(r.verdict)}<span class="muted">${t("ws.vigilance")} ${r.score} / 100 · ${esc(fmtDay(d.cree))} · ${esc(r.meta.moteur)}</span></div></div></section>

    <section class="wfcard${sig ? " is-done" : ""}"><div class="wfcard__h"><span class="k">2</span><div><h2>${t("wf.law")}</h2><p>${t("wf.law.d")}</p></div></div>
      <div class="wfcard__b">${sig ? `<div class="done-line">${ICON.check}<span>${esc(sig.nom)}, ${esc(sig.role)}, ${esc(sig.when)}</span></div><div class="sigline">${t("sig")} ${esc(sig.hash)}</div>`
        : `<form id="vf" novalidate><div class="fgrid"><div class="field"><label for="v-n">${t("val.name")}</label><input type="text" id="v-n" autocomplete="name" required></div><div class="field"><label for="v-r">${t("val.role")}</label><select id="v-r">${ROLES.map((x) => `<option>${esc(x)}</option>`).join("")}</select></div></div>
          <p class="small muted" style="margin:12px 0">${t("val.note")}</p><button type="submit" class="btn">${t("val.submit")}</button></form>`}</div></section>

    <section class="wfcard${dec ? " is-done" : !sig ? " is-locked" : ""}"><div class="wfcard__h"><span class="k">3</span><div><h2>${t("wf.co")}</h2><p>${t("wf.co.d")}</p></div></div>
      <div class="wfcard__b">${dec ? `<div class="done-line">${decisionPill(dec)}<span class="muted">${esc(dec.nom)}, ${esc(dec.fonction)}, ${esc(dec.when)}</span></div>${dec.motif ? `<p style="margin:10px 0 0">${esc(dec.motif)}</p>` : ""}<div class="sigline">${t("sig")} ${esc(dec.hash)}</div>`
        : !sig ? `<p class="muted" style="margin:0;display:flex;gap:8px;align-items:center">${ICON.lock}${t("wf.locked")}</p>`
        : `<form id="df" novalidate><div class="fgrid">
            <div class="field"><label for="d-n">${t("dc.name")}</label><input type="text" id="d-n" autocomplete="name" required></div>
            <div class="field"><label for="d-f">${t("dc.function")}</label><input type="text" id="d-f" placeholder="${esc(L("Directrice juridique, DPO, RSSI", "General counsel, DPO, CISO"))}" required></div>
            <div class="field field--full"><span class="label" id="lb-d">${t("dc.decision")}</span><div class="seg" role="radiogroup" aria-labelledby="lb-d">${["autorise", "autorise_conditions", "refuse"].map((k) => `<label><input type="radio" name="dd" value="${k}"${(r.verdict === "VERT" && k === "autorise") || (r.verdict === "ORANGE" && k === "autorise_conditions") || (r.verdict === "ROUGE" && k === "refuse") ? " checked" : ""}><span>${t(`dec.${k}`)}</span></label>`).join("")}</div></div>
            <div class="field field--full"><label for="d-m">${t("dc.reason")} <span class="opt">(${t("f.optional")})</span></label><textarea id="d-m" rows="3">${esc(r.conditions.length ? r.conditions.slice(0, 3).join(" ") : "")}</textarea></div>
          </div><p class="small muted" style="margin:12px 0">${t("val.note")}</p><button type="submit" class="btn">${t("dc.submit")}</button></form>`}</div></section>
  </div>`;
  const vf = body.querySelector("#vf");
  if (vf) vf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom = body.querySelector("#v-n").value.trim(), role = body.querySelector("#v-r").value;
    if (!nom) { body.querySelector("#v-n").closest(".field").classList.add("is-invalid"); body.querySelector("#v-n").focus(); return; }
    const b = vf.querySelector("button[type=submit]"); b.disabled = true;
    try {
      if (d.local) { const now = new Date(); d.validation = { nom, role, iso: now.toISOString(), when: now.toLocaleString(), hash: Math.random().toString(16).slice(2, 14).toUpperCase() }; session.set(`aucteva.local.${d.id}`, d); }
      else cur.d = (await api(`/examens/${d.id}/validation`, { nom, role })).dossier;
      invalidate(); toast(L("Avis validé", "Opinion approved")); refresh();
    } catch (x) { toast(x.message, "err"); b.disabled = false; }
  });
  const df = body.querySelector("#df");
  if (df) df.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nom = body.querySelector("#d-n").value.trim(), fonction = body.querySelector("#d-f").value.trim(), decision = df.querySelector("input[name=dd]:checked")?.value, motif = body.querySelector("#d-m").value.trim();
    let bad = false;
    for (const [el, ok] of [[body.querySelector("#d-n"), !!nom], [body.querySelector("#d-f"), !!fonction]]) { el.closest(".field").classList.toggle("is-invalid", !ok); if (!ok && !bad) { el.focus(); bad = true; } }
    if (bad || !decision) return;
    const b = df.querySelector("button[type=submit]"); b.disabled = true;
    try {
      if (d.local) { const now = new Date(); d.decision = { nom, fonction, decision, motif, iso: now.toISOString(), when: now.toLocaleString(), hash: Math.random().toString(16).slice(2, 14).toUpperCase() }; session.set(`aucteva.local.${d.id}`, d); }
      else cur.d = (await api(`/examens/${d.id}/decision`, { nom, fonction, decision, motif })).dossier;
      invalidate(); toast(L("Décision enregistrée au registre", "Decision recorded in the registry")); refresh();
    } catch (x) { toast(x.message, "err"); b.disabled = false; }
  });
}

export const resetDossier = () => { cur = { id: null, d: null, texte: null }; };
