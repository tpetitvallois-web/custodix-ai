// Deck « Custodix AI », Make AI Happen 2026 (KPMG), thème 3.
// Ton de cabinet d'avocats : fond blanc, anthracite, un seul accent bleu nuit, Charter pour les titres, Barlow pour le corps,
// une idée par slide, aucune icône, aucune carte. Les trois issues ont une pastille sobre, rien d'autre n'est coloré.
// Deux assemblages depuis les mêmes slides :
//   custodix-ai-oral.pptx    : 8 slides + 3 annexes (demi-finale, format libre)
//   custodix-ai-agorize.pptx : 5 slides (limite du formulaire, business plan inclus)
// NODE_PATH=$PWD/node_modules PPTX_SKILL=… node build.js
const pptxgen = require("pptxgenjs");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const BRAND = "Custodix AI";
const PAPER = "FFFFFF", INK = "26292E", MUTED = "6B6F76", LINE = "D9DBDF", NAVY = "10233F", SOFT = "F3F4F6";
const GREEN = "2E5E3F", AMBER = "9A6B1E", BRICK = "8E3B2F";
const SERIF = "Charter", BODY = "Barlow", SEMI = "Barlow SemiBold";
const THEME = { name: BRAND, headFontFace: SERIF, bodyFontFace: BODY, colors: { dk1: INK, lt1: PAPER, dk2: MUTED, lt2: SOFT, accent1: NAVY, accent2: MUTED, accent3: LINE, accent4: GREEN, accent5: AMBER, accent6: BRICK, hlink: NAVY, folHlink: MUTED } };
const W = 13.33, H = 7.5, M = 1.0, CW = W - 2 * M;
const DEMO_URL = process.env.DEMO_URL || "custodix-ai.gererseul-avis-worker.workers.dev";

