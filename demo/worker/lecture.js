// Lecture du contrat par Claude : prompt, schéma de sortie, vérification des citations.
// Une seule source de vérité, utilisée par le Worker (appel direct à l'API) et par le pont local (claude -p).

import { TOPICS } from "../public/engine.js";

export const MODEL_API = "claude-opus-5-5";
export const MODEL_PONT = "opus";

const GUIDE = {
  training: "Protectrice si le fournisseur s'interdit expressément d'entraîner, affiner ou améliorer ses modèles (ou ceux de tiers) avec les données, requêtes ou résultats du client, ou si l'entraînement est désactivé par défaut pour les clients professionnels. Ambiguë si le fournisseur peut « améliorer ses services » ou utiliser des données « dérivées », « agrégées » ou « anonymisées », ou si l'exclusion suppose une démarche du client (opt-out). Dangereuse si l'entraînement est autorisé sans possibilité de refus, ou si une licence large et perpétuelle est concédée sur les données. Un entraînement activé par défaut mais que le client peut désactiver (opt-out) est ambigu, jamais dangereux.",
  retention: "Protectrice si une durée de conservation précise et courte est fixée et si la suppression à la fin du contrat est garantie dans un délai défini. Ambiguë si la conservation est « aussi longtemps que nécessaire », soumise aux politiques internes, ou si seule l'exportation est prévue. Dangereuse si le fournisseur conserve les données sans limite ou après résiliation à sa discrétion.",
  transfer: "Protectrice si les données sont hébergées et traitées dans l'Union européenne ou l'Espace économique européen, avec un engagement ferme. Ambiguë si le lieu dépend de la configuration, ou si les transferts reposent sur des clauses contractuelles types sans précision de pays. Dangereuse si le fournisseur peut transférer les données vers tout pays de son choix, ou si l'hébergement est hors UE sans garantie (États-Unis, Chine, autres).",
  subprocessors: "Protectrice si la liste des sous-traitants ultérieurs est communiquée, avec information préalable et droit d'objection du client. Ambiguë si la liste est « disponible sur demande » ou mise à jour sur une page web sans notification. Dangereuse si le fournisseur peut engager tout sous-traitant sans information.",
  breach: "Protectrice si la notification d'une violation de données est due dans un délai chiffré de 72 heures ou moins. Ambiguë si le délai est « raisonnable », « sans retard indu » sans chiffre, ou limité aux incidents « significatifs » selon l'appréciation du fournisseur. Dangereuse si aucune obligation de notification n'existe ou si elle est exclue.",
  audit: "Protectrice si le client (ou un auditeur mandaté) peut auditer le fournisseur, au moins une fois par an ou en cas d'incident. Ambiguë si un rapport de certification (SOC 2, ISO 27001) tient lieu d'audit, ou si l'audit est soumis à conditions lourdes. Dangereuse si le client renonce à tout droit d'audit.",
  security: "Protectrice si des mesures précises sont décrites (chiffrement au repos et en transit, certification, tests, contrôle d'accès). Ambiguë si les mesures sont « raisonnables » ou « conformes aux standards du secteur » sans détail. Dangereuse si la sécurité est à la charge exclusive du client ou si toute garantie est exclue.",
  outputs: "Protectrice si le client est titulaire des résultats générés (contenus, réponses, scores) et de ses données, le fournisseur ne revendiquant aucun droit. Ambiguë si le client n'a qu'un droit d'usage, ou si le fournisseur garde des droits sur les « données dérivées » ou les « modèles dérivés ». Dangereuse si les résultats ou les modèles entraînés restent la propriété du fournisseur.",
  liability: "Protectrice si la responsabilité du fournisseur est plafonnée à douze mois de redevances ou plus, sans plafond pour la confidentialité, la sécurité ou les données personnelles. Ambiguë si le plafond est faible (moins de douze mois, ou un montant symbolique) ou si les dommages indirects excluent les pertes de données. Dangereuse si toute responsabilité est exclue, ou si le client garantit le fournisseur contre toute réclamation.",
  automated: "Protectrice si une validation humaine est obligatoire pour toute décision concernant une personne, ou si le contrat exclut toute décision automatisée. Ambiguë si la supervision humaine est seulement « recommandée ». Dangereuse si des classements, scores ou décisions sont produits automatiquement sans supervision, ou si le fournisseur ne garantit ni l'exactitude ni l'absence de biais.",
  transparency: "Protectrice si le fournisseur fournit les moyens d'informer les personnes qu'elles interagissent avec une IA ou de marquer les contenus générés. Ambiguë si l'information est laissée au client sans outil. Dangereuse si le fournisseur interdit de révéler l'usage de l'IA.",
  changes: "Protectrice si toute modification du contrat requiert l'accord du client. Ambiguë si le fournisseur peut modifier moyennant un préavis, ou si des documents annexes (accord de traitement, politique) sont « susceptibles d'être mis à jour ». Dangereuse si le fournisseur peut modifier les conditions à tout moment, applicables dès publication.",
};

