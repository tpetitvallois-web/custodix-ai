// Deck « Custodix AI », Make AI Happen 2026 (KPMG), thème 3.
// Gabarit de cabinet : kicker + titre, navigation des sections en haut à droite, bandeau de pied avec logotype et numéro.
// Formats : tableaux à filets, paragraphes à intertitres, encadrés, grille, captures de la démonstration, bouton vers la démo.
// Aucune frise, aucune liste à puces ou à tirets, aucune icône. Un seul accent bleu nuit, pastilles sobres pour les trois issues.
//   custodix-ai-oral.pptx    : 8 slides + 3 annexes (demi-finale)
//   custodix-ai-agorize.pptx : 5 slides (limite du formulaire, business plan inclus)
// NODE_PATH=$PWD/node_modules PPTX_SKILL=… node build.js
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const BRAND = "Custodix AI";
const PAPER = "FFFFFF", INK = "26292E", MUTED = "6B6F76", LINE = "D9DBDF", NAVY = "10233F", SOFT = "F3F4F6", GREY = "9A9DA3";
const GREEN = "2E5E3F", AMBER = "9A6B1E", BRICK = "8E3B2F";
const SERIF = "Charter", BODY = "Barlow", SEMI = "Barlow SemiBold";
const THEME = { name: BRAND, headFontFace: SERIF, bodyFontFace: BODY, colors: { dk1: INK, lt1: PAPER, dk2: MUTED, lt2: SOFT, accent1: NAVY, accent2: MUTED, accent3: LINE, accent4: GREEN, accent5: AMBER, accent6: BRICK, hlink: NAVY, folHlink: MUTED } };
const W = 13.33, H = 7.5, M = 1.0, CW = W - 2 * M, TOP = 1.72, BOT = 6.5;
const DEMO_URL = process.env.DEMO_URL || "custodix-ai.gererseul-avis-worker.workers.dev";
const HREF = "https://" + DEMO_URL + "/";
const RATIO = 2560 / 1500; // toutes les captures
const positions = {}; // positions du bouton, pour le PPTX en images