function makeDeck(fileName, slides, title, sections) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.theme = { headFontFace: SERIF, bodyFontFace: BODY };
  pres.author = "Céline Lin, Tom Petit Vallois";
  pres.title = title;
  pres.defineSlideMaster({ title: "PAPER", background: { color: PAPER } });

  const T = (s, text, o = {}) => s.addText(text, Object.assign({ isTextBox: true, margin: 0, fontFace: BODY, fontSize: 15, color: INK, valign: "top" }, o));
  // En-tête : kicker de section en bleu nuit, titre, et navigation des sections en haut à droite (section active en bleu nuit).
  const H2 = (s, text, kicker, section) => {
    if (kicker) T(s, kicker, { x: M, y: 0.5, w: 7, h: 0.25, fontFace: SEMI, fontSize: 11, color: NAVY });
    T(s, text, { x: M, y: 0.76, w: CW - 0.2, h: 1.1, fontFace: SERIF, fontSize: 27, color: INK, lineSpacingMultiple: 1.1 });
    if (section && sections) {
      const runs = [];
      sections.forEach((name, i) => {
        const active = name === section;
        runs.push({ text: name.toUpperCase(), options: { color: active ? NAVY : "9A9DA3", fontFace: active ? SEMI : BODY, fontSize: 7.5, charSpacing: 0.6 } });
        if (i < sections.length - 1) runs.push({ text: "  |  ", options: { color: "C4C6CA", fontSize: 7.5 } });
      });
      s.addText(runs, { x: W - M - 8.5, y: 0.18, w: 8.5, h: 0.25, isTextBox: true, margin: 0, align: "right", valign: "top" });
    }
  };
  // Titre de colonne : bleu nuit, filet bleu nuit dessous.
  const COL = (s, text, x, y, w) => { T(s, text, { x, y, w, h: 0.3, fontFace: SEMI, fontSize: 14, color: NAVY }); rule(s, x, y + 0.36, w, NAVY, 1); };
  const LEAD = (s, text, x, y, w, h, o = {}) => T(s, text, Object.assign({ x, y, w, h, fontSize: 17, lineSpacingMultiple: 1.35 }, o));
  const P = (s, text, x, y, w, h, o = {}) => T(s, text, Object.assign({ x, y, w, h, fontSize: 14, color: MUTED, lineSpacingMultiple: 1.3 }, o));
  const SMALL = (s, text, x, y, w, h, o = {}) => T(s, text, Object.assign({ x, y, w, h, fontSize: 11, color: MUTED, lineSpacingMultiple: 1.25 }, o));
  // Pied : note ou source en petit, puis bandeau avec le logotype à gauche, la mention en tout petit, le numéro de page encadré à droite.
  const foot = (s, note, n) => {
    if (note) SMALL(s, note, M, 6.58, CW - 1.5, 0.3, { fontSize: 9 });
    rule(s, M, 6.98, CW, LINE, 0.75);
    T(s, BRAND, { x: M, y: 7.08, w: 1.6, h: 0.3, fontFace: SERIF, fontSize: 13, color: INK });
    T(s, "Projet étudiant, Make AI Happen 2026, KPMG, thématique 3. Contrats, fournisseurs et dossiers fictifs. Céline Lin et Tom Petit Vallois.", { x: M + 1.7, y: 7.13, w: 7.6, h: 0.25, fontSize: 6.5, color: "9A9DA3" });
    if (n) {
      T(s, "Avis d'autorisation des outils d'IA", { x: W - M - 3.0, y: 7.13, w: 2.3, h: 0.25, fontSize: 6.5, color: "9A9DA3", align: "right" });
      s.addShape(pres.ShapeType.line, { x: W - M - 0.58, y: 7.08, w: 0, h: 0.3, line: { color: LINE, width: 0.75 } });
      T(s, String(n), { x: W - M - 0.5, y: 7.1, w: 0.5, h: 0.28, fontSize: 9, color: INK, align: "right", valign: "middle" });
    }
  };
  const rule = (s, x, y, w, color = LINE, pt = 0.75) => s.addShape(pres.ShapeType.line, { x, y, w, h: 0, line: { color, width: pt } });
  const dot = (s, x, y, color, d = 0.14) => s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0 } });
  // Enchaînement d'étapes : filet bleu nuit, cercles creux, le dernier plein.
  const steps = (s, x, y, w, items, { labelSize = 15, descSize = 13, descH = 0.9, fillLast = true } = {}) => {
    const step = w / items.length;
    rule(s, x, y, w - step + 0.16, NAVY, 1);
    items.forEach((it, i) => {
      const cx = x + i * step, last = fillLast && i === items.length - 1;
      s.addShape(pres.ShapeType.ellipse, { x: cx, y: y - 0.08, w: 0.16, h: 0.16, fill: { color: last ? NAVY : PAPER }, line: { color: NAVY, width: 1 } });
      T(s, it.label, { x: cx, y: y + 0.22, w: step - 0.25, h: 0.5, fontFace: SERIF, fontSize: labelSize, lineSpacingMultiple: 1.15 });
      if (it.desc) T(s, it.desc, { x: cx, y: y + 0.22 + (it.two ? 0.62 : 0.36), w: step - 0.3, h: descH, fontSize: descSize, color: MUTED, lineSpacingMultiple: 1.3 });
    });
  };
  // Les trois issues : pastille sobre, libellé en serif, description.
  const issues = (s, x, y, w, items, { rowH = 0.7, labW = 2.6, size = 14 } = {}) => {
    items.forEach(([color, lab, desc], i) => {
      const yy = y + i * rowH;
      if (i < items.length - 1) rule(s, x, yy + rowH - 0.1, w);
      dot(s, x, yy + 0.09, color);
      T(s, lab, { x: x + 0.3, y: yy, w: labW - 0.3, h: rowH - 0.1, fontFace: SERIF, fontSize: size + 1, lineSpacingMultiple: 1.2 });
      T(s, desc, { x: x + labW, y: yy + 0.02, w: w - labW, h: rowH - 0.1, fontSize: size, color: MUTED, lineSpacingMultiple: 1.3 });
    });
  };
  // Liste numérotée : numéro en serif bleu nuit, titre, description.
  const numbered = (s, x, y, w, items, { rowH = 0.85, size = 14 } = {}) => {
    items.forEach(([t, d], i) => {
      const yy = y + i * rowH;
      T(s, String(i + 1), { x, y: yy - 0.02, w: 0.4, h: 0.4, fontFace: SERIF, fontSize: 18, color: NAVY });
      T(s, t, { x: x + 0.45, y: yy, w: w - 0.45, h: 0.3, fontFace: SEMI, fontSize: size });
      if (d) T(s, d, { x: x + 0.45, y: yy + 0.3, w: w - 0.45, h: rowH - 0.3, fontSize: size - 1, color: MUTED, lineSpacingMultiple: 1.3 });
    });
  };
  const dashes = (s, items, x, y, w, h, size = 14) => s.addText(items.map((t, i) => ({ text: t, options: { bullet: { code: "2013" }, breakLine: i < items.length - 1 } })), { x, y, w, h, isTextBox: true, margin: 0, fontFace: BODY, fontSize: size, color: INK, paraSpaceAfter: 8, lineSpacingMultiple: 1.25, valign: "top" });
  const rows = (s, x, y, w, items, { labW = 2.0, size = 13, rowH = 0.5 } = {}) => {
    items.forEach(([a, b], i) => {
      const yy = y + i * rowH;
      rule(s, x, yy + rowH, w);
      T(s, a, { x, y: yy + 0.06, w: labW - 0.15, h: rowH - 0.1, fontFace: SEMI, fontSize: size, lineSpacingMultiple: 1.2 });
      T(s, b, { x: x + labW, y: yy + 0.06, w: w - labW, h: rowH - 0.1, fontSize: size, color: MUTED, lineSpacingMultiple: 1.2 });
    });
  };
  const add = () => pres.addSlide({ masterName: "PAPER" });
  const link = (s, prefix, x, y, w, size = 12) => s.addText([
    { text: prefix, options: { color: MUTED } },
    { text: DEMO_URL, options: { color: NAVY, underline: { style: "sng" }, hyperlink: { url: "https://" + DEMO_URL + "/", tooltip: "Ouvrir la démonstration" } } },
  ], { x, y, w, h: 0.3, isTextBox: true, margin: 0, fontFace: BODY, fontSize: size, valign: "top" });
  const shot = (s, path, x, y, w, h) => {
    s.addImage({ path, x, y, w, h });
    s.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { type: "none" }, line: { color: LINE, width: 0.75 } });
  };
  const ctx = { pres, T, H2, COL, LEAD, P, SMALL, foot, rule, dot, steps, issues, numbered, dashes, rows, add, link, shot };
  slides.forEach((fn, i) => fn(ctx, i + 1, slides.length));
  return pres.writeFile({ fileName }).then(() => applyTheme(fileName, THEME)).then(() => console.log("ok", fileName));
}

