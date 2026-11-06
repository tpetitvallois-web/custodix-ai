// Site public d'Aucteva : accueil, démonstration, pages légales, page introuvable.
import { t, getLang, setLang } from "./i18n.js";
import { api, esc, fmtInt, fmtDay, ICON, LOGO, avisPill, decisionPill, dimensionsOf, statusKey, CLAUSE, clausePill, slug, countWords, toast, go, rerender } from "./ui.js";
import { analyse } from "./engine.js";
import { SCENARIOS } from "./scenarios.js";
import { fold, locate, renderDoc, scrollWithin } from "./doc.js";
import { askBar, startConversation, EXAMPLES } from "./ask.js";

const DIM_IDS = ["training", "retention", "transfer", "subprocessors", "security", "liability", "oversight", "transparency"];

export function siteLayout(root, inner, active = "") {
  root.innerHTML = `
    <a class="skip" href="#contenu">${getLang() === "en" ? "Skip to content" : "Aller au contenu"}</a>
    <header class="sitebar" id="sitebar">
      <div class="wrap sitebar__in">
        <a class="home" href="/" aria-label="Aucteva, accueil">${LOGO}</a>
        <nav class="sitenav" aria-label="${getLang() === "en" ? "Main" : "Principale"}">
          ${PAGES.map(([k, l]) => `<a href="/${k}"${k === active ? ' aria-current="page"' : ""}>${t(l)}</a>`).join("")}
        </nav>
        <div class="sitebar__actions">
          <button type="button" class="langbtn" data-lang aria-label="${t("lang.switch")}">${t("lang.code")}</button>
          <a class="btn btn--light btn--sm" href="/demo">${t("nav.demo")}</a>
          <button type="button" class="sitebar__menu" aria-expanded="false" aria-controls="sitebar" aria-label="Menu">${ICON.menu}</button>
        </div>
      </div>
    </header>
    <main id="contenu" class="site">${inner}</main>
    <footer class="sitefoot">
      <div class="wrap sitefoot__in">
        <div>${LOGO}<p style="max-width:520px;margin:0">${t("footer.line")}</p></div>
        <nav aria-label="Footer"><a href="/app">${t("nav.app")}</a><a href="/app/connecteur">${t("footer.connector")}</a><a href="/conditions">${t("footer.terms")}</a><a href="/confidentialite">${t("footer.privacy")}</a></nav>
      </div>
    </footer>`;
  root.querySelector("[data-lang]").addEventListener("click", () => { setLang(getLang() === "en" ? "fr" : "en"); rerender(); });
  const bar = root.querySelector("#sitebar"), menu = root.querySelector(".sitebar__menu");
  menu.addEventListener("click", () => { const open = !bar.classList.contains("is-open"); bar.classList.toggle("is-open", open); menu.setAttribute("aria-expanded", String(open)); });
  bar.querySelectorAll(".sitenav a").forEach((a) => a.addEventListener("click", () => bar.classList.remove("is-open")));
}