function makeDeck(fileName, slides, title, sections) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.theme = { headFontFace: SERIF, bodyFontFace: BODY };
  pres.author = "Céline Lin, Tom Petit Vallois";
  pres.title = title;
  pres.defineSlideMaster({ title: "PAPER", background: { color: PAPER } });

  const T = (s, text, o = {}) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: BODY, fontSize: 14, color: INK, valign: "top" }, o));
  const rule = (s, x, y, w, color = LINE, pt = 0.75) => s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color, width: pt } });
  const dot = (s, x, y, color, d = 0.13) => s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0 } });
  // En-tête : kicker, titre, navigation des sections (section active en bleu nuit).
  const H2 = (s, text, kicker, section) => {
    if (kicker) T(s, kicker, { x: M, y: 0.5, w: 7, h: 0.25, fontFace: SEMI, fontSize: 11, color: NAVY });
    T(s, text, { x: M, y: 0.74, w: CW - 0.2, h: 0.9, fontFace: SERIF, fontSize: 26, color: INK, lineSpacingMultiple: 1.1 });
    if (section && sections) {
      const runs = [];
      sections.forEach((name, i) => {
        const active = name === section;
        runs.push({ text: name.toUpperCase(), options: { color: active ? NAVY : GREY, fontFace: active ? SEMI : BODY, fontSize: 7.5, charSpacing: 0.6 } });
        if (i < sections.length - 1) runs.push({ text: "  |  ", options: { color: "C4C6CA", fontSize: 7.5 } });
      });
      s.addText(runs, { x: W - M - 8.5, y: 0.18, w: 8.5, h: 0.25, isTextBox: true, margin: 0, align: "right", valign: "top" });
    }
  };
  const COL = (s, text, x, y, w) => { T(s, text, { x, y, w, h: 0.28, fontFace: SEMI, fontSize: 13, color: NAVY }); rule(s, x, y + 0.33, w, NAVY, 1); };
  const foot = (s, note, n) => {
    if (note) T(s, note, { x: M, y: 6.62, w: CW - 1.5, h: 0.28, fontSize: 8.5, color: MUTED });
    rule(s, M, 6.98, CW, LINE, 0.75);
    T(s, BRAND, { x: M, y: 7.08, w: 1.6, h: 0.3, fontFace: SERIF, fontSize: 13, color: INK });
    T(s, "Projet étudiant, Make AI Happen 2026, KPMG, thématique 3. Contrats, fournisseurs et dossiers fictifs. Céline Lin et Tom Petit Vallois.", { x: M + 1.7, y: 7.13, w: 7.6, h: 0.25, fontSize: 6.5, color: GREY });
    if (n) {
      T(s, "Avis d'autorisation des outils d'IA", { x: W - M - 3.0, y: 7.13, w: 2.3, h: 0.25, fontSize: 6.5, color: GREY, align: "right" });
      s.addShape(pres.ShapeType.line, { x: W - M - 0.58, y: 7.08, w: 0, h: 0.3, line: { color: LINE, width: 0.75 } });
      T(s, String(n), { x: W - M - 0.5, y: 7.1, w: 0.5, h: 0.28, fontSize: 9, color: INK, align: "right", valign: "middle" });
    }
  };
  const LEAD = (s, text, x, y, w, h, o = {}) => T(s, text, Object.assign({ x, y, w, h, fontSize: 15, lineSpacingMultiple: 1.3 }, o));
  const P = (s, text, x, y, w, h, o = {}) => T(s, text, Object.assign({ x, y, w, h, fontSize: 11.5, color: MUTED, lineSpacingMultiple: 1.3 }, o));
  // Paragraphes à intertitres, dans un seul bloc.
  const paras = (s, x, y, w, h, items, { size = 12, gap = 7 } = {}) => {
    const runs = [];
    items.forEach(([t, d], i) => {
      runs.push({ text: t, options: { fontFace: SEMI, fontSize: size, color: INK, breakLine: true } });
      runs.push({ text: d, options: { fontFace: BODY, fontSize: size - 1, color: MUTED, breakLine: i < items.length - 1, paraSpaceAfter: gap } });
    });
    s.addText(runs, { x, y, w, h, isTextBox: true, margin: 0, valign: "top", lineSpacingMultiple: 1.25 });
  };
  // Tableau à filets : en-tête bleu nuit, lignes séparées par un filet gris.
  const table = (s, x, y, w, colW, header, rows, { size = 10.5, headSize = 9.5, rowH } = {}) => {
    const bb = (c, pt) => [{ type: "none" }, { type: "none" }, { type: "solid", pt, color: c }, { type: "none" }];
    const head = header.map((t) => ({ text: t, options: { fontFace: SEMI, fontSize: headSize, color: NAVY, border: bb(NAVY, 1), fill: { color: PAPER } } }));
    const body = rows.map((r) => r.map((c, j) => {
      const runs = typeof c === "string" ? [{ text: c }] : c;
      return { text: runs.map((rn) => ({ text: rn.text, options: Object.assign({ fontFace: j === 0 ? SEMI : BODY, fontSize: size, color: j === 0 ? INK : MUTED }, rn.options || {}) })), options: { border: bb(LINE, 0.75), fill: { color: PAPER } } };
    }));
    const opts = { x, y, w, colW, margin: [0.05, 0.06, 0.05, 0.02], valign: "middle", autoPage: false, fontFace: BODY };
    if (rowH) opts.rowH = rowH;
    s.addTable([head, ...body], opts);
  };
  // Encadré gris, texte en serif bleu nuit.
  const callout = (s, x, y, w, h, text, size = 13) => {
    s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: SOFT }, line: { color: SOFT, width: 0 } });
    T(s, text, { x: x + 0.22, y: y + 0.12, w: w - 0.44, h: h - 0.24, fontFace: SERIF, fontSize: size, color: NAVY, lineSpacingMultiple: 1.2, valign: "middle" });
  };
  // Case de grille : fond gris, intertitre, texte.
  const cell = (s, x, y, w, h, t, d, { size = 12 } = {}) => {
    s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: SOFT }, line: { color: SOFT, width: 0 } });
    T(s, t, { x: x + 0.2, y: y + 0.14, w: w - 0.4, h: 0.3, fontFace: SEMI, fontSize: size, color: INK });
    T(s, d, { x: x + 0.2, y: y + 0.5, w: w - 0.4, h: h - 0.6, fontSize: size - 1, color: MUTED, lineSpacingMultiple: 1.3 });
  };
  // Capture de la démonstration, encadrée, avec légende.
  const shot = (s, path, x, y, w, caption, { capSize = 10 } = {}) => {
    const h = w / RATIO;
    s.addImage({ path, x, y, w, h });
    s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { type: "none" }, line: { color: LINE, width: 0.75 } });
    if (caption) T(s, caption, { x, y: y + h + 0.06, w, h: 0.42, fontSize: capSize, color: MUTED, lineSpacingMultiple: 1.2 });
    return h;
  };
  // Bouton vers la démonstration, adresse en dessous.
  const button = (s, x, y, w, { h = 0.46, key } = {}) => {
    s.addText("Ouvrir la démonstration", { shape: pres.ShapeType.roundRect, rectRadius: 0.04, x, y, w, h, fill: { color: NAVY }, line: { color: NAVY, width: 0 }, fontFace: SEMI, fontSize: 12, color: "FFFFFF", align: "center", valign: "middle", margin: 0, hyperlink: { url: HREF, tooltip: "Ouvrir la démonstration" } });
    s.addText([{ text: DEMO_URL, options: { hyperlink: { url: HREF }, color: NAVY, underline: { style: "sng" } } }], { x, y: y + h + 0.08, w, h: 0.25, isTextBox: true, margin: 0, fontFace: BODY, fontSize: 9, align: "center", valign: "top" });
    if (key) positions[key] = { x, y, w, h };
  };
  // Une issue : pastille, libellé en serif, description.
  const issue = (s, x, y, w, color, lab, desc, { size = 14, descSize = 11 } = {}) => {
    dot(s, x, y + 0.09, color, size > 12 ? 0.13 : 0.11);
    T(s, lab, { x: x + 0.28, y, w: w - 0.2, h: 0.35, fontFace: SERIF, fontSize: size, color: INK });
    T(s, desc, { x: x + 0.28, y: y + 0.36, w: w - 0.28, h: 0.7, fontSize: descSize, color: MUTED, lineSpacingMultiple: 1.25 });
  };
  const add = () => pres.addSlide({ masterName: "PAPER" });
  const ctx = { pres, T, H2, COL, LEAD, P, paras, table, callout, cell, shot, button, issue, dot, rule, foot, add };
  slides.forEach((fn, i) => fn(ctx, i + 1));
  return pres.writeFile({ fileName }).then(() => applyTheme(fileName, THEME)).then(() => console.log("ok", fileName));
}