// ───────────────────────── Slides
const cover = ({ add, T, rule, foot }, n) => {
  const s = add();
  T(s, "Make AI Happen, KPMG | Thématique 3 : cabinet d'avocats AI ready", { x: M, y: 0.9, w: CW, h: 0.3, fontSize: 12, color: MUTED });
  T(s, BRAND, { x: M, y: 2.15, w: CW, h: 1.1, fontFace: SERIF, fontSize: 60, color: INK });
  rule(s, M, 3.4, 1.6, NAVY, 1.5);
  T(s, "Chaque IA passe par Custodix.", { x: M, y: 3.65, w: CW, h: 0.6, fontFace: SERIF, fontSize: 26, color: NAVY });
  T(s, "Autorisation et gouvernance des outils d'intelligence artificielle en entreprise.", { x: M, y: 4.35, w: 8.5, h: 0.4, fontSize: 17, color: INK });
  T(s, "Un service conçu pour les directions juridiques, conformité, achats et IT.", { x: M, y: 4.8, w: 8.5, h: 0.4, fontSize: 15, color: MUTED });
  T(s, "Préparé par Céline Lin et Tom Petit Vallois", { x: M, y: 6.3, w: 8, h: 0.3, fontSize: 13, color: INK });
  foot(s, "", 0);
  s.addNotes("Couverture. Le nom, la promesse en une phrase, le sous-titre qui dit ce que c'est. Rien d'autre.");
};