// Aperçu de l'interface réelle : un scénario analysé en direct par le moteur, le contrat à gauche, les huit domaines à droite.
function mountMock(el, scnId, { flat = false } = {}) {
  const s = SCENARIOS.find((x) => x.id === scnId);
  const r = analyse(s, { moteur: "règles v1" });
  const dims = dimensionsOf(r);
  const F = fold(s.contract);
  const ranges = [];
  for (const c of r.constats) { const loc = c.citation && locate(F, c.citation); if (loc) ranges.push({ start: loc[0], end: loc[1], cls: `cite--${CLAUSE[statusKey(c)]}`, key: c.topic }); }
  const doc = renderDoc(s.contract, ranges, { numbers: false });
  const first = dims.find((d) => d.status === "dangereuse") || dims.find((d) => d.status === "ambiguë") || dims[0];
  el.innerHTML = `
    <div class="mock${flat ? " mock--flat" : ""}">
      <div class="mock__bar">
        <div class="mock__title"><strong>${esc(s.tool)}</strong><span class="muted small">${esc(s.vendor)}</span></div>
        <div style="display:flex;gap:8px;align-items:center">${avisPill(r.verdict)}<span class="pill pill--neutral">${t("st.prepared")}</span></div>
      </div>
      <div class="mock__body">
        <div class="mock__doc" tabindex="0" aria-label="${t("pv.doc")}">${doc.html}</div>
        <div class="mock__an">
          <div class="mock__score"><div><div class="small muted">${t("ws.vigilance")}</div><div class="val">${r.score}<span class="small muted"> / 100</span></div></div><div class="small muted" style="text-align:right">${t("ws.prepared")}</div></div>
          ${dims.map((d, i) => `<button type="button" class="dimrow" data-dim="${d.id}" aria-pressed="${d.id === first.id}"><span class="n">${i + 1}</span><span class="lbl">${esc(t(`dim.${d.id}`))}</span>${clausePill(d.status)}</button>`).join("")}
          <p class="small muted" id="mock-note" style="margin:10px 6px 0;min-height:20px"></p>
        </div>
      </div>
    </div>`;
  const docEl = el.querySelector(".mock__doc");
  const show = (id) => {
    el.querySelectorAll(".dimrow").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dim === id)));
    el.querySelectorAll(".cite.is-focus").forEach((m) => m.classList.remove("is-focus"));
    const d = dims.find((x) => x.id === id);
    const cited = d.items.find((c) => doc.anchors.has(c.topic));
    const note = el.querySelector("#mock-note");
    if (cited) {
      const m = el.querySelector(`#${doc.anchors.get(cited.topic)}`);
      if (m) { m.classList.add("is-focus"); scrollWithin(docEl, m, 40); }
      note.textContent = cited.sujet;
    } else note.textContent = t("pv.nocite");
  };
  el.querySelectorAll(".dimrow").forEach((b) => b.addEventListener("click", () => show(b.dataset.dim)));
  requestAnimationFrame(() => show(first.id));
}

// Blocs partagés par l'accueil et les sous-pages.
const en = () => getLang() === "en";
const SC_LABEL = () => ({ marketing: en() ? "Marketing content" : "Contenus marketing", support: en() ? "Customer support" : "Support client", recruiter: en() ? "Candidate screening" : "Présélection de candidats" });
const PAGES = [["produit", "nav.product", "more.product"], ["fonctionnement", "nav.how", "more.how"], ["cas-usage", "nav.cases", "more.cases"], ["securite", "nav.security", "more.security"]];

const pageHero = (kicker, title, lead) => `
  <section class="phero"><div class="wrap"><div class="hero__line" aria-hidden="true"></div><div class="kicker">${kicker}</div><h1>${title}</h1><p class="phero__lead">${lead}</p></div></section>`;

const secProblem = () => `
  <section class="sec"><div class="wrap">
    <div class="kicker">${t("pb.kicker")}</div><h2>${t("pb.title")}</h2><p class="sec__lead">${t("pb.body")}</p>
    <div class="cols3">${["a", "b", "c"].map((k) => `<div><h3>${t(`pb.${k}.t`)}</h3><p>${t(`pb.${k}.d`)}</p></div>`).join("")}</div>
  </div></section>`;

const secHow = () => `
  <section class="sec sec--tint"><div class="wrap">
    <div class="kicker">${t("how.kicker")}</div><h2>${t("how.title")}</h2>
    <div class="steps4">${[1, 2, 3, 4].map((i) => `<div><span class="n">${i}</span><h3>${t(`how.${i}.t`)}</h3><p>${t(`how.${i}.d`)}</p></div>`).join("")}</div>
  </div></section>`;

const secWays = (tint = false) => `
  <section class="sec${tint ? " sec--tint" : ""}"><div class="wrap">
    <div class="kicker">${t("ways.kicker")}</div><h2>${t("ways.title")}</h2>
    <div class="ways">
      <a class="way way--main" href="/app/nouveau"><span class="way__tag">${t("way.reco")}</span><span class="way__ic">${ICON.chat}</span><h3>${t("way.chat.t")}</h3><p>${t("way.chat.d")}</p><span class="way__go">${t("way.chat.cta")}${ICON.arrow}</span></a>
      <a class="way" href="/app/connecteur"><span class="way__ic">${ICON.plug}</span><h3>${t("way.mcp.t")}</h3><p>${t("way.mcp.d")}</p><span class="way__go">${t("way.mcp.cta")}${ICON.arrow}</span></a>
      <a class="way" href="/app/nouveau/formulaire"><span class="way__ic">${ICON.files}</span><h3>${t("way.form.t")}</h3><p>${t("way.form.d")}</p><span class="way__go">${t("way.form.cta")}${ICON.arrow}</span></a>
    </div>
  </div></section>`;