// ───────────────────────── Contenus partagés
const DOT = (c) => ({ text: "●  ", options: { color: c, fontFace: BODY } });
const Q_LEAD = "Chaque nouvel outil IA soulève les mêmes questions : quelles données sont utilisées, par qui, où sont-elles conservées, et quelles obligations en découlent ?";
const REGARDS = [
  ["Achats", "négocient le prix et le niveau de service, rarement les clauses sur les données."],
  ["Juridique", "lit le contrat, sans toujours connaître l'usage prévu ni les données concernées."],
  ["DPO", "vérifie le RGPD, souvent après la signature, sur la base du contrat reçu."],
  ["IT", "regarde la sécurité et l'intégration, pas le contrat ni le cas d'usage."],
];
const AVANT_APRES = [
  ["Examen du contrat", "quatre services, l'un après l'autre", "un dossier commun, examiné une fois"],
  ["Traçabilité", "mails et fichiers dispersés", "registre des autorisations, daté et sourcé"],
  ["Décision", "implicite : déployé sans réponse, ou refusé par prudence", "avis formalisé, validé par un avocat"],
  ["Délai", "des semaines", "des jours"],
  ["Suivi", "aucun, jusqu'au contrôle", "revue à chaque changement de contrat ou d'usage"],
];
const EXAMEN = [
  ["Entraînement des modèles", "le fournisseur peut-il apprendre de nos données", "RGPD art. 5 et 28"],
  ["Conservation et suppression", "durée, restitution, certificat de suppression", "RGPD art. 5.1.e"],
  ["Transferts hors UE", "hébergement, clauses contractuelles types", "RGPD art. 44 à 46"],
  ["Sous-traitants et audit", "liste, notification, droit d'audit", "RGPD art. 28"],
  ["Sécurité et incidents", "chiffrement, délai de notification", "RGPD art. 32 et 33"],
  ["Résultats et responsabilité", "propriété des contenus générés, plafonds", "droit des contrats"],
  ["Décision automatisée", "supervision humaine, biais mesurés", "RGPD art. 22, AI Act art. 26"],
  ["Transparence", "information des personnes concernées", "AI Act art. 50"],
];
const ISSUES = [
  [GREEN, "Autorisé", "l'outil peut être déployé dans le périmètre décrit"],
  [AMBER, "Autorisé sous conditions", "des mesures ou un avenant sont nécessaires avant un déploiement élargi"],
  [BRICK, "Non autorisé en l'état", "le risque est trop élevé ou le contrat doit être modifié"],
];
const POSITION = "Custodix AI ne remplace pas la gestion contractuelle ni l'avocat. Il prépare une décision d'usage, documentée et validée par un expert.";
const KPMG_PARAS = [
  ["Quatre expertises réunies", "juridique, fiscale, conformité et cybersécurité : les quatre regards d'un dossier d'autorisation, dans une même équipe."],
  ["Validation par des avocats", "l'avis engage une relecture et une validation humaines. C'est ce qui le distingue d'un questionnaire ou d'un inventaire."],
  ["Intégration aux outils en place", "les contrats des grands comptes sont déjà centralisés dans leurs plateformes contractuelles. Custodix AI s'y branche, sans les remplacer."],
  ["Déploiement multi-pays et accompagnement continu", "veille réglementaire, avenants, gouvernance et reporting, dans chaque pays où le groupe opère."],
];
const KPMG_LINE = "Les plateformes contractuelles structurent les contrats. Custodix AI aide à décider comment un outil IA peut être utilisé.";
const SERVICE = [
  ["Diagnostic initial", "Cartographie des outils IA déjà en usage dans le groupe et de leurs niveaux de risque. Un premier registre, en quelques semaines."],
  ["Autorisation continue", "Examen de chaque nouvel outil avant déploiement : contrat, cas d'usage, données. Un avis par outil, validé par un avocat."],
  ["Accompagnement contractuel", "Rédaction ou négociation des avenants lorsque l'avis le demande : entraînement, conservation, transferts, audit."],
  ["Suivi et gouvernance", "Registre des outils autorisés, revue périodique à chaque changement de contrat ou d'usage, reporting à la direction."],
];
const SERVICE_NOTE = "Modalités et tarification à définir avec KPMG Avocats lors du pilote.";
const EXAMPLES = [
  [GREEN, "MarketingAI", "Publications pour les réseaux sociaux", "aucune donnée personnelle", "Autorisé"],
  [AMBER, "SupportAI", "Chatbot de support sur l'historique client", "données clients", "Autorisé sous conditions"],
  [BRICK, "RecruiterAI", "Tri de CV, entraînement sur les candidatures", "données RH et de santé", "Non autorisé en l'état"],
];
const VISION = "À terme, chaque outil IA autorisé dans l'entreprise dispose d'un dossier daté, sourcé et validé.";
const PILOT = "Pilote proposé : trois mois, deux grands comptes, vingt outils examinés, un avocat référent par dossier.";
const SRC = "Source : Microsoft et LinkedIn, Work Trend Index 2024 : 78 % des utilisateurs d'IA au travail apportent leurs propres outils, sans validation de l'entreprise.";
const CAP = {
  formulaire: "Le dossier déposé : outil, fournisseur, usage prévu, données concernées, contrat.",
  examen: "L'examen, étape par étape : contrat, clauses, cas d'usage, RGPD et AI Act.",
  dossier: "Le dossier d'autorisation : avis, niveau de vigilance, en attente de validation.",
  valide: "Le même dossier une fois validé par l'avocat, avec l'identifiant de signature.",
  risques: "Chaque risque cite la clause du contrat et l'article applicable.",
  avenant: "L'avenant type généré à partir des clauses correctives, prêt à négocier.",
  accueil: "La démonstration en ligne, trois dossiers prêts à l'examen.",
};
const examplesTable = (c, s, x, y, w, size = 11) => c.table(s, x, y, w, [w * 0.17, w * 0.52, w * 0.31], ["Outil", "Usage et données", "Avis"], EXAMPLES.map(([col, n, u, d, a]) => [n, `${u} (${d})`, [DOT(col), { text: a }]]), { size });