const probleme = ({ add, H2, LEAD, P, T, rule, foot }, n) => {
  const s = add();
  H2(s, "Les entreprises adoptent l'IA sans maîtriser ses conditions d'usage.", "Le contexte", "Problème");
  LEAD(s, "Chaque nouvel outil IA soulève les mêmes questions : quelles données sont utilisées, par qui, où sont-elles conservées, et quelles obligations en découlent ?", M, 2.4, 8.6, 1.2);
  const y = 4.2, cw = CW / 3, items = [
    ["Un outil IA entre dans l'entreprise", "chatbot, outil RH, marketing, analyse de documents, assistant de code"],
    ["Il touche des données, des équipes et des fournisseurs", "clients, salariés, documents confidentiels, sous-traitants"],
    ["La question reste ouverte", "peut-il être utilisé, et à quelles conditions ?"],
  ];
  rule(s, M, y, CW, NAVY, 1);
  items.forEach(([a, b], i) => {
    const x = M + i * cw;
    T(s, String(i + 1), { x, y: y + 0.2, w: 0.5, h: 0.4, fontFace: SERIF, fontSize: 18, color: NAVY });
    T(s, a, { x, y: y + 0.6, w: cw - 0.5, h: 0.7, fontFace: SERIF, fontSize: 16, lineSpacingMultiple: 1.2 });
    P(s, b, x, y + 1.35, cw - 0.5, 0.7, { fontSize: 13 });
  });
  foot(s, "Source : Microsoft et LinkedIn, Work Trend Index 2024 : 78 % des utilisateurs d'IA au travail apportent leurs propres outils, sans validation de l'entreprise.", n);
  s.addNotes("Une idée : l'adoption va plus vite que la maîtrise. Le chiffre reste en source, en bas.");
};

const processus = ({ add, H2, LEAD, steps, foot }, n) => {
  const s = add();
  H2(s, "Aujourd'hui, l'autorisation d'un outil IA repose sur des échanges dispersés.", "Le processus actuel", "Problème");
  LEAD(s, "Achats, juridique, DPO et IT examinent le même dossier séparément. Il manque une vue commune, une traçabilité et une décision formalisée.", M, 2.4, 8.6, 1.2);
  steps(s, M, 4.5, CW, [
    { label: "Demande métier", desc: "un outil, un contrat de fournisseur, souvent en anglais" },
    { label: "Examens séparés", desc: "achats, juridique, DPO, IT, chacun sa part" },
    { label: "Décision difficile à tracer", desc: "déployé sans réponse, ou refusé par prudence" },
  ], { fillLast: false });
  foot(s, "", n);
  s.addNotes("Le processus actuel en trois temps. Pas de liste des huit questions ici : elles sont dans la démonstration.");
};

const solution = ({ add, H2, LEAD, steps, rule, T, foot }, n) => {
  const s = add();
  H2(s, "Custodix AI transforme un contrat et un cas d'usage en avis d'autorisation.", "La solution", "Solution");
  LEAD(s, "Pour chaque outil IA, Custodix AI analyse le contrat, le cas d'usage et les données concernées. Il prépare un avis clair, sourcé et traçable, validé par un avocat.", M, 2.4, 9.0, 1.2);
  steps(s, M, 4.3, CW, [
    { label: "Contrat et cas d'usage", desc: "déposés par le client" },
    { label: "Analyse des clauses et des risques", desc: "RGPD, AI Act, clauses citées", two: true },
    { label: "Avis d'autorisation préparé", desc: "conditions, mesures, avenant type", two: true },
    { label: "Validation par un avocat", desc: "l'avis entre au registre" },
  ]);
  rule(s, M, 5.95, CW, NAVY, 1);
  T(s, "Custodix AI ne remplace pas la gestion contractuelle ni l'avocat. Il prépare une décision d'usage, documentée et validée par un expert.", { x: M, y: 6.07, w: CW, h: 0.55, fontFace: SERIF, fontSize: 16, color: NAVY, lineSpacingMultiple: 1.2 });
  foot(s, "", n);
  s.addNotes("La slide la plus importante. La phrase du bas est à répéter à l'oral : ni la gestion contractuelle, ni l'avocat ne sont remplacés.");
};