const secPreview = (tabs = true) => `
  <section class="sec"><div class="wrap">
    <div class="kicker">${t("pv.kicker")}</div><h2>${t("pv.title")}</h2><p class="sec__lead">${t("pv.body")}</p>
    ${tabs ? `<div class="tabs" role="tablist" style="margin:32px 0 16px">${SCENARIOS.map((s, i) => `<button type="button" role="tab" aria-selected="${i === 1}" data-scn="${s.id}">${esc(SC_LABEL()[s.id])} · ${esc(s.tool)}</button>`).join("")}</div>` : `<div style="height:32px"></div>`}
    <div id="pv-mock"></div>
    <p style="margin-top:16px"><a class="btn btn--secondary" href="/demo">${t("pv.open")}</a></p>
  </div></section>`;

const bindPreview = (root) => {
  const pv = root.querySelector("#pv-mock"); if (!pv) return;
  mountMock(pv, "support", { flat: true });
  root.querySelectorAll("[data-scn]").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("[data-scn]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    mountMock(pv, b.dataset.scn, { flat: true });
  }));
};

const secDims = () => `
  <section class="sec sec--tint"><div class="wrap">
    <div class="kicker">${t("dim.kicker")}</div><h2>${t("dim.title")}</h2>
    <div class="dims8">${DIM_IDS.map((d, i) => `<div><span class="n">${i + 1}</span><h3>${t(`dim.${d}`)}</h3><p>${t(`dim.${d}.d`)}</p></div>`).join("")}</div>
    <p class="note">${t("dim.note")}</p>
  </div></section>`;

const secRoles = () => `
  <section class="sec sec--navy"><div class="wrap">
    <div class="kicker">${t("roles.kicker")}</div><h2>${t("roles.title")}</h2>
    <div class="roles3">
      <div><div class="who">IA</div><h3>${t("roles.ai.t")}</h3><p>${t("roles.ai.d")}</p></div>
      <div><div class="who">${en() ? "Lawyer" : "Avocat"}</div><h3>${t("roles.law.t")}</h3><p>${t("roles.law.d")}</p></div>
      <div><div class="who">${en() ? "Company" : "Entreprise"}</div><h3>${t("roles.co.t")}</h3><p>${t("roles.co.d")}</p></div>
    </div>
  </div></section>`;

const secRegistry = () => `
  <section class="sec"><div class="wrap split">
    <div><div class="kicker">${t("reg.kicker")}</div><h2>${t("reg.title")}</h2><p class="sec__lead">${t("reg.body")}</p><p style="margin-top:24px"><a class="btn btn--secondary" href="/app/registre">${t("reg.open")}</a></p></div>
    <div><div id="reg-mini"><span class="sk" style="height:180px"></span></div><p class="note">${t("reg.live")}</p></div>
  </div></section>`;

const bindRegistry = (root) => {
  const el = root.querySelector("#reg-mini"); if (!el) return;
  api("/registre").then(({ dossiers }) => {
    const rows = dossiers.filter((x) => x.statut === "termine").slice(0, 6);
    el.innerHTML = `<table class="regmini"><thead><tr><th>${t("tbl.tool")}</th><th>${t("tbl.avis")}</th><th>${t("tbl.legal")}</th><th>${t("tbl.decision")}</th></tr></thead>
      <tbody>${rows.map((x) => `<tr><td><strong style="font-weight:500">${esc(x.outil)}</strong><div class="small muted">${esc(x.fournisseur)}</div></td><td>${avisPill(x.verdict)}</td><td class="small">${x.validation ? esc(x.validation.role) : `<span class="muted">${t("wf.pending")}</span>`}</td><td class="small">${decisionPill(x.decision)}</td></tr>`).join("")}</tbody></table>`;
  }).catch(() => { el.innerHTML = `<p class="err">${t("tbl.error")}</p>`; });
};

const secLimits = (tint = true, items = [1, 2, 3, 4, 5]) => `
  <section class="sec${tint ? " sec--tint" : ""}"><div class="wrap">
    <div class="kicker">${t("sec.kicker")}</div><h2>${t("sec.title")}</h2>
    <div class="sec5">${items.map((i) => `<div><h3>${i === 5 ? `${ICON.lock}` : ""}${t(`sec.${i}.t`)}</h3><p>${t(`sec.${i}.d`)}</p></div>`).join("")}</div>
  </div></section>`;