// ───────────────────────── Slides
const cover = ({ add, T, rule, shot, foot }) => {
  const s = add();
  T(s, "Make AI Happen, KPMG | Thématique 3 : cabinet d'avocats AI ready", { x: M, y: 0.8, w: 7, h: 0.3, fontSize: 11, color: MUTED });
  T(s, BRAND, { x: M, y: 1.9, w: 6.5, h: 1.1, fontFace: SERIF, fontSize: 56, color: INK });
  rule(s, M, 3.05, 1.5, NAVY, 1.5);
  T(s, "Chaque IA passe par Custodix.", { x: M, y: 3.28, w: 6.5, h: 0.5, fontFace: SERIF, fontSize: 24, color: NAVY });
  T(s, "Autorisation et gouvernance des outils d'intelligence artificielle en entreprise.", { x: M, y: 3.9, w: 5.8, h: 0.7, fontSize: 15, color: INK, lineSpacingMultiple: 1.3 });
  T(s, "Un service conçu pour les directions juridiques, conformité, achats et IT.", { x: M, y: 4.62, w: 5.8, h: 0.6, fontSize: 13, color: MUTED, lineSpacingMultiple: 1.3 });
  T(s, "Préparé par Céline Lin et Tom Petit Vallois", { x: M, y: 6.3, w: 6, h: 0.3, fontSize: 12, color: INK });
  shot(s, "shots/dossier.png", 7.1, 1.9, 5.23, CAP.dossier);
  foot(s, "", 0);
  s.addNotes("Couverture : le nom, la promesse, et un dossier d'autorisation tel qu'il sort de la démonstration.");
};

