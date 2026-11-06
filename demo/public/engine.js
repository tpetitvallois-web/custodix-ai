// Moteur d'analyse Aucteva, version de démonstration : règles déterministes, sans appel réseau.
// Il examine le contrat, repère les clauses critiques, croise avec le cas d'usage et les données, qualifie le risque sur 100 (niveau de vigilance)
// La même structure de sortie (voir contenu/schema-decision.json) est prévue pour une version
// où la lecture du contrat est confiée à Claude : seul le module « extraction » change.

export const BRAND = "Aucteva";
export const MENTION = `Avis préparé par ${BRAND}. Validation par un avocat requise avant tout déploiement.`;

const norm = (t) => (t || "").replace(/’/g, "'").replace(/\s+/g, " ");
// Les retours à la ligne séparent les phrases : un intertitre ne se colle pas à la phrase qui le suit.
const sentences = (t) => (t || "").split(/\n+/).flatMap((line) => norm(line).split(/(?<=[.;])\s+(?=[A-ZÀ-Ý«"])/)).map((x) => x.trim()).filter(Boolean);

// Chaque sujet : les motifs qui rendent une clause protectrice, ambiguë ou dangereuse.
// « applies » dit quand l'absence de clause compte comme un manque.
export const TOPICS = [
  {
    id: "training", label: "Entraînement des modèles sur les données du Client",
    legal: "RGPD art. 5.1.b (finalité) et art. 28.3.a (instructions documentées)",
    applies: () => true, weightAbsent: 8,
    dangerous: [/(entra[iî]n(er|ement)|affiner)[^.]{0,120}mod[èe]les?/i, /licence[^.]{0,160}entra[iî]n/i],
    ambiguous: [/am[ée]liorer[^.]{0,80}(mod[èe]les|services|produits|qualit[ée])/i, /donn[ée]es d[ée]riv[ée]es/i, /programmes? d'am[ée]lioration/i],
    protective: [/s'interdit[^.]{0,80}(entra[iî]n|affiner|am[ée]liorer)/i, /(n'utilise|n'utilisera|ne sont pas utilis|ne seront pas utilis)[^.]{0,120}(entra[iî]n|affiner|am[ée]liorer[^.]{0,40}mod[èe]les?)/i, /aucune? (donn[ée]e|contenu)[^.]{0,60}(entra[iî]n|affin)/i, /uniquement pour fournir le service/i],
    fix: "Le Fournisseur s'interdit d'utiliser les données, documents, requêtes et résultats du Client pour entraîner, affiner, tester ou améliorer tout modèle d'intelligence artificielle, le sien ou celui d'un tiers. Les programmes d'amélioration sont désactivés par défaut pour le Client.",
  },
  {
    id: "retention", label: "Durée de conservation et suppression",
    legal: "RGPD art. 5.1.e (limitation de la conservation) et art. 28.3.g (suppression ou restitution)",
    applies: () => true, weightAbsent: 6,
    dangerous: [/(cinq|5|dix|10) \(?\d?\)? ?ans apr[èe]s/i, /perp[ée]tuel/i, /int[ée]r[êe]ts l[ée]gitimes/i],
    ambiguous: [/aussi longtemps que n[ée]cessaire/i, /politiques internes/i, /conserv[ée]s? (pendant|durant) toute la dur[ée]e du contrat(?! et)/i],
    protective: [/(trente|30|soixante|60|quatre-vingt-dix|90) \(?\d*\)? ?jours[^.]{0,60}supprim/i, /certificat de suppression/i, /suppression anticip[ée]e/i],
    fix: "Les données du Client sont supprimées au plus tard trente (30) jours après la fin de leur utilisation et, en tout état de cause, à la fin du contrat, avec remise d'un certificat de suppression. Aucune conservation à des fins propres du Fournisseur n'est autorisée.",
  },
  {
    id: "transfer", label: "Localisation et transferts hors Union européenne",
    legal: "RGPD art. 44 à 46 (transferts), clauses contractuelles types 2021/914",
    applies: (c) => c.personal, weightAbsent: 6,
    dangerous: [/(trait[ée]e?s?|stock[ée]e?s?|h[ée]berg[ée]e?s?)[^.]{0,80}(en inde|tout autre pays)/i, /efforts raisonnables pour respecter/i],
    ambiguous: [/union europ[ée]enne ou aux [ée]tats-unis/i, /selon la configuration/i, /besoins op[ée]rationnels/i],
    protective: [/exclusivement dans l'union europ[ée]enne/i, /aucun transfert[^.]{0,60}hors de l'union/i, /h[ée]berg[ée]s? en france/i],
    fix: "Les données du Client sont hébergées et traitées exclusivement dans l'Union européenne. Tout transfert vers un pays tiers requiert l'accord écrit préalable du Client, l'adoption des clauses contractuelles types et une analyse d'impact du transfert.",
  },
  {
    id: "subprocessors", label: "Sous-traitants ultérieurs",
    legal: "RGPD art. 28.2 et 28.4",
    applies: (c) => c.personal, weightAbsent: 5,
    dangerous: [/sans notification pr[ée]alable/i, /tout sous-traitant de son choix/i],
    ambiguous: [/disponible sur demande/i, /mise [àa] jour de sa page/i],
    protective: [/liste des sous-traitants[^.]{0,60}annexe/i, /notifi[ée]e? au client (trente|30)/i, /pouvant s'y opposer/i],
    fix: "La liste des sous-traitants ultérieurs est annexée au contrat. Tout ajout ou remplacement est notifié au Client au moins trente (30) jours à l'avance ; le Client peut s'y opposer et, à défaut d'accord, résilier sans frais.",
  },
  {
    id: "breach", label: "Notification des violations de données",
    legal: "RGPD art. 33.2 (le sous-traitant notifie sans délai) et art. 33.1 (72 heures pour le responsable)",
    applies: (c) => c.personal || c.confidential, weightAbsent: 6,
    dangerous: [/sans engagement de d[ée]lai/i, /lorsqu'elle l'estimera n[ée]cessaire/i],
    ambiguous: [/d[ée]lai raisonnable/i, /compte tenu des circonstances/i],
    protective: [/(violation|incident|notifi)[^.]{0,160}(24|vingt-quatre|48|quarante-huit|72|soixante-douze) \(?\d*\)? ?heures/i, /(24|vingt-quatre|48|quarante-huit|72|soixante-douze) \(?\d*\)? ?heures[^.]{0,160}(violation|incident)/i],
    fix: "Toute violation de données à caractère personnel ou tout incident de sécurité affectant les données du Client est notifié au Client dans les vingt-quatre (24) heures suivant sa découverte, avec les informations prévues à l'article 33.3 du RGPD, puis complété au fil de l'enquête.",
  },
  {
    id: "audit", label: "Droit d'audit",
    legal: "RGPD art. 28.3.h",
    applies: (c) => c.personal || c.confidential, weightAbsent: 5,
    dangerous: [/renonce [àa] tout droit d'audit/i],
    ambiguous: [/tient lieu de r[ée]ponse aux demandes d'audit/i, /rapport soc 2/i, /attestation de conformit[ée]/i],
    protective: [/peut[^.]{0,60}auditer ou faire auditer/i, /dispose d'un droit d'audit/i, /droit d'audit[^.]{0,40}(annuel|une fois|sur site et sur documents)/i],
    fix: "Le Client, ou un tiers indépendant mandaté par lui, peut auditer une fois par an, et à tout moment en cas d'incident ou de demande d'une autorité, le respect par le Fournisseur de ses obligations. Le Fournisseur communique en outre ses rapports d'audit indépendants.",
  },
  {
    id: "security", label: "Mesures de sécurité et chiffrement",
    legal: "RGPD art. 32",
    applies: () => true, weightAbsent: 5,
    dangerous: [/qu'elle juge appropri[ée]es/i],
    ambiguous: [/raisonnables et conformes aux standards/i, /chiffr[ée]es en transit\.?(?![^.]*repos)/i],
    protective: [/aes-?256/i, /iso ?27001/i, /chiffr[ée]es? en transit[^.]{0,40}et au repos/i],
    fix: "Les données du Client sont chiffrées en transit (TLS 1.2 minimum) et au repos (AES-256). Le Fournisseur maintient une certification ISO 27001 ou équivalente et en communique le certificat chaque année.",
  },
  {
    id: "outputs", label: "Propriété des contenus et résultats générés",
    legal: "Droit des contrats et propriété intellectuelle (code de la propriété intellectuelle)",
    applies: () => true, weightAbsent: 4,
    dangerous: [/demeurent la propri[ée]t[ée] de (talentscan|du fournisseur|nimbus)/i, /mod[èe]les d[ée]riv[ée]s sont[^.]{0,40}propri[ée]t[ée]/i],
    ambiguous: [/droit d'usage interne non exclusif/i],
    protective: [/client est (titulaire|propri[ée]taire)[^.]{0,80}(contenus|r[ée]ponses|r[ée]sultats) g[ée]n[ée]r[ée]/i, /ne revendique aucun droit/i],
    fix: "Le Client est titulaire de l'ensemble des droits sur les résultats, scores, contenus et données dérivées produits à partir de ses données. Le Fournisseur ne les réutilise pas et n'en conserve aucune copie au-delà de la fourniture du service.",
  },
  {
    id: "liability", label: "Responsabilité du Fournisseur",
    legal: "Code civil, art. 1170 (clause privant de sa substance l'obligation essentielle réputée non écrite)",
    applies: () => true, weightAbsent: 4,
    dangerous: [/exclut toute responsabilit[ée]/i, /garantit (talentscan|le fournisseur) contre toute r[ée]clamation/i],
    ambiguous: [/six \(6\) mois/i, /pas responsable des dommages indirects, y compris les pertes de donn[ée]es/i],
    protective: [/douze \(12\) derniers mois/i, /plafond ne s'applique pas/i],
    fix: "La responsabilité du Fournisseur est plafonnée à douze (12) mois de redevances, sans plafond en cas de manquement aux obligations de confidentialité, de sécurité ou de protection des données personnelles, ni en cas de sanction prononcée par une autorité du fait du Fournisseur.",
  },
  {
    id: "automated", label: "Décision automatisée et supervision humaine",
    legal: "RGPD art. 22 ; AI Act art. 14 (contrôle humain) et art. 26 (obligations du déployeur)",
    applies: (c) => c.affectsPeople, weightAbsent: 8,
    dangerous: [/classement[^.]{0,40}produit automatiquement/i, /ne garantit[^.]{0,80}(biais|exactitude des scores)/i],
    ambiguous: [/recommande[^.]{0,40}supervision humaine/i],
    protective: [/(validation|supervision|contr[ôo]le) humaine? (obligatoire|syst[ée]matique)/i, /aucune d[ée]cision[^.]{0,60}automatis[ée]e/i],
    fix: "Aucune décision produisant des effets juridiques ou significatifs sur une personne n'est prise sur le seul fondement du traitement automatisé. Le Fournisseur documente la logique du système, fournit les indicateurs de biais mesurés par groupe et permet au Client de désactiver tout classement automatique.",
  },
  {
    id: "transparency", label: "Transparence sur l'usage de l'IA",
    legal: "AI Act art. 50 (applicable depuis le 2 août 2026) ; RGPD art. 13 et 14",
    applies: (c) => c.category === "chatbot" || c.category === "support" || c.category === "marketing", weightAbsent: 4,
    dangerous: [],
    ambiguous: [],
    protective: [/informe le client que les contenus sont g[ée]n[ée]r[ée]s/i, /marquage des contenus/i, /g[ée]n[ée]r[ée]s? par un syst[èe]me d'intelligence artificielle/i],
    fix: "Le Fournisseur met à disposition les fonctions nécessaires pour informer les personnes qu'elles interagissent avec un système d'IA et pour marquer les contenus générés, conformément à l'article 50 de l'AI Act.",
  },
  {
    id: "changes", label: "Modification unilatérale du contrat",
    legal: "Code civil, art. 1193 (le contrat ne se modifie que du consentement mutuel)",
    applies: () => true, weightAbsent: 0, // son absence n'est pas un manque
    dangerous: [/modifier les pr[ée]sentes conditions [àa] tout moment/i, /d[èe]s leur publication/i],
    ambiguous: [/peut modifier les pr[ée]sentes conditions moyennant un pr[ée]avis/i, /susceptible d'[êe]tre mis [àa] jour/i],
    protective: [],
    fix: "Toute modification des conditions contractuelles, de l'accord de traitement des données ou de la liste des sous-traitants requiert l'accord écrit du Client.",
  },
];

const CATEGORY_RISK = {
  chatbot: { base: 8, aiact: "Risque limité : obligation de transparence (AI Act, art. 50). À requalifier si l'assistant prend des décisions concernant des personnes." },
  rh: { base: 25, aiact: "Haut risque : emploi et gestion des travailleurs (AI Act, annexe III, point 4). Obligations du déployeur, art. 26 : contrôle humain, information des personnes, analyse d'impact sur les droits fondamentaux. Application reportée au 2 décembre 2027 par l'omnibus numérique, mais le RGPD s'applique dès aujourd'hui." },
  marketing: { base: 5, aiact: "Risque minimal. Marquage des contenus synthétiques (AI Act, art. 50.2 et 50.4) si les contenus sont publiés." },
  support: { base: 10, aiact: "Risque limité : le client final doit savoir qu'il parle à une machine (AI Act, art. 50.1). Haut risque si l'outil décide de l'accès à un service essentiel." },
  documents: { base: 12, aiact: "Risque minimal à limité selon les documents traités. Si l'outil évalue des personnes, requalifier en haut risque." },
  code: { base: 8, aiact: "Risque minimal. Le sujet est contractuel : confidentialité du code et propriété des résultats." },
  autre: { base: 10, aiact: "À qualifier au cas par cas selon l'usage (AI Act, art. 6 et annexe III)." },
};

const DATA_RISK = { aucune: 0, clients: 12, rh: 20, sante: 25, confidentiel: 12, code: 8 };

const EU = ["france", "belgique", "espagne", "italie", "allemagne", "pays-bas", "luxembourg", "portugal", "irlande", "autriche", "pologne", "suède", "danemark", "finlande", "grèce", "roumanie", "tchéquie", "hongrie", "bulgarie", "croatie", "slovaquie", "slovénie", "lituanie", "lettonie", "estonie", "chypre", "malte", "ue", "union européenne"];

function context(input) {
  const data = new Set(input.dataTypes || []);
  if (data.size > 1) data.delete("aucune");
  const personal = ["clients", "rh", "sante"].some((d) => data.has(d));
  const confidential = data.has("confidentiel") || data.has("code");
  const sensitive = data.has("sante") || data.has("rh");
  const affectsPeople = input.category === "rh" || /(recrut|candidat|scor|notation|éligib|eligib|crédit|credit|sanction|licenci)/i.test(input.useCase || "");
  const countries = (input.countries || "").toLowerCase().split(/[,;/]+/).map((x) => x.trim()).filter(Boolean);
  const outsideEU = countries.some((c) => c && !EU.some((e) => c.includes(e)));
  return { ...input, data, personal, confidential, sensitive, affectsPeople, outsideEU, users: Number(input.users) || 0 };
}

function extract(contract) {
  const sents = sentences(contract);
  const findings = [];
  for (const t of TOPICS) {
    let status = "absent", quote = null, matchedBy = null;
    const isProtective = (s) => t.protective.some((re) => re.test(s));
    const tryList = (list, st) => {
      for (const re of list) for (const s of sents) if (re.test(s) && !(st === "dangereuse" && isProtective(s))) { status = st; quote = s; matchedBy = re; return true; }
      return false;
    };
    // L'ordre compte : une clause protectrice explicite l'emporte sur une formule ambiguë,
    // une clause dangereuse l'emporte sur tout le reste.
    if (!tryList(t.dangerous, "dangereuse")) { if (!tryList(t.protective, "protectrice")) tryList(t.ambiguous, "ambiguë"); }
    findings.push({ topic: t.id, label: t.label, status, quote, legal: t.legal });
  }
  return findings;
}

// Lecture externe (Claude) : la liste des sujets reste celle du moteur, seuls statut, citation et note viennent de la lecture.
function fromExternal(list) {
  const byTopic = new Map((list || []).map((f) => [f.topic, f]));
  const ok = new Set(["protectrice", "ambiguë", "dangereuse", "absent"]);
  return TOPICS.map((t) => {
    const f = byTopic.get(t.id) || {};
    const status = ok.has(f.status) ? f.status : "absent";
    const quote = status === "absent" ? null : (f.quote || null);
    return { topic: t.id, label: t.label, status: quote || status === "absent" ? status : "absent", quote, legal: t.legal, note: f.note || null };
  });
}

// options.findings : lecture externe (voir fromExternal). options.moteur : nom du moteur affiché. options.lecture : observations et confiance de la lecture.
export function analyse(input, options = {}) {
  const ctx = context(input);
  const hasContract = norm(ctx.contract).length > 200;
  const findings = options.findings ? fromExternal(options.findings) : extract(ctx.contract || "");

  // Score : exposition liée aux données et à l'usage, puis clauses.
  let score = 10 + (CATEGORY_RISK[ctx.category]?.base ?? 10); // 10 : tout outil porte un risque de base
  let dataScore = 0; for (const d of ctx.data) dataScore += DATA_RISK[d] ?? 0;
  score += Math.min(40, dataScore);
  if (ctx.outsideEU) score += 4;
  if (ctx.users >= 5000) score += 3;
  if (ctx.affectsPeople) score += 8;

  const risks = [], critical = [], missing = [], conditions = [], actions = [], fixes = [];
  for (const f of findings) {
    const t = TOPICS.find((x) => x.id === f.topic);
    const relevant = t.applies(ctx);
    if (f.status === "dangereuse") {
      score += relevant ? 8 : 4;
      critical.push(f);
      risks.push({ gravite: relevant ? "élevée" : "moyenne", titre: t.label, detail: `Clause dangereuse : « ${short(f.quote)} »`, base: t.legal });
      fixes.push({ sujet: t.label, texte: t.fix });
    } else if (f.status === "ambiguë") {
      score += relevant ? 3 : 1;
      critical.push(f);
      risks.push({ gravite: relevant ? "moyenne" : "faible", titre: t.label, detail: `Formulation ambiguë : « ${short(f.quote)} »`, base: t.legal });
      fixes.push({ sujet: t.label, texte: t.fix });
    } else if (f.status === "absent") {
      if (relevant && hasContract && t.weightAbsent > 0) {
        score += Math.round(t.weightAbsent * 0.6);
        missing.push({ sujet: t.label, base: t.legal, texte: t.fix });
        if (t.weightAbsent >= 6) risks.push({ gravite: "moyenne", titre: t.label, detail: "Aucune clause dans le contrat fourni.", base: t.legal });
      }
    } else if (f.status === "protectrice") {
      critical.push(f);
    }
  }
  if (!hasContract) { score += 20; risks.unshift({ gravite: "élevée", titre: "Contrat absent ou incomplet", detail: "Aucun contrat exploitable n'a été fourni. L'analyse ne porte que sur le cas d'usage et les données.", base: "RGPD art. 28.3 : le traitement par un sous-traitant est régi par un contrat." }); }
  score = Math.max(5, Math.min(96, Math.round(score)));

  // Règles bloquantes : elles imposent le ROUGE quel que soit le score.
  const st = Object.fromEntries(findings.map((f) => [f.topic, f.status]));
  const blockers = [];
  if (st.training === "dangereuse" && (ctx.personal || ctx.confidential)) blockers.push("Le fournisseur peut entraîner ses modèles sur des données personnelles ou confidentielles du Client.");
  if (ctx.sensitive && ctx.affectsPeople && st.automated !== "protectrice") blockers.push("Des personnes sont évaluées ou classées automatiquement à partir de données RH ou de santé, sans supervision humaine garantie par le contrat.");
  if (ctx.data.has("sante") && st.transfer === "dangereuse") blockers.push("Des données de santé peuvent être transférées hors de l'Union européenne sans garanties.");
  if (st.audit === "dangereuse" && ctx.personal) blockers.push("Le Client renonce à son droit d'audit alors qu'il reste responsable de traitement.");
  if (blockers.length) score = Math.max(score, 70);

  const verdict = score >= 65 ? "ROUGE" : score >= 35 ? "ORANGE" : "VERT";

  // Obligations RGPD et AI Act applicables au cas d'usage.
  const obligations = [];
  if (ctx.personal) {
    obligations.push({ texte: "Conclure un accord de traitement conforme à l'article 28 du RGPD, avec instructions documentées, et inscrire le traitement au registre (art. 30).", source: "RGPD art. 28 et 30" });
    obligations.push({ texte: "Déterminer la base légale et la finalité du traitement, et informer les personnes concernées.", source: "RGPD art. 6, 13 et 14" });
    obligations.push({ texte: "Fixer une durée de conservation et vérifier la minimisation des données transmises à l'outil.", source: "RGPD art. 5.1.c et 5.1.e" });
    if (ctx.outsideEU || st.transfer !== "protectrice") obligations.push({ texte: "Encadrer tout transfert hors UE : clauses contractuelles types et analyse d'impact du transfert.", source: "RGPD art. 44 à 46" });
  }
  if (ctx.sensitive || ctx.affectsPeople || ctx.users >= 1000) obligations.push({ texte: "Réaliser une analyse d'impact relative à la protection des données avant la mise en service.", source: "RGPD art. 35 ; liste CNIL des traitements soumis à AIPD" });
  if (ctx.data.has("sante")) obligations.push({ texte: "Vérifier l'exception permettant le traitement de données de santé, et l'exclure de l'outil si aucune ne s'applique.", source: "RGPD art. 9" });
  if (ctx.affectsPeople) obligations.push({ texte: "Garantir une intervention humaine réelle dans toute décision concernant une personne et permettre la contestation.", source: "RGPD art. 22 ; AI Act art. 26" });
  obligations.push({ texte: CATEGORY_RISK[ctx.category]?.aiact ?? CATEGORY_RISK.autre.aiact, source: "AI Act, règlement (UE) 2024/1689" });
  obligations.push({ texte: "Former les utilisateurs de l'outil : l'obligation de maîtrise de l'IA s'applique à tout déployeur depuis le 2 février 2025.", source: "AI Act art. 4" });

  // Conditions d'utilisation et actions recommandées.
  if (verdict !== "ROUGE") {
    if (ctx.category === "marketing") conditions.push("Relecture humaine de tout contenu avant publication, et marquage des contenus générés quand ils sont publiés.");
    if (!ctx.personal) conditions.push("Interdiction de saisir des données personnelles ou des documents confidentiels dans l'outil : rappel dans la charte d'usage et contrôle par échantillon.");
    if (ctx.personal) conditions.push("Anonymisation ou pseudonymisation des données avant envoi à l'outil lorsque le cas d'usage le permet.");
    if (st.training !== "protectrice") conditions.push("Désactivation contractuelle et technique de tout programme d'amélioration des modèles (opt-out écrit).");
    if (st.retention !== "protectrice") conditions.push("Durée de conservation fixée par avenant, 30 jours au plus pour les journaux.");
    if (st.breach !== "protectrice") conditions.push("Notification des incidents sous 24 heures, inscrite dans l'avenant.");
    if (ctx.category === "support" || ctx.category === "chatbot") conditions.push("Information des utilisateurs finaux qu'ils dialoguent avec un système d'IA, et passage à un humain à la demande.");
    conditions.push("Revue annuelle de la décision, ou à chaque changement de contrat, de version majeure ou de périmètre de données.");
  }
  if (verdict === "ROUGE") {
    actions.push("Ne pas autoriser le déploiement en l'état et en informer les équipes achats, juridique, DPO et métier.");
    actions.push("Transmettre au fournisseur l'avenant type ci-dessous ; sans accord sur les clauses bloquantes, chercher une alternative.");
    for (const b of blockers) actions.push(`Lever le point bloquant : ${b}`);
  } else if (verdict === "ORANGE") {
    actions.push("Autoriser un pilote limité, sans données sensibles, le temps de signer l'avenant.");
    actions.push("Négocier l'avenant type ci-dessous avant le déploiement général.");
  } else {
    actions.push("Autoriser le déploiement dans le périmètre décrit, sous les conditions listées.");
    actions.push("Inscrire l'outil au registre des autorisations, avec le présent dossier.");
  }
  if (missing.length) actions.push(`Compléter le contrat sur ${missing.length} point${missing.length > 1 ? "s" : ""} absent${missing.length > 1 ? "s" : ""} : ${missing.map((m) => m.sujet.toLowerCase()).join(", ")}.`);
  for (const m of missing) fixes.push({ sujet: m.sujet, texte: m.texte });

  const summary = summarize(ctx, verdict, score, critical, blockers, missing);
  const legal = ctx.affectsPeople || ctx.sensitive ? "élevé" : ctx.personal ? "modéré" : "faible";

  return {
    meta: { outil: ctx.tool, fournisseur: ctx.vendor, categorie: ctx.category, cas_usage: ctx.useCase, donnees: [...ctx.data], pays: ctx.countries, utilisateurs: ctx.users, date: new Date().toISOString().slice(0, 10), moteur: options.moteur || "règles v1" },
    verdict, score, niveau_juridique: legal,
    resume: summary,
    risques: risks.sort((a, b) => rank(b.gravite) - rank(a.gravite)),
    clauses_critiques: critical.filter((c) => c.status !== "protectrice").map((c) => ({ sujet: c.label, statut: c.status, extrait: short(c.quote, 320), base: c.legal, note: c.note || null })),
    clauses_protectrices: critical.filter((c) => c.status === "protectrice").map((c) => ({ sujet: c.label, extrait: short(c.quote, 260), note: c.note || null })),
    clauses_manquantes: missing.map(({ sujet, base }) => ({ sujet, base })),
    constats: findings.map((f) => { const t = TOPICS.find((x) => x.id === f.topic); return { topic: f.topic, sujet: f.label, statut: f.status, citation: f.quote || null, note: f.note || null, base: f.legal, pertinent: t.applies(ctx) }; }),
    obligations, conditions, actions,
    clauses_correctives: dedupe(fixes),
    points_bloquants: blockers,
    lecture: options.lecture || null,
    mention: MENTION,
  };
}

function summarize(ctx, verdict, score, critical, blockers, missing) {
  const bad = critical.filter((c) => c.status !== "protectrice").length;
  const dataLabel = ctx.data.has("aucune") || ctx.data.size === 0 ? "aucune donnée personnelle" : joinFr([...ctx.data].map((d) => ({ clients: "des données clients", rh: "des données RH", sante: "des données de santé", confidentiel: "des documents confidentiels", code: "du code propriétaire" })[d]));
  const usage = { rh: "le recrutement et la gestion RH", support: "le support client", marketing: "la production de contenus marketing", chatbot: "un assistant conversationnel", documents: "l'analyse de documents", code: "l'aide au développement" }[ctx.category] || "l'usage décrit";
  const none = ctx.data.has("aucune") || ctx.data.size === 0;
  const s1 = none
    ? `${ctx.tool} (${ctx.vendor}) sert à ${usage} et ne traite aucune donnée personnelle : exposition réglementaire faible.`
    : `${ctx.tool} (${ctx.vendor}) traite ${dataLabel} pour ${usage} : exposition réglementaire ${ctx.affectsPeople || ctx.sensitive ? "élevée" : "modérée"}.`;
  const s2 = bad === 0 ? `Le contrat est protecteur sur les points vérifiés${missing.length ? `, ${missing.length} clause${missing.length > 1 ? "s" : ""} rest${missing.length > 1 ? "ent" : "e"} à ajouter` : ""}.` : `${bad} clause${bad > 1 ? "s" : ""} critique${bad > 1 ? "s" : ""} relevée${bad > 1 ? "s" : ""} dans le contrat${missing.length ? ` et ${missing.length} clause${missing.length > 1 ? "s" : ""} manquante${missing.length > 1 ? "s" : ""}` : ""}.`;
  const s3 = verdict === "ROUGE" ? `Non autorisé en l'état (niveau de vigilance ${score}/100) : ${blockers[0] || "les risques cumulés dépassent le seuil acceptable."}` : verdict === "ORANGE" ? `Autorisé sous conditions (niveau de vigilance ${score}/100) : un avenant est requis avant un déploiement élargi.` : `Autorisé (niveau de vigilance ${score}/100) dans le périmètre décrit, sous conditions d'usage.`;
  return [s1, s2, s3];
}

export function avenant(result) {
  const d = result.meta;
  const lines = [];
  lines.push(`AVENANT N° 1 AU CONTRAT « ${d.outil.toUpperCase()} »`);
  lines.push(`Entre le Client et ${d.fournisseur} (le « Fournisseur »)`);
  lines.push(`Projet d'avenant préparé par ${BRAND} le ${fr(d.date)}. Document de travail, à relire et à négocier par un avocat.`);
  lines.push("");
  lines.push("Préambule");
  lines.push(`Le Client souhaite utiliser le service ${d.outil} pour l'usage suivant : ${d.cas_usage} Les parties conviennent de compléter et de modifier le contrat initial par les stipulations ci-dessous, qui prévalent sur toute stipulation contraire.`);
  result.clauses_correctives.forEach((c, i) => { lines.push(""); lines.push(`Article ${i + 1}. ${c.sujet}`); lines.push(c.texte); });
  lines.push(""); lines.push(`Article ${result.clauses_correctives.length + 1}. Portée`);
  lines.push("Le présent avenant fait partie intégrante du contrat. Les autres stipulations demeurent inchangées. En cas de contradiction, l'avenant prévaut.");
  return lines.join("\n");
}

const joinFr = (a) => a.length > 1 ? a.slice(0, -1).join(", ") + " et " + a[a.length - 1] : a.join("");
const rank = (g) => ({ "élevée": 3, moyenne: 2, faible: 1 })[g] || 0;
const short = (s, n = 180) => { s = norm(s || ""); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, "") + "…" : s; };
const dedupe = (arr) => { const seen = new Set(); return arr.filter((x) => (seen.has(x.sujet) ? false : (seen.add(x.sujet), true))); };
const fr = (iso) => { const [y, m, d] = (iso || "").split("-"); return `${Number(d)} ${["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][Number(m) - 1]} ${y}`; };

// Les huit domaines de vigilance présentés à l'utilisateur. Chacun regroupe un ou plusieurs des douze sujets lus dans le contrat.
// Ce sont des catégories d'examen, pas une certification de conformité.
export const DIMENSIONS = [
  { id: "training", topics: ["training"] },
  { id: "retention", topics: ["retention"] },
  { id: "transfer", topics: ["transfer"] },
  { id: "subprocessors", topics: ["subprocessors"] },
  { id: "security", topics: ["security", "breach", "audit"] },
  { id: "liability", topics: ["liability", "outputs", "changes"] },
  { id: "oversight", topics: ["automated"] },
  { id: "transparency", topics: ["transparency"] },
];

// Étapes affichées pendant l'analyse, avec le détail calculé pour chacune.
export const STEPS = ["Examen du contrat", "Extraction des clauses critiques", "Analyse du cas d'usage", "Croisement avec le RGPD et l'AI Act", "Qualification du risque", "Préparation de l'avis"];