const ISSUES = [
  [GREEN, "Autorisé", "l'outil peut être déployé dans le périmètre décrit"],
  [AMBER, "Autorisé sous conditions", "des mesures ou un avenant sont nécessaires avant un déploiement élargi"],
  [BRICK, "Non autorisé en l'état", "le risque est trop élevé ou le contrat doit être modifié"],
];
const issuesSlide = ({ add, H2, issues, LEAD, foot }, n) => {
  const s = add();
  H2(s, "Trois issues possibles, toujours documentées.", "La solution", "Solution");
  issues(s, M, 2.6, CW, ISSUES, { rowH: 0.95, labW: 3.6, size: 16 });
  LEAD(s, "Chaque avis mentionne les clauses analysées, les risques identifiés et les mesures recommandées.", M, 5.7, CW, 0.6, { fontSize: 16, color: MUTED });
  foot(s, "", n);
  s.addNotes("Trois issues, trois pastilles sobres. Le reste de la fiche est montré dans la démonstration.");
};

const KPMG_ITEMS = [
  "Expertise juridique, fiscale, conformité et cybersécurité",
  "Validation humaine par des avocats",
  "Intégration possible aux outils de gestion contractuelle déjà en place",
  "Déploiement multi-pays",
  "Accompagnement continu : veille, avenants, gouvernance et reporting",
];
const KPMG_LINE = "Les plateformes contractuelles structurent les contrats. Custodix AI aide à décider comment un outil IA peut être utilisé.";
const kpmg = ({ add, H2, dashes, LEAD, foot }, n) => {
  const s = add();
  H2(s, "Un service qui réunit expertise juridique, conformité et exécution.", "Pourquoi KPMG", "Pourquoi KPMG");
  dashes(s, KPMG_ITEMS, M, 2.5, 8.5, 2.8, 16);
  LEAD(s, KPMG_LINE, M, 5.6, CW, 0.7, { fontSize: 16, color: MUTED });
  foot(s, "", n);
  s.addNotes("Pourquoi un cabinet, et pourquoi KPMG : les expertises, la validation par des avocats, l'intégration au CLM existant, le multi-pays, l'accompagnement.");
};

const SERVICE = [
  ["Diagnostic initial", "Cartographie des outils IA existants et de leurs niveaux de risque."],
  ["Autorisation continue", "Examen des nouveaux outils avant déploiement."],
  ["Accompagnement contractuel", "Rédaction ou négociation d'avenants lorsque cela est nécessaire."],
  ["Suivi et gouvernance", "Registre des outils autorisés, revue périodique et reporting."],
];
const SERVICE_NOTE = "Modalités et tarification à définir avec KPMG Avocats lors du pilote.";
const service = ({ add, H2, numbered, P, foot }, n) => {
  const s = add();
  H2(s, "Un modèle de service progressif.", "Modèle de service", "Modèle de service");
  numbered(s, M, 2.5, 9, SERVICE, { rowH: 0.9, size: 16 });
  P(s, SERVICE_NOTE, M, 6.2, CW, 0.4, { fontSize: 13 });
  foot(s, "", n);
  s.addNotes("Quatre briques, dans l'ordre où un client les achète. Les hypothèses chiffrées sont en annexe.");
};