const probleme = ({ add, H2, LEAD, COL, paras, table, foot }, n) => {
  const s = add();
  H2(s, "Les entreprises adoptent l'IA sans maîtriser ses conditions d'usage.", "Le contexte", "Problème");
  const lw = 5.3, rx = M + lw + 0.5, rw = CW - lw - 0.5;
  LEAD(s, Q_LEAD, M, TOP, lw, 1.1, { fontSize: 14 });
  COL(s, "Quatre regards, en série, sur le même contrat", M, 3.0, lw);
  paras(s, M, 3.45, lw, 3.0, REGARDS, { size: 13, gap: 9 });
  COL(s, "Les questions sans réponse, et qui devrait y répondre", rx, TOP, rw);
  table(s, rx, TOP + 0.45, rw, [rw * 0.36, rw * 0.24, rw * 0.4], ["Question", "Qui", "Ce qui manque"], [
    ["Entraînement sur nos données", "Juridique, DPO", "la clause est rarement lue avant la signature"],
    ["Transferts hors UE", "DPO, IT", "l'hébergement dépend de la configuration choisie"],
    ["Conservation", "DPO", "durée absente, ou « aussi longtemps que nécessaire »"],
    ["Propriété des résultats", "Juridique", "silence du contrat"],
    ["Responsabilité en cas d'erreur", "Juridique, métier", "exclusions larges, plafonds bas"],
    ["Adéquation au cas d'usage", "Métier, conformité", "personne ne croise le contrat et l'usage"],
  ], { size: 10 });
  foot(s, SRC, n);
  s.addNotes("Le problème : les mêmes questions à chaque outil, quatre services qui regardent chacun leur part, et un contrat que personne ne croise avec l'usage.");
};

const processus = ({ add, H2, LEAD, COL, table, callout, foot }, n) => {
  const s = add();
  H2(s, "Aujourd'hui, l'autorisation d'un outil IA repose sur des échanges dispersés.", "Le processus actuel", "Problème");
  LEAD(s, "Achats, juridique, DPO et IT examinent le même dossier séparément. Il manque une vue commune, une traçabilité et une décision formalisée.", M, TOP, 9.5, 0.8, { fontSize: 14 });
  COL(s, "Ce qui change avec un service d'autorisation", M, 2.6, CW);
  table(s, M, 3.0, CW, [CW * 0.18, CW * 0.41, CW * 0.41], ["", "Aujourd'hui", "Avec Custodix AI"], AVANT_APRES, { size: 11.5, rowH: 0.44 });
  callout(s, M, 5.85, CW, 0.6, "Sans décision formalisée, l'outil est déployé sans réponse, ou refusé par prudence. Dans les deux cas, l'entreprise ne sait pas.", 12.5);
  foot(s, "", n);
  s.addNotes("Le processus actuel face au service : examen, traçabilité, décision, délai, suivi.");
};

const solution = ({ add, H2, COL, shot, table, callout, issue, foot }, n) => {
  const s = add();
  H2(s, "D'un contrat et d'un cas d'usage à un avis d'autorisation.", "La solution", "Solution");
  const lw = 5.0, rx = M + lw + 0.45, rw = CW - lw - 0.45;
  const h = shot(s, "shots/examen.png", M, TOP, lw, CAP.examen);
  callout(s, M, TOP + h + 0.55, lw, BOT - (TOP + h + 0.55), POSITION, 12.5);
  COL(s, "Ce que Custodix AI examine dans chaque contrat", rx, TOP, rw);
  table(s, rx, TOP + 0.45, rw, [rw * 0.33, rw * 0.42, rw * 0.25], ["Sujet", "Ce qui est vérifié", "Base"], EXAMEN, { size: 9.5, headSize: 9, rowH: 0.3 });
  const iy = 5.55, iw = rw / 3;
  ISSUES.forEach(([c, l, d], i) => issue(s, rx + i * iw, iy, iw - 0.1, c, l, d, { size: 10.5, descSize: 9 }));
  foot(s, "", n);
  s.addNotes("La solution : l'examen tel qu'il se déroule dans la démonstration, ce qui est vérifié et sur quelle base, les trois issues, et la phrase de positionnement.");
};

const issuesSlide = ({ add, H2, shot, issue, callout, foot }, n) => {
  const s = add();
  H2(s, "Trois issues possibles, toujours documentées.", "La solution", "Solution");
  const lw = 6.3, rx = M + lw + 0.5, rw = CW - lw - 0.5;
  shot(s, "shots/dossier.png", M, TOP, lw, CAP.dossier);
  ISSUES.forEach(([c, l, d], i) => issue(s, rx, TOP + i * 1.05, rw, c, l, d, { size: 16, descSize: 11.5 }));
  callout(s, rx, 5.0, rw, 1.3, "Chaque avis mentionne les clauses analysées, les risques identifiés, les obligations applicables et les mesures recommandées.", 12.5);
  foot(s, "", n);
  s.addNotes("Les trois issues, avec un dossier réel de la démonstration à gauche.");
};

