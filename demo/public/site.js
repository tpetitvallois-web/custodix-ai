// Site public d'Aucteva : accueil, démonstration, pages légales, page introuvable.
import { t, getLang, setLang } from "./i18n.js";
import { api, esc, fmtInt, fmtDay, ICON, LOGO, avisPill, decisionPill, dimensionsOf, statusKey, CLAUSE, clausePill, slug, countWords, toast } from "./ui.js";
import { analyse } from "./engine.js";
import { SCENARIOS } from "./scenarios.js";
import { fold, locate, renderDoc, scrollWithin } from "./doc.js";

const DIM_IDS = ["training", "retention", "transfer", "subprocessors", "security", "liability", "oversight", "transparency"];

export function siteLayout(root, inner) {
  root.innerHTML = `
    <a class="skip" href="#contenu">${getLang() === "en" ? "Skip to content" : "Aller au contenu"}</a>
    <header class="sitebar" id="sitebar">
      <div class="wrap sitebar__in">
        <a class="home" href="#/" aria-label="Aucteva, accueil">${LOGO}</a>
        <nav class="sitenav" aria-label="${getLang() === "en" ? "Main" : "Principale"}">
          <a href="#/produit">${t("nav.product")}</a><a href="#/fonctionnement">${t("nav.how")}</a><a href="#/cas-usage">${t("nav.cases")}</a><a href="#/securite">${t("nav.security")}</a>
        </nav>
        <div class="sitebar__actions">
          <button type="button" class="langbtn" data-lang aria-label="${t("lang.switch")}">${t("lang.code")}</button>
          <a class="btn btn--light btn--sm" href="#/demo">${t("nav.demo")}</a>
          <button type="button" class="sitebar__menu" aria-expanded="false" aria-controls="sitebar" aria-label="Menu">${ICON.menu}</button>
        </div>
      </div>
    </header>
    <main id="contenu" class="site">${inner}</main>
    <footer class="sitefoot">
      <div class="wrap sitefoot__in">
        <div>${LOGO}<p style="max-width:520px;margin:0">${t("footer.line")}</p></div>
        <nav aria-label="Footer"><a href="#/app">${t("nav.app")}</a><a href="#/app/connecteur">${t("footer.connector")}</a><a href="#/conditions">${t("footer.terms")}</a><a href="#/confidentialite">${t("footer.privacy")}</a></nav>
      </div>
    </footer>`;
  root.querySelector("[data-lang]").addEventListener("click", () => { setLang(getLang() === "en" ? "fr" : "en"); window.dispatchEvent(new HashChangeEvent("hashchange")); });
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

export function renderLanding(root, anchor) {
  document.title = getLang() === "en" ? "Aucteva, legal governance for AI tools" : "Aucteva, gouvernance juridique des outils d'IA";
  const SC = { marketing: getLang() === "en" ? "Marketing content" : "Contenus marketing", support: getLang() === "en" ? "Customer support" : "Support client", recruiter: getLang() === "en" ? "Candidate screening" : "Présélection de candidats" };
  siteLayout(root, `
    <section class="hero" id="produit">
      <div class="wrap">
        <div class="hero__copy">
          <div class="hero__line" aria-hidden="true"></div>
          <h1>${t("hero.title")}</h1>
          <p class="hero__sub">${t("hero.sub")}</p>
          <div class="hero__ctas"><a class="btn btn--light btn--lg" href="#/demo">${t("hero.cta1")}</a><a class="btn btn--outline-light btn--lg" href="#/fonctionnement">${t("hero.cta2")}</a></div>
        </div>
        <div class="hero__shot" id="hero-mock"></div>
        <p class="hero__caption">${t("hero.caption")}</p>
      </div>
    </section>

    <section class="sec">
      <div class="wrap">
        <div class="kicker">${t("pb.kicker")}</div>
        <h2>${t("pb.title")}</h2>
        <p class="sec__lead">${t("pb.body")}</p>
        <div class="cols3">
          <div><h3>${t("pb.a.t")}</h3><p>${t("pb.a.d")}</p></div>
          <div><h3>${t("pb.b.t")}</h3><p>${t("pb.b.d")}</p></div>
          <div><h3>${t("pb.c.t")}</h3><p>${t("pb.c.d")}</p></div>
        </div>
      </div>
    </section>

    <section class="sec sec--tint" id="fonctionnement">
      <div class="wrap">
        <div class="kicker">${t("how.kicker")}</div>
        <h2>${t("how.title")}</h2>
        <div class="steps4">
          ${[1, 2, 3, 4].map((i) => `<div><span class="n">${i}</span><h3>${t(`how.${i}.t`)}</h3><p>${t(`how.${i}.d`)}</p></div>`).join("")}
        </div>
      </div>
    </section>

    <section class="sec" id="cas-usage">
      <div class="wrap">
        <div class="kicker">${t("pv.kicker")}</div>
        <h2>${t("pv.title")}</h2>
        <p class="sec__lead">${t("pv.body")}</p>
        <div class="tabs" role="tablist" style="margin:32px 0 16px">
          ${SCENARIOS.map((s, i) => `<button type="button" role="tab" aria-selected="${i === 1}" data-scn="${s.id}">${esc(SC[s.id])} · ${esc(s.tool)}</button>`).join("")}
        </div>
        <div id="pv-mock"></div>
        <p style="margin-top:16px"><a class="btn btn--secondary" href="#/demo">${t("pv.open")}</a></p>
      </div>
    </section>

    <section class="sec sec--tint">
      <div class="wrap">
        <div class="kicker">${t("dim.kicker")}</div>
        <h2>${t("dim.title")}</h2>
        <div class="dims8">${DIM_IDS.map((d, i) => `<div><span class="n">${i + 1}</span><h3>${t(`dim.${d}`)}</h3><p>${t(`dim.${d}.d`)}</p></div>`).join("")}</div>
        <p class="note">${t("dim.note")}</p>
      </div>
    </section>

    <section class="sec sec--navy">
      <div class="wrap">
        <div class="kicker">${t("roles.kicker")}</div>
        <h2>${t("roles.title")}</h2>
        <div class="roles3">
          <div><div class="who">IA</div><h3>${t("roles.ai.t")}</h3><p>${t("roles.ai.d")}</p></div>
          <div><div class="who">${getLang() === "en" ? "Lawyer" : "Avocat"}</div><h3>${t("roles.law.t")}</h3><p>${t("roles.law.d")}</p></div>
          <div><div class="who">${getLang() === "en" ? "Company" : "Entreprise"}</div><h3>${t("roles.co.t")}</h3><p>${t("roles.co.d")}</p></div>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="wrap split">
        <div>
          <div class="kicker">${t("reg.kicker")}</div>
          <h2>${t("reg.title")}</h2>
          <p class="sec__lead">${t("reg.body")}</p>
          <p style="margin-top:24px"><a class="btn btn--secondary" href="#/app/registre">${t("reg.open")}</a></p>
        </div>
        <div>
          <div id="reg-mini"><span class="sk" style="height:180px"></span></div>
          <p class="note">${t("reg.live")}</p>
        </div>
      </div>
    </section>

    <section class="sec sec--tint" id="securite">
      <div class="wrap">
        <div class="kicker">${t("sec.kicker")}</div>
        <h2>${t("sec.title")}</h2>
        <div class="sec5">
          ${[1, 2, 3, 4, 5].map((i) => `<div><h3>${i === 5 ? `${ICON.lock}` : ""}${t(`sec.${i}.t`)}</h3><p>${t(`sec.${i}.d`)}</p></div>`).join("")}
        </div>
      </div>
    </section>

    <section class="sec sec--navy">
      <div class="wrap">
        <div class="kicker">${t("cta.kicker")}</div>
        <h2>${t("cta.title")}</h2>
        <p class="sec__lead">${t("cta.body")}</p>
        <div class="cta-band"><a class="btn btn--light btn--lg" href="#/demo">${t("cta.demo")}</a><a class="btn btn--outline-light btn--lg" href="#/app/nouveau">${t("cta.own")}</a><a class="btn btn--outline-light btn--lg" href="#/app/connecteur">${t("cta.mcp")}</a></div>
      </div>
    </section>`);

  mountMock(root.querySelector("#hero-mock"), "support");
  const pv = root.querySelector("#pv-mock");
  mountMock(pv, "support", { flat: true });
  root.querySelectorAll("[data-scn]").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("[data-scn]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    mountMock(pv, b.dataset.scn, { flat: true });
  }));

  api("/registre").then(({ dossiers }) => {
    const rows = dossiers.filter((x) => x.statut === "termine").slice(0, 6);
    root.querySelector("#reg-mini").innerHTML = `
      <table class="regmini"><thead><tr><th>${t("tbl.tool")}</th><th>${t("tbl.avis")}</th><th>${t("tbl.legal")}</th><th>${t("tbl.decision")}</th></tr></thead>
      <tbody>${rows.map((x) => `<tr><td><strong style="font-weight:500">${esc(x.outil)}</strong><div class="small muted">${esc(x.fournisseur)}</div></td><td>${avisPill(x.verdict)}</td><td class="small">${x.validation ? esc(x.validation.role) : `<span class="muted">${t("wf.pending")}</span>`}</td><td class="small">${decisionPill(x.decision)}</td></tr>`).join("")}</tbody></table>`;
  }).catch(() => { root.querySelector("#reg-mini").innerHTML = `<p class="err">${t("tbl.error")}</p>`; });

  if (anchor) { const el = root.querySelector(`#${anchor}`); if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "start" })); }
  else window.scrollTo(0, 0);
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
  try { const { dossier } = await api("/examens", payload); location.hash = `#/app/en-cours/${dossier.id}`; }
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
        <a href="#/app/nouveau/conversation"><strong>${t("demo.other.chat")}</strong><span>${t("demo.other.chat.d")}</span></a>
        <a href="#/app/nouveau"><strong>${t("demo.other.form")}</strong><span>${t("demo.other.form.d")}</span></a>
        <a href="#/app/connecteur"><strong>${t("demo.other.mcp")}</strong><span>${t("demo.other.mcp.d")}</span></a>
      </div>
    </div>`);
  root.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => runScenario(b.dataset.run, b.dataset.mode, b)));
  const tools = new Set(SCENARIOS.map((s) => s.tool));
  api("/registre").then(({ dossiers }) => {
    const seen = new Set();
    const rows = dossiers.filter((x) => x.statut === "termine" && x.mode === "claude" && !tools.has(x.outil) && x.mots > 800 && !/test/i.test(x.outil)).filter((x) => { const k = `${x.outil}|${x.fournisseur}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 8);
    root.querySelector("#real").innerHTML = rows.length ? `<div class="card tablewrap"><table class="table"><thead><tr><th>${t("tbl.tool")}</th><th>${t("tbl.vendor")}</th><th>${t("tbl.docs")}</th><th>${t("tbl.avis")}</th><th>${t("tbl.level")}</th><th></th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td><a class="t-tool" href="#/app/dossier/${esc(x.id)}">${esc(x.outil)}</a></td><td>${esc(x.fournisseur)}</td><td class="muted">${fmtInt(x.mots)} ${t("d.words")}</td><td>${avisPill(x.verdict)}</td><td class="num">${x.score}</td><td><a href="#/app/dossier/${esc(x.id)}">${t("tbl.open")}</a></td></tr>`).join("")}
    </tbody></table></div>` : `<p class="muted">${t("tbl.empty")}</p>`;
  }).catch(() => { root.querySelector("#real").innerHTML = `<p class="err">${t("tbl.error")}</p>`; });
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
      <p>Le site et le registre sont hébergés par Cloudflare. La lecture des contrats est exécutée sur l'infrastructure de GitHub, par le modèle de langage d'un fournisseur tiers. Ne transmettez donc aucune donnée personnelle dans les contrats ou les messages. Ces prestataires peuvent traiter des données hors de l'Union européenne, dans le cadre des clauses contractuelles types de la Commission européenne.</p>
      <h2>Durée de conservation</h2>
      <p>Les dossiers et conversations sont conservés pendant la durée du concours Make AI Happen 2026, puis supprimés.</p>
      <h2>Vos droits</h2>
      <p>Vous disposez d'un droit d'accès, de rectification, d'effacement, d'opposition et de limitation. Pour l'exercer ou faire retirer un dossier, contactez l'équipe Aucteva sur la plateforme du concours Make AI Happen. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>`,
  },
};

export function renderLegal(root, key) {
  const p = LEGAL[key];
  document.title = `${p.titre}, Aucteva`;
  siteLayout(root, `<div class="wrap page"><article class="legal"><div class="page__head"><h1>${p.titre}</h1>${getLang() === "en" ? `<p>This page is available in French only.</p>` : ""}</div>${p.corps}<p style="margin-top:32px"><a class="btn btn--secondary" href="#/">${t("nf.home")}</a></p></article></div>`);
  window.scrollTo(0, 0);
}

export function renderNotFound(root) {
  document.title = `${t("nf.title")}, Aucteva`;
  siteLayout(root, `<div class="wrap page"><div class="page__head"><h1>${t("nf.title")}</h1><p>${t("nf.body")}</p></div><p><a class="btn" href="#/">${t("nf.home")}</a> <a class="btn btn--secondary" href="#/app/registre">${t("app.registry")}</a></p></div>`);
}