const secCta = () => `
  <section class="sec sec--navy"><div class="wrap">
    <div class="kicker">${t("cta.kicker")}</div><h2>${t("cta.title")}</h2><p class="sec__lead">${t("cta.body")}</p>
    <div class="cta-band"><a class="btn btn--light btn--lg" href="/app/nouveau">${t("way.chat.cta")}</a><a class="btn btn--outline-light btn--lg" href="/demo">${t("cta.demo")}</a><a class="btn btn--outline-light btn--lg" href="/app/connecteur">${t("cta.mcp")}</a></div>
  </div></section>`;

const secMore = (current) => `
  <section class="sec"><div class="wrap">
    <div class="kicker">${t("more.kicker")}</div>
    <div class="more">${PAGES.filter(([k]) => k !== current).map(([k, title, d]) => `<a href="/${k}"><strong>${t(title)}</strong><span>${t(d)}</span><span class="more__go">${ICON.arrow}</span></a>`).join("")}</div>
  </div></section>`;

function done(root) { bindPreview(root); bindRegistry(root); window.scrollTo(0, 0); }

// Accueil : la barre de l'assistant d'abord, puis l'écran d'analyse réel.
export function renderLanding(root) {
  document.title = en() ? "Aucteva, legal governance for AI tools" : "Aucteva, gouvernance juridique des outils d'IA";
  siteLayout(root, `
    <section class="hero hero--ask">
      <div class="wrap">
        <div class="hero__copy">
          <div class="hero__line" aria-hidden="true"></div>
          <h1>${t("hero.title")}</h1>
          <p class="hero__sub">${t("hero.sub")}</p>
        </div>
        <div class="hero__ask" id="hero-ask"></div>
        <div class="hero__shot" id="hero-mock"></div>
        <p class="hero__caption">${t("hero.caption")}</p>
      </div>
    </section>
    ${secWays()}
    ${secRoles()}
    ${secMore(null)}
    ${secRegistry()}
    ${secCta()}`);
  askBar(root.querySelector("#hero-ask"), { tone: "dark", chips: 6 });
  mountMock(root.querySelector("#hero-mock"), "support");
  done(root);
}

export function renderProduct(root) {
  document.title = `${t("nav.product")}, Aucteva`;
  siteLayout(root, `${pageHero(t("nav.product"), t("product.title"), t("product.lead"))}${secProblem()}${secDims()}${secRoles()}${secRegistry()}${secMore("produit")}${secCta()}`, "produit");
  done(root);
}

export function renderHow(root) {
  document.title = `${t("nav.how")}, Aucteva`;
  siteLayout(root, `${pageHero(t("nav.how"), t("howp.title"), t("howp.lead"))}${secWays()}${secHow()}${secPreview(false)}${secRoles()}${secMore("fonctionnement")}${secCta()}`, "fonctionnement");
  done(root);
}

export function renderCases(root) {
  document.title = `${t("nav.cases")}, Aucteva`;
  const DEPT = { marketing: t("cases.dept.marketing"), support: t("cases.dept.support"), recruiter: t("cases.dept.recruiter") };
  const cards = SCENARIOS.map((s) => {
    const r = analyse(s);
    const dims = dimensionsOf(r).filter((d) => d.status === "dangereuse" || d.status === "ambiguë");
    return `<article class="case">
      <div class="case__head"><span class="tag">${esc(DEPT[s.id])}</span>${avisPill(r.verdict)}</div>
      <h3>${esc(s.tool)} <span class="muted small">${esc(s.vendor)}</span></h3>
      <p class="case__uc">${esc(s.useCase)}</p>
      <div class="case__flags"><div class="small muted">${t("cases.flags")}</div>${dims.length ? dims.map((d) => `<div class="case__flag">${clausePill(d.status)}<span>${esc(t(`dim.${d.id}`))}</span></div>`).join("") : `<p class="small">${t("cases.none")}</p>`}</div>
      <div class="case__actions"><button type="button" class="btn" data-run="${s.id}" data-mode="regles">${t("cases.run")}</button><button type="button" class="btn btn--secondary" data-ask="${s.id}">${t("way.chat.cta")}</button></div>
    </article>`;
  }).join("");
  siteLayout(root, `${pageHero(t("nav.cases"), t("cases.title"), t("cases.lead"))}
    <section class="sec"><div class="wrap"><div class="cases">${cards}</div><p class="disclaimer" style="margin-top:20px">${t("demo.disclaimer")}</p></div></section>
    ${secPreview(true).replace('class="sec"', 'class="sec sec--tint"')}
    <section class="sec"><div class="wrap">
      <div class="kicker">${t("cases.real.kicker")}</div><h2>${t("cases.real.title")}</h2><p class="sec__lead">${t("cases.real.body")}</p>
      <div id="real" style="margin-top:28px"><span class="sk" style="height:120px"></span></div>
    </div></section>
    ${secMore("cas-usage")}${secCta()}`, "cas-usage");
  root.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => runScenario(b.dataset.run, b.dataset.mode, b)));
  root.querySelectorAll("[data-ask]").forEach((b) => b.addEventListener("click", async () => {
    const ex = EXAMPLES.find((x) => x.scn === b.dataset.ask), s = SCENARIOS.find((x) => x.id === b.dataset.ask);
    b.disabled = true;
    try { await startConversation(ex[en() ? "en" : "fr"], [{ nom: `contrat-${slug(s.tool)}.md`, texte: s.contract }]); }
    catch (e) { toast(e.message, "err"); b.disabled = false; }
  }));
  realContracts(root.querySelector("#real"));
  done(root);
}