const kpmg = ({ add, H2, COL, paras, callout, shot, foot }, n) => {
  const s = add();
  H2(s, "Un service qui réunit expertise juridique, conformité et exécution.", "Pourquoi KPMG", "Pourquoi KPMG");
  const lw = 6.4, rx = M + lw + 0.5, rw = CW - lw - 0.5;
  COL(s, "Pourquoi un cabinet, et pourquoi KPMG", M, TOP, lw);
  paras(s, M, TOP + 0.45, lw, 3.4, KPMG_PARAS, { size: 12.5, gap: 9 });
  callout(s, M, 5.7, lw, 0.8, KPMG_LINE, 12.5);
  shot(s, "shots/dossier-valide.png", rx, TOP, rw, "Dans la démonstration : l'avis n'a de valeur qu'une fois validé par un avocat du cabinet.");
  foot(s, "", n);
  s.addNotes("Pourquoi un cabinet : les expertises, la validation par des avocats, l'intégration aux outils en place, le multi-pays.");
};

const service = ({ add, H2, cell, P, COL, foot }, n) => {
  const s = add();
  H2(s, "Un modèle de service progressif.", "Modèle de service", "Modèle de service");
  COL(s, "Quatre briques, dans l'ordre où un client les achète", M, TOP, CW);
  const g = 0.3, cw = (CW - g) / 2, ch = 1.75, y0 = TOP + 0.5;
  SERVICE.forEach(([t, d], i) => cell(s, M + (i % 2) * (cw + g), y0 + Math.floor(i / 2) * (ch + g), cw, ch, t, d, { size: 13 }));
  P(s, SERVICE_NOTE + " Le diagnostic et les avenants sont des missions ponctuelles ; l'autorisation continue et le suivi forment le revenu récurrent.", M, y0 + 2 * ch + g + 0.15, CW, 0.5, { fontSize: 11.5 });
  foot(s, "", n);
  s.addNotes("Le modèle de service en quatre briques. Pas de prix affiché : les hypothèses chiffrées sont en annexe.");
};

const exemples = (c, n) => {
  const { add, H2, COL, callout, P, shot, button, foot } = c;
  const s = add();
  H2(s, "Trois exemples, une même logique de décision.", "Démonstration", "Démonstration");
  const lw = 6.8, rx = M + lw + 0.5, rw = CW - lw - 0.5;
  COL(s, "Trois dossiers prêts dans la démonstration", M, TOP, lw);
  examplesTable(c, s, M, TOP + 0.45, lw, 11);
  callout(s, M, 4.15, lw, 0.85, VISION, 13);
  P(s, PILOT, M, 5.2, lw, 0.6, { fontSize: 12 });
  const h = shot(s, "shots/accueil.png", rx, TOP, rw, CAP.accueil);
  button(s, rx, TOP + h + 0.62, rw);
  foot(s, "", n);
  s.addNotes("Les trois exemples en tableau, la vision, le pilote, et le bouton vers la démonstration.");
};

const demoSlide = ({ add, H2, shot, button, P, foot }, n) => {
  const s = add();
  H2(s, "La démonstration en ligne : du dossier déposé à l'avenant type.", "Démonstration", "Démonstration");
  const g = 0.5, w = (CW - 2 * g) / 3, h = w / RATIO, y1 = TOP, y2 = TOP + h + 0.5;
  shot(s, "shots/formulaire.png", M, y1, w, CAP.formulaire);
  shot(s, "shots/examen.png", M + w + g, y1, w, CAP.examen);
  shot(s, "shots/risques.png", M + 2 * (w + g), y1, w, CAP.risques);
  shot(s, "shots/avenant.png", M, y2, w, CAP.avenant);
  shot(s, "shots/validation.png", M + w + g, y2, w, CAP.valide);
  button(s, M + 2 * (w + g), y2 + 0.1, w);
  P(s, "Trois dossiers prêts à l'examen, sans connexion ni compte. Les contrats et les fournisseurs sont fictifs ; les règles appliquées sont celles du RGPD et de l'AI Act.", M + 2 * (w + g), y2 + 1.05, w, 1.0, { fontSize: 11 });
  foot(s, "", n);
  s.addNotes("Le parcours complet en cinq captures : dossier, examen, risques, avenant, validation. Le bouton ouvre la démonstration.");
};