export const SYSTEM = `Tu es un juriste spécialisé en contrats de services numériques, protection des données et droit de l'intelligence artificielle, au sein d'un cabinet d'avocats français.
On te donne le contrat, les conditions d'utilisation ou l'accord de traitement d'un outil d'intelligence artificielle, dans sa langue d'origine (souvent l'anglais).
Pour chacun des douze sujets listés, tu dis si le contrat contient une clause protectrice pour le client, une clause ambiguë, une clause dangereuse pour le client, ou aucune clause (absent).

Règles de lecture :
- Tu cites la phrase exacte du contrat qui fonde ton statut, dans sa langue d'origine, sans la reformuler ni la traduire. Une citation de 15 à 60 mots suffit. Si tu ne peux rien citer, le statut est « absent » et la citation est null.
- Une négation explicite (« s'interdit », « n'utilise pas », « will not use », « does not train ») rend la clause protectrice, même si elle contient les mots du risque.
- Quand plusieurs clauses traitent d'un sujet, retiens la plus engageante pour le fournisseur si elle existe (protectrice), sinon la plus dangereuse.
- Une clause dangereuse pour le client l'emporte sur une clause ambiguë ; une clause protectrice explicite l'emporte sur une formule ambiguë du même sujet.
- Tu ne donnes aucun avis sur l'opportunité d'utiliser l'outil : tu décris le contrat.
- La note de chaque sujet est une phrase en français, factuelle, qui explique le statut (30 mots au plus).
- Les observations sont trois à cinq phrases courtes en français sur ce qu'un avocat doit remarquer hors des douze sujets : loi applicable et juridiction, arbitrage, renouvellement tacite, résiliation, indemnisation, âge minimal, usage interdit, et tout élément inhabituel. Pas de conseil, des constats.

Tu réponds uniquement en JSON, selon le schéma fourni, sans texte autour.`;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["langue", "type_document", "parties", "clauses", "observations"],
  properties: {
    langue: { type: "string", description: "Langue du contrat, en français : anglais, français, ..." },
    type_document: { type: "string", description: "Nature du document en une ligne : conditions générales, accord de traitement, contrat de service, politique d'usage..." },
    parties: { type: "string", description: "Qui contracte avec qui, en une ligne" },
    clauses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["topic", "status", "quote", "note"],
        properties: {
          topic: { type: "string", enum: TOPICS.map((t) => t.id) },
          status: { type: "string", enum: ["protectrice", "ambiguë", "dangereuse", "absent"] },
          quote: { type: ["string", "null"] },
          note: { type: "string" },
        },
      },
    },
    observations: { type: "array", items: { type: "string" } },
  },
};

export function userPrompt(input) {
  const subjects = TOPICS.map((t) => `- ${t.id} : ${t.label}. ${GUIDE[t.id] || ""}`).join("\n");
  return `Outil examiné : ${input.tool} (${input.vendor}). Cas d'usage envisagé par le client : ${input.useCase}

Sujets à qualifier :
${subjects}

Contrat :
<<<
${input.contract}
>>>`;
}

// Vérification des citations : une citation introuvable rétrograde le sujet en « absent ».
const fold = (s) => (s || "").normalize("NFKC").replace(/[’‘`´]/g, "'").replace(/[“”«»]/g, '"').replace(/[ \s]+/g, " ").replace(/\s*([.,;:!?()])\s*/g, "$1").toLowerCase().trim();

export function verifyReading(contract, reading) {
  const haystack = fold(contract);
  const words = (haystack.match(/[\p{L}\p{N}']+/gu) || []);
  const shingles = new Set();
  for (let i = 0; i + 5 <= words.length; i++) shingles.add(words.slice(i, i + 5).join(" "));
  let checked = 0, ok = 0;
  const clauses = (reading.clauses || []).map((c) => {
    if (c.status === "absent" || !c.quote) return { ...c, quote: null, verified: null };
    checked++;
    const q = fold(c.quote);
    let verified = q.length > 0 && haystack.includes(q);
    if (!verified) {
      const qw = q.match(/[\p{L}\p{N}']+/gu) || [];
      let hit = 0, total = 0;
      for (let i = 0; i + 5 <= qw.length; i++) { total++; if (shingles.has(qw.slice(i, i + 5).join(" "))) hit++; }
      verified = total > 0 && hit / total >= 0.6;
    }
    if (verified) ok++;
    return verified ? { ...c, verified: true } : { ...c, status: "absent", quote: null, verified: false, note: `${c.note || ""} (citation non retrouvée dans le contrat, sujet retenu comme absent)`.trim() };
  });
  return { ...reading, clauses, confiance: checked ? Math.round((ok / checked) * 100) : 100, citations: { verifiees: ok, total: checked } };
}