const EXAMPLES = [
  [GREEN, "Outil marketing sans données personnelles", "autorisé"],
  [AMBER, "Chatbot de support client utilisant des conversations", "autorisé sous conditions"],
  [BRICK, "Outil de tri de CV avec entraînement sur les documents fournis", "non autorisé en l'état"],
];
const VISION = "À terme, chaque outil IA autorisé dans l'entreprise dispose d'un dossier daté, sourcé et validé.";
const exemples = ({ add, H2, issues, rule, T, link, foot }, n) => {
  const s = add();
  H2(s, "Trois exemples, une même logique de décision.", "Démonstration", "Démonstration");
  issues(s, M, 2.6, CW, EXAMPLES, { rowH: 0.85, labW: 7.2, size: 16 });
  rule(s, M, 5.5, CW, NAVY, 1);
  T(s, VISION, { x: M, y: 5.65, w: CW, h: 0.6, fontFace: SERIF, fontSize: 18, color: NAVY, lineSpacingMultiple: 1.2 });
  link(s, "Démonstration en ligne : ", M, 6.58, CW - 1.5, 9);
  foot(s, "", n);
  s.addNotes("Les trois exemples sont ceux de la démonstration, à montrer ici si le temps le permet. Puis la vision, en une phrase.");
};

// Slide orale : la démonstration, deux captures.
const demoSlide = ({ add, H2, shot, P, link, foot }, n) => {
  const s = add();
  H2(s, "La démonstration en ligne : un dossier d'autorisation, de l'examen à l'avis.", "Démonstration", "Démonstration");
  const y = 2.35, h = 3.5, w1 = h * 2560 / 1500, w2 = h * 1900 / 1400, g = CW - w1 - w2;
  shot(s, "shots/dossier-haut.png", M, y, w1, h);
  shot(s, "shots/risques.png", M + w1 + g, y, w2, h);
  P(s, "L'avis, le niveau de vigilance et le dossier, en attente de validation par un avocat.", M, y + h + 0.12, w1, 0.5, { fontSize: 12 });
  P(s, "Chaque risque cite la clause du contrat et l'article applicable.", M + w1 + g, y + h + 0.12, w2, 0.5, { fontSize: 12 });
  link(s, "Démonstration en ligne, trois dossiers prêts à l'examen : ", M, 6.55, CW, 12);
  foot(s, "", n);
  s.addNotes("La démonstration en deux captures : le dossier RecruiterAI (non autorisé en l'état, 96 sur 100) et les risques, chacun avec la clause citée. Le lien est cliquable.");
};

// ───────────────────────── Annexes (version orale)
const annexeRoute = ({ add, H2, steps, foot }, n) => {
  const s = add();
  H2(s, "Feuille de route : un pilote de trois mois, une offre complète en douze.", "Annexe", "Annexes");
  steps(s, M, 3.2, CW, [
    { label: "Mois 1 à 3", desc: "pilote avec deux grands comptes, vingt outils, règles RGPD et AI Act, un avocat référent par dossier" },
    { label: "Mois 4 à 6", desc: "examen des contrats assisté par un modèle de langage, connexion aux outils de gestion contractuelle, avenants" },
    { label: "Mois 7 à 12", desc: "registre groupe, veille réglementaire, accompagnement continu" },
  ], { fillLast: false, descH: 1.2 });
  foot(s, "", n);
};
const annexeRisques = ({ add, H2, rows, foot }, n) => {
  const s = add();
  H2(s, "Risques identifiés et mesures prévues.", "Annexe", "Annexes");
  rows(s, M, 2.6, CW, [
    ["Fausse assurance", "chaque risque cite la clause et l'article ; la qualification est explicable ; un avocat valide"],
    ["Erreur d'examen", "citations vérifiées mot pour mot dans le contrat ; niveau de confiance ; relecture humaine"],
    ["Responsabilité", "l'avis est une décision d'usage interne, préparée pour le client, pas une consultation sur le contrat"],
    ["Confidentialité", "contrats hébergés en Union européenne, cloisonnés par client, jamais utilisés pour entraîner un modèle"],
    ["Adoption", "livré dans les outils déjà en place : gestion contractuelle, messagerie, registre"],
  ], { labW: 2.3, size: 14, rowH: 0.62 });
  foot(s, "", n);
};
const annexeEco = ({ add, H2, rows, P, foot }, n) => {
  const s = add();
  H2(s, "Hypothèses économiques, à valider lors du pilote.", "Annexe", "Annexes");
  rows(s, M, 2.6, CW, [
    ["Diagnostic initial", "mission ponctuelle, de l'ordre de 40 à 80 k€ par grand compte selon la taille du parc"],
    ["Autorisation continue", "abonnement annuel, de l'ordre de 60 k€ par grand compte, pour 30 à 60 outils examinés par an"],
    ["Accompagnement contractuel", "missions d'avenants et de gouvernance, 20 à 150 k€ selon les cas"],
    ["Suivi et gouvernance", "service managé, de l'ordre de 120 k€ par an"],
  ], { labW: 3.0, size: 14, rowH: 0.62 });
  P(s, "Hypothèses de travail : deux heures d'avocat par dossier grâce à la préparation assistée ; dix clients la première année, quarante la deuxième, cent la troisième. Ces ordres de grandeur sont à confronter aux grilles de KPMG Avocats.", M, 5.4, CW, 0.9, { fontSize: 13 });
  foot(s, "", n);
};