// Annexes
const annexeRoute = ({ add, H2, table, foot }, n) => {
  const s = add();
  H2(s, "Feuille de route : un pilote de trois mois, une offre complète en douze.", "Annexe", "Annexes");
  table(s, M, TOP + 0.1, CW, [CW * 0.14, CW * 0.3, CW * 0.3, CW * 0.26], ["Période", "Périmètre", "Livrables", "Indicateurs"], [
    ["Mois 1 à 3", "pilote avec deux grands comptes, vingt outils, règles RGPD et AI Act", "vingt dossiers d'autorisation validés, premier registre, barème revu avec les avocats", "temps par dossier, part d'avis corrigés par l'avocat, avenants obtenus"],
    ["Mois 4 à 6", "examen des contrats assisté par un modèle de langage, connexion aux plateformes contractuelles", "lecture des clauses avec citations vérifiées, avenants types par sujet, import des contrats", "citations exactes, délai de l'avis, clients en autorisation continue"],
    ["Mois 7 à 12", "registre groupe, veille réglementaire, accompagnement continu, autres pays", "registre multi-entités, alertes à chaque changement de texte, reporting direction", "outils couverts, revues déclenchées, pays ouverts"],
  ], { size: 11, rowH: 1.1 });
  foot(s, "", n);
};
const annexeRisques = ({ add, H2, table, foot }, n) => {
  const s = add();
  H2(s, "Risques identifiés et mesures prévues.", "Annexe", "Annexes");
  table(s, M, TOP + 0.1, CW, [CW * 0.22, CW * 0.39, CW * 0.39], ["Risque", "Ce qui pourrait arriver", "Mesure prévue"], [
    ["Fausse assurance", "l'entreprise prend l'avis pour une garantie", "chaque risque cite la clause et l'article ; la qualification est explicable ; un avocat valide"],
    ["Erreur d'examen", "une clause mal lue ou inventée", "citations vérifiées mot pour mot dans le contrat ; niveau de confiance ; relecture humaine"],
    ["Responsabilité", "l'avis engage le cabinet au-delà du prévu", "l'avis est une décision d'usage interne, préparée pour le client, pas une consultation sur le contrat"],
    ["Confidentialité", "fuite ou réutilisation des contrats", "hébergement en Union européenne, cloisonnement par client, jamais d'entraînement de modèle"],
    ["Adoption", "un portail de plus, ignoré", "livré dans les outils déjà en place : plateforme contractuelle, messagerie, registre"],
  ], { size: 11, rowH: 0.72 });
  foot(s, "", n);
};
const annexeEco = ({ add, H2, table, P, foot }, n) => {
  const s = add();
  H2(s, "Hypothèses économiques, à valider lors du pilote.", "Annexe", "Annexes");
  table(s, M, TOP + 0.1, CW, [CW * 0.24, CW * 0.46, CW * 0.3], ["Brique", "Hypothèse de travail", "Ordre de grandeur"], [
    ["Diagnostic initial", "mission ponctuelle, selon la taille du parc d'outils", "40 à 80 k€ par grand compte"],
    ["Autorisation continue", "abonnement annuel, 30 à 60 outils examinés par an, deux heures d'avocat par dossier grâce à la préparation assistée", "environ 60 k€ par an"],
    ["Accompagnement contractuel", "missions d'avenants et de gouvernance, selon les cas", "20 à 150 k€"],
    ["Suivi et gouvernance", "service managé : registre, revues, reporting", "environ 120 k€ par an"],
  ], { size: 11.5, rowH: 0.7 });
  P(s, "Dix clients la première année, quarante la deuxième, cent la troisième. Ces ordres de grandeur sont à confronter aux grilles de KPMG Avocats pendant le pilote.", M, 5.3, CW, 0.6, { fontSize: 12 });
  foot(s, "", n);
};