export function renderSecurity(root) {
  document.title = `${t("nav.security")}, Aucteva`;
  siteLayout(root, `${pageHero(t("nav.security"), t("secp.title"), t("secp.lead"))}
    <section class="sec"><div class="wrap">
      <div class="kicker">${t("secp.ai.kicker")}</div><h2>${t("secp.ai.title")}</h2>
      <div class="sec5">${[1, 2, 3, 4].map((i) => `<div><h3>${t(`secp.ai.${i}.t`)}</h3><p>${t(`secp.ai.${i}.d`)}</p></div>`).join("")}</div>
    </div></section>
    ${secLimits(true, [3, 4, 5])}
    <section class="sec"><div class="wrap split">
      <div><div class="kicker">${t("secp.data.kicker")}</div><h2>${t("secp.data.title")}</h2><p style="margin-top:24px"><a class="btn btn--secondary" href="/confidentialite">${t("secp.data.link")}</a></p></div>
      <ul class="facts">${[1, 2, 3, 4].map((i) => `<li>${t(`secp.data.${i}`)}</li>`).join("")}</ul>
    </div></section>
    ${secMore("securite")}${secCta()}`, "securite");
  done(root);
}

function realContracts(el) {
  const tools = new Set(SCENARIOS.map((s) => s.tool));
  api("/registre").then(({ dossiers }) => {
    const seen = new Set();
    const rows = dossiers.filter((x) => x.statut === "termine" && x.mode === "claude" && !tools.has(x.outil) && x.mots > 800 && !/test/i.test(x.outil)).filter((x) => { const k = `${x.outil}|${x.fournisseur}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    el.innerHTML = rows.length ? `<div class="card tablewrap"><table class="table"><thead><tr><th>${t("tbl.tool")}</th><th>${t("tbl.vendor")}</th><th>${t("tbl.docs")}</th><th>${t("tbl.avis")}</th><th>${t("tbl.level")}</th><th></th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td><a class="t-tool" href="/app/dossier/${esc(x.id)}">${esc(x.outil)}</a></td><td>${esc(x.fournisseur)}</td><td class="muted">${fmtInt(x.mots)} ${t("d.words")}</td><td>${avisPill(x.verdict)}</td><td class="num">${x.score}</td><td><a href="/app/dossier/${esc(x.id)}">${t("tbl.open")}</a></td></tr>`).join("")}
    </tbody></table></div>` : `<p class="muted">${t("tbl.empty")}</p>`;
  }).catch(() => { el.innerHTML = `<p class="err">${t("tbl.error")}</p>`; });
}

// Démonstration : chaque scénario ouvre un vrai dossier au registre.
export async function runScenario(id, mode, btn) {
  const s = SCENARIOS.find((x) => x.id === id);
  const nom = `contrat-${slug(s.tool)}.md`;
  const payload = {
    tool: s.tool, vendor: s.vendor, category: s.category, useCase: s.useCase, dataTypes: [...s.dataTypes], countries: s.countries, users: s.users,
    contract: s.contract, source: `Scénario de démonstration ${s.tool}`, responsable: "Démonstration", departement: { marketing: "Marketing", support: "Service client", recruiter: "Ressources humaines" }[s.id], usage: s.id === "support" ? "externe" : "interne",
    documents: [{ nom, format: "MD", taille: new Blob([s.contract]).size, mots: countWords(s.contract) }], mode,
  };
  if (btn) btn.disabled = true;
  try { const { dossier } = await api("/examens", payload); go(`/app/en-cours/${dossier.id}`); }
  catch (e) { toast(e.message, "err"); if (btn) btn.disabled = false; }
}

export function renderDemo(root) {
  document.title = `${t("demo.title")}, Aucteva`;
  const en = getLang() === "en";
  siteLayout(root, `
    <div class="wrap page">
      <div class="page__head">
        <h1>${t("demo.title")}</h1>
        <p>${t("demo.sub")}</p>
        <div class="flow">${[1, 2, 3, 4].map((i) => `<span>${t(`demo.flow.${i}`)}</span>`).join(ICON.arrow)}</div>
      </div>
      <div class="scn">
        ${SCENARIOS.map((s) => {
          const r = analyse(s);
          return `<article class="scn__card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>${esc(s.tool)}</h2><span class="tag">${en ? "Scenario" : "Scénario"}</span></div>
            <p class="uc">${esc(s.useCase)}</p>
            <dl class="scn__meta">
              <div><dt>${t("tbl.vendor")}</dt><dd>${esc(s.vendor)}</dd></div>
              <div><dt>${t("f.users")}</dt><dd>${fmtInt(s.users)}</dd></div>
              <div><dt>${t("demo.docs")}</dt><dd>contrat-${esc(slug(s.tool))}.md, ${fmtInt(countWords(s.contract))} ${t("d.words")}</dd></div>
              <div><dt>${t("demo.expected")}</dt><dd>${avisPill(r.verdict)}</dd></div>
            </dl>
            <div class="scn__actions">
              <button type="button" class="btn" data-run="${s.id}" data-mode="regles">${t("demo.run")}</button>
              <button type="button" class="btn btn--secondary" data-run="${s.id}" data-mode="claude" title="${esc(t("demo.runfull.hint"))}">${t("demo.runfull")}</button>
            </div>
          </article>`;
        }).join("")}
      </div>
      <p class="disclaimer">${t("demo.disclaimer")} ${t("demo.runfull.hint")}</p>

      <h2 class="h-sub">${t("demo.real.title")}</h2>
      <p class="muted" style="margin:0">${t("demo.real.sub")}</p>
      <div id="real" style="margin-top:16px"><span class="sk" style="height:120px"></span></div>

      <h2 class="h-sub">${t("demo.other.title")}</h2>
      <div class="list-links">
        <a href="/app/nouveau"><strong>${t("demo.other.chat")}</strong><span>${t("demo.other.chat.d")}</span></a>
        <a href="/app/nouveau/formulaire"><strong>${t("demo.other.form")}</strong><span>${t("demo.other.form.d")}</span></a>
        <a href="/app/connecteur"><strong>${t("demo.other.mcp")}</strong><span>${t("demo.other.mcp.d")}</span></a>
      </div>
    </div>`);
  root.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => runScenario(b.dataset.run, b.dataset.mode, b)));
  realContracts(root.querySelector("#real"));
  window.scrollTo(0, 0);
}