// ───────────────────────── Slides condensées (version Agorize, 5 slides)
const problemeProcessus = ({ add, H2, LEAD, steps, foot }, n) => {
  const s = add();
  H2(s, "Les entreprises adoptent l'IA sans maîtriser ses conditions d'usage.", "Le contexte", "Problème");
  LEAD(s, "Chaque nouvel outil IA soulève les mêmes questions : quelles données sont utilisées, par qui, où sont-elles conservées, et quelles obligations en découlent ? Aujourd'hui, achats, juridique, DPO et IT examinent le même dossier séparément, sans vue commune ni décision formalisée.", M, 2.4, 10.2, 1.6);
  steps(s, M, 4.7, CW, [
    { label: "Demande métier", desc: "un outil, un contrat de fournisseur" },
    { label: "Examens séparés", desc: "achats, juridique, DPO, IT, chacun sa part" },
    { label: "Décision difficile à tracer", desc: "déployé sans réponse, ou refusé par prudence" },
  ], { fillLast: false });
  foot(s, "Source : Microsoft et LinkedIn, Work Trend Index 2024 : 78 % des utilisateurs d'IA au travail apportent leurs propres outils, sans validation de l'entreprise.", n);
  s.addNotes("Le problème et le processus actuel, en une slide.");
};
const solutionIssues = ({ add, H2, LEAD, steps, issues, rule, T, foot }, n) => {
  const s = add();
  H2(s, "Custodix AI transforme un contrat et un cas d'usage en avis d'autorisation.", "La solution", "Solution");
  LEAD(s, "Pour chaque outil IA, Custodix AI analyse le contrat, le cas d'usage et les données concernées, puis prépare un avis clair, sourcé et traçable, validé par un avocat.", M, 2.3, 10.2, 0.9, { fontSize: 16 });
  steps(s, M, 3.5, CW, [
    { label: "Contrat et cas d'usage", desc: "déposés par le client" },
    { label: "Analyse des clauses et des risques", desc: "RGPD, AI Act, clauses citées", two: true },
    { label: "Avis d'autorisation préparé", desc: "conditions, mesures, avenant type", two: true },
    { label: "Validation par un avocat", desc: "l'avis entre au registre" },
  ], { labelSize: 14, descSize: 12, descH: 0.5 });
  issues(s, M, 5.05, CW, ISSUES, { rowH: 0.42, labW: 3.0, size: 12.5 });
  rule(s, M, 6.32, CW, NAVY, 1);
  T(s, "Custodix AI ne remplace pas la gestion contractuelle ni l'avocat. Il prépare une décision d'usage, documentée et validée par un expert.", { x: M, y: 6.42, w: CW, h: 0.4, fontFace: SERIF, fontSize: 13.5, color: NAVY });
  foot(s, "", n);
  s.addNotes("La solution, le flux en quatre étapes, les trois issues possibles, et la phrase de positionnement.");
};
const kpmgService = ({ add, H2, COL, dashes, numbered, T, P, foot }, n) => {
  const s = add();
  H2(s, "Un service qui réunit expertise juridique, conformité et exécution.", "Pourquoi KPMG", "KPMG et modèle de service");
  const lw = 5.3, rx = M + lw + 0.6, rw = CW - lw - 0.6;
  COL(s, "Pourquoi un cabinet, et pourquoi KPMG", M, 2.3, lw);
  dashes(s, KPMG_ITEMS, M, 2.8, lw, 2.8, 13.5);
  P(s, KPMG_LINE, M, 5.5, lw, 0.8, { fontSize: 12.5 });
  COL(s, "Un modèle de service progressif", rx, 2.3, rw);
  numbered(s, rx, 2.85, rw, SERVICE, { rowH: 0.72, size: 13.5 });
  P(s, SERVICE_NOTE + " Business plan : missions ponctuelles pour le diagnostic et les avenants, revenu récurrent par l'autorisation continue et le suivi ; hypothèses chiffrées dans le rapport écrit.", rx, 5.75, rw, 0.9, { fontSize: 11.5 });
  foot(s, "", n);
  s.addNotes("Pourquoi KPMG à gauche, le modèle de service à droite, sans prix affiché : les hypothèses sont dans le rapport écrit et en annexe du deck oral.");
};
const exemplesVision = ({ add, H2, issues, rule, T, P, shot, link, foot }, n) => {
  const s = add();
  H2(s, "Trois exemples, une même logique de décision.", "Démonstration", "Démonstration");
  const lw = 5.5, rx = M + lw + 0.45, rw = CW - lw - 0.45;
  issues(s, M, 2.4, lw, EXAMPLES, { rowH: 0.82, labW: 3.4, size: 12.5 });
  P(s, "Pilote proposé : trois mois, deux grands comptes, vingt outils examinés, un avocat référent par dossier.", M, 4.95, lw, 0.6, { fontSize: 12.5 });
  rule(s, M, 5.6, lw, NAVY, 1);
  T(s, VISION, { x: M, y: 5.72, w: lw, h: 0.9, fontFace: SERIF, fontSize: 15.5, color: NAVY, lineSpacingMultiple: 1.2 });
  const h = rw * 1500 / 2560;
  shot(s, "shots/dossier-haut.png", rx, 2.4, rw, h);
  P(s, "Dossier RecruiterAI dans la démonstration : avis, niveau de vigilance, risques avec la clause citée, avenant type.", rx, 2.4 + h + 0.12, rw, 0.5, { fontSize: 11.5 });
  link(s, "Démonstration en ligne : ", rx, 2.4 + h + 0.72, rw, 11.5);
  foot(s, "", n);
  s.addNotes("Les trois exemples, le pilote en une ligne, la vision, et une capture du dossier RecruiterAI. Le lien vers la démonstration est cliquable.");
};

(async () => {
  await makeDeck("custodix-ai-oral.pptx", [cover, probleme, processus, solution, issuesSlide, kpmg, service, exemples, demoSlide, annexeRoute, annexeRisques, annexeEco], `${BRAND}, Make AI Happen 2026, thème 3, version orale`, ["Problème", "Solution", "Pourquoi KPMG", "Modèle de service", "Démonstration", "Annexes"]);
  await makeDeck("custodix-ai-agorize.pptx", [cover, problemeProcessus, solutionIssues, kpmgService, exemplesVision], `${BRAND}, Make AI Happen 2026, thème 3`, ["Problème", "Solution", "KPMG et modèle de service", "Démonstration"]);
})();