// ───────────────────────── Version Agorize, 5 slides
const problemeProcessus = ({ add, H2, LEAD, COL, paras, table, foot }, n) => {
  const s = add();
  H2(s, "Les entreprises adoptent l'IA sans maîtriser ses conditions d'usage.", "Le contexte", "Problème");
  const lw = 5.2, rx = M + lw + 0.5, rw = CW - lw - 0.5;
  LEAD(s, Q_LEAD, M, TOP, lw, 1.1, { fontSize: 14 });
  COL(s, "Quatre regards, en série, sur le même contrat", M, 2.95, lw);
  paras(s, M, 3.4, lw, 3.1, REGARDS, { size: 12 });
  COL(s, "Ce qui change avec un service d'autorisation", rx, TOP, rw);
  table(s, rx, TOP + 0.45, rw, [rw * 0.2, rw * 0.4, rw * 0.4], ["", "Aujourd'hui", "Avec Custodix AI"], AVANT_APRES, { size: 10.5, rowH: 0.62 });
  foot(s, SRC, n);
  s.addNotes("Le problème et le processus actuel, en une slide.");
};
const kpmgService = ({ add, H2, COL, paras, callout, cell, P, foot }, n) => {
  const s = add();
  H2(s, "Un service qui réunit expertise juridique, conformité et exécution.", "Pourquoi KPMG", "KPMG et modèle de service");
  const lw = 5.4, rx = M + lw + 0.5, rw = CW - lw - 0.5;
  COL(s, "Pourquoi un cabinet, et pourquoi KPMG", M, TOP, lw);
  paras(s, M, TOP + 0.45, lw, 3.3, KPMG_PARAS, { size: 11.5, gap: 7 });
  callout(s, M, 5.6, lw, 0.9, KPMG_LINE, 12);
  COL(s, "Un modèle de service progressif", rx, TOP, rw);
  const g = 0.2, cw = (rw - g) / 2, ch = 1.6, y0 = TOP + 0.5;
  SERVICE.forEach(([t, d], i) => cell(s, rx + (i % 2) * (cw + g), y0 + Math.floor(i / 2) * (ch + g), cw, ch, t, d, { size: 11 }));
  P(s, SERVICE_NOTE + " Business plan : missions ponctuelles pour le diagnostic et les avenants, revenu récurrent par l'autorisation continue et le suivi ; hypothèses chiffrées dans le rapport écrit.", rx, y0 + 2 * ch + g + 0.1, rw, 0.75, { fontSize: 10 });
  foot(s, "", n);
  s.addNotes("Pourquoi KPMG à gauche, le modèle de service à droite, sans prix affiché.");
};
const demoAgorize = (c, n) => {
  const { add, H2, shot, button, callout, P, foot } = c;
  const s = add();
  H2(s, "Trois exemples, une même logique de décision.", "Démonstration", "Démonstration");
  const g = 0.3, w = 3.3, x0 = M + (CW - 3 * w - 2 * g) / 2, h = w / RATIO;
  shot(s, "shots/formulaire.png", x0, TOP, w, CAP.formulaire);
  shot(s, "shots/examen.png", x0 + w + g, TOP, w, CAP.examen);
  shot(s, "shots/validation.png", x0 + 2 * (w + g), TOP, w, CAP.valide);
  const y2 = TOP + h + 0.6, lw = 6.9, rx = M + lw + 0.4, rw = CW - lw - 0.4;
  examplesTable(c, s, M, y2, lw, 10);
  callout(s, M, 5.8, lw, 0.65, VISION, 12);
  button(s, rx, y2 + 0.05, rw, { key: "agorize5" });
  P(s, "Trois dossiers prêts à l'examen, sans connexion ni compte. " + PILOT, rx, y2 + 0.95, rw, 1.2, { fontSize: 10.5 });
  foot(s, "", n);
  s.addNotes("Trois captures du parcours, les trois exemples en tableau, la vision, et le bouton vers la démonstration.");
};
const solutionAgorize = ({ add, H2, COL, shot, table, callout, issue, foot }, n) => {
  const s = add();
  H2(s, "D'un contrat et d'un cas d'usage à un avis d'autorisation.", "La solution", "Solution");
  const lw = 5.0, rx = M + lw + 0.45, rw = CW - lw - 0.45;
  const h = shot(s, "shots/dossier.png", M, TOP, lw, CAP.dossier);
  callout(s, M, TOP + h + 0.55, lw, BOT - (TOP + h + 0.55), POSITION, 12.5);
  COL(s, "Ce que Custodix AI examine dans chaque contrat", rx, TOP, rw);
  table(s, rx, TOP + 0.45, rw, [rw * 0.33, rw * 0.42, rw * 0.25], ["Sujet", "Ce qui est vérifié", "Base"], EXAMEN, { size: 9.5, headSize: 9, rowH: 0.3 });
  const iy = 5.55, iw = rw / 3;
  ISSUES.forEach(([c, l, d], i) => issue(s, rx + i * iw, iy, iw - 0.1, c, l, d, { size: 10.5, descSize: 9 }));
  foot(s, "", n);
  s.addNotes("La solution : un dossier d'autorisation réel, ce qui est vérifié et sur quelle base, les trois issues, la phrase de positionnement.");
};

(async () => {
  await makeDeck("custodix-ai-oral.pptx", [cover, probleme, processus, solution, issuesSlide, kpmg, service, exemples, demoSlide, annexeRoute, annexeRisques, annexeEco], `${BRAND}, Make AI Happen 2026, thème 3, version orale`, ["Problème", "Solution", "Pourquoi KPMG", "Modèle de service", "Démonstration", "Annexes"]);
  await makeDeck("custodix-ai-agorize.pptx", [cover, problemeProcessus, solutionAgorize, kpmgService, demoAgorize], `${BRAND}, Make AI Happen 2026, thème 3`, ["Problème", "Solution", "KPMG et modèle de service", "Démonstration"]);
  fs.writeFileSync("link-positions.json", JSON.stringify(positions, null, 2));
})();