const LEGAL = {
  conditions: {
    titre: "Conditions d'utilisation",
    corps: `
      <p>Aucteva est une démonstration réalisée pour le concours Make AI Happen 2026. Le service est gratuit, sans compte et sans engagement.</p>
      <h2>Ce que fait le service</h2>
      <p>Aucteva lit le contrat ou les conditions d'utilisation d'un outil d'intelligence artificielle, relève les clauses sur huit domaines de vigilance et prépare un projet d'avis d'autorisation. Chaque citation est vérifiée mot pour mot dans le texte déposé. Le niveau de vigilance, les points bloquants et l'avis sont calculés par des règles fixes.</p>
      <h2>Ce que le service ne fait pas</h2>
      <p>L'avis préparé n'est pas une consultation juridique. Il ne vaut avis qu'une fois validé par un avocat. La lecture automatique peut omettre ou mal qualifier une clause. Vérifiez toujours le contrat avant de décider. Les domaines examinés ne constituent pas une certification de conformité.</p>
      <h2>Ce que vous déposez</h2>
      <p>Les dossiers sont visibles dans le registre public de la démonstration. Ne déposez ni document confidentiel, ni donnée personnelle, ni contrat couvert par un accord de confidentialité. Utilisez des conditions publiées en ligne ou des documents anonymisés.</p>
      <p>Vous restez responsable des documents que vous transmettez et devez avoir le droit de les partager.</p>
      <h2>Validation et décision</h2>
      <p>Dans la démonstration, l'identité déclarée lors d'une validation ou d'une décision n'est pas vérifiée. Ces enregistrements illustrent le fonctionnement du registre et n'engagent personne.</p>
      <h2>Usage raisonnable</h2>
      <p>Le nombre de lectures est limité par adresse et par jour. Toute tentative de saturer le service ou de détourner l'assistant de sa mission peut entraîner le blocage de l'accès.</p>
      <h2>Disponibilité</h2>
      <p>Le service est fourni en l'état, sans garantie de disponibilité. Il peut être modifié ou arrêté à tout moment.</p>`,
  },
  confidentialite: {
    titre: "Données personnelles",
    corps: `
      <p>Aucteva traite le moins de données possible. Le site ne dépose aucun cookie, n'utilise aucun traceur publicitaire et ne charge aucune police ni aucun script chez un tiers, hormis les bibliothèques de lecture des PDF et des fichiers Word, chargées depuis cdnjs (Cloudflare) au moment où vous déposez un fichier. La langue choisie est gardée dans votre navigateur.</p>
      <h2>Données traitées</h2>
      <ul>
        <li>Le contenu des dossiers : outil, fournisseur, cas d'usage, département, types de données, pays, nombre d'utilisateurs, responsable, documents et texte du contrat.</li>
        <li>Les messages et pièces jointes des conversations avec l'assistant.</li>
        <li>Le nom, la qualité ou la fonction saisis lors d'une validation ou d'une décision.</li>
        <li>L'adresse IP, utilisée uniquement pour limiter le nombre de lectures, jamais conservée en clair : seule une empreinte chiffrée, qui change chaque jour, est gardée le temps du décompte.</li>
      </ul>
      <h2>Finalité et base légale</h2>
      <p>Ces données servent à préparer l'avis demandé et à tenir le registre de la démonstration. La base légale est l'intérêt légitime à faire fonctionner le service que vous utilisez. Aucune donnée n'est vendue ni utilisée à des fins publicitaires.</p>
      <h2>Destinataires et hébergement</h2>
      <p>Le site et le registre sont hébergés par Cloudflare. La lecture des contrats est confiée au modèle de langage d'un fournisseur tiers. Le texte lui est transmis depuis un ordinateur de l'équipe Aucteva ou, en secours, depuis l'infrastructure de GitHub. Ne transmettez donc aucune donnée personnelle dans les contrats ou les messages. Ces prestataires peuvent traiter des données hors de l'Union européenne, dans le cadre des clauses contractuelles types de la Commission européenne.</p>
      <h2>Durée de conservation</h2>
      <p>Les dossiers et conversations sont conservés pendant la durée du concours Make AI Happen 2026, puis supprimés.</p>
      <h2>Vos droits</h2>
      <p>Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition et de limitation. Pour l'exercer ou faire retirer un dossier, contactez l'équipe Aucteva sur la plateforme du concours Make AI Happen. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>`,
  },
};

export function renderLegal(root, key) {
  const p = LEGAL[key];
  document.title = `${p.titre}, Aucteva`;
  siteLayout(root, `<div class="wrap page"><article class="legal"><div class="page__head"><h1>${p.titre}</h1>${getLang() === "en" ? `<p>This page is available in French only.</p>` : ""}</div>${p.corps}<p style="margin-top:32px"><a class="btn btn--secondary" href="/">${t("nf.home")}</a></p></article></div>`);
  window.scrollTo(0, 0);
}

export function renderNotFound(root) {
  document.title = `${t("nf.title")}, Aucteva`;
  siteLayout(root, `<div class="wrap page"><div class="page__head"><h1>${t("nf.title")}</h1><p>${t("nf.body")}</p></div><p><a class="btn" href="/">${t("nf.home")}</a> <a class="btn btn--secondary" href="/app/registre">${t("app.registry")}</a></p></div>`);
}
