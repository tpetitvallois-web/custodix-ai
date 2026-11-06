// Serveur MCP de Aucteva (transport Streamable HTTP, sans état, sans authentification pour la démonstration).
// Toute personne peut brancher son assistant (Claude, ChatGPT ou autre client MCP) sur https://<site>/mcp et lui
// demander d'examiner un outil IA. Trois façons de lire le contrat : l'assistant lit lui-même (ses citations sont
// vérifiées mot pour mot par Aucteva), les règles locales, ou le lecteur de Aucteva.
// Le barème, les points bloquants, les obligations et l'avis restent calculés par le code du cabinet.

import { TOPICS } from "../public/engine.js";
import { SYSTEM, sujetsTexte } from "./lecture.js";

const PROTOCOL = "2025-06-18";
const AVIS = { VERT: "Autorisé", ORANGE: "Autorisé sous conditions", ROUGE: "Non autorisé en l'état" };
const CATEGORIES = ["chatbot", "rh", "marketing", "support", "documents", "code", "autre"];
const DONNEES = ["aucune", "clients", "rh", "sante", "confidentiel", "code"];

const TOOLS = [
  {
    name: "examiner_outil",
    description: "Ouvre un dossier d'autorisation Aucteva pour un outil d'intelligence artificielle : outil, fournisseur, cas d'usage, données traitées et texte du contrat ou des conditions d'utilisation. Par défaut (lecture « assistant »), la réponse contient le guide de lecture : tu lis alors le contrat toi-même et tu renvoies le résultat avec deposer_lecture ; Aucteva vérifie chaque citation dans le contrat puis calcule l'avis. Lecture « regles » : avis immédiat par les règles locales (motifs en français, sans lecture du texte). Lecture « custodix » : le lecteur de Aucteva lit le contrat, consulte ensuite le dossier avec consulter_dossier.",
    inputSchema: {
      type: "object",
      required: ["outil", "fournisseur", "cas_usage", "donnees"],
      properties: {
        outil: { type: "string", description: "Nom de l'outil (ex. Fin AI Agent)" },
        fournisseur: { type: "string", description: "Éditeur de l'outil (ex. Intercom)" },
        categorie: { type: "string", enum: CATEGORIES, description: "chatbot (assistant interne), rh (recrutement, gestion des salariés), marketing (contenus), support (client), documents (analyse), code, autre" },
        cas_usage: { type: "string", description: "Ce que l'outil fera, pour qui, avec quelles données, en une à trois phrases" },
        donnees: { type: "array", items: { type: "string", enum: DONNEES }, description: "Types de données traitées, obligatoire : aucune, clients, rh, sante, confidentiel, code. Toute autre valeur est refusée avec un message d'erreur." },
        pays: { type: "string", description: "Pays d'utilisation, séparés par des virgules" },
        utilisateurs: { type: "integer", minimum: 0, description: "Nombre d'utilisateurs estimé" },
        contrat: { type: "string", description: "Texte intégral du contrat, de l'accord de traitement ou des conditions d'utilisation, dans sa langue d'origine" },
        lecture: { type: "string", enum: ["assistant", "regles", "custodix"], description: "Qui lit le contrat : assistant (toi, par défaut), regles, custodix" },
      },
    },
  },
  {
    name: "deposer_lecture",
    description: "Renvoie ta lecture d'un contrat ouvert avec examiner_outil (lecture « assistant ») : pour chacun des douze sujets, un statut (protectrice, ambiguë, dangereuse, absent), la citation exacte du contrat dans sa langue et une note en français, plus des observations. Aucteva vérifie chaque citation mot pour mot dans le contrat, ramène à « absent » toute citation introuvable, puis calcule le niveau de vigilance et l'avis. La réponse contient l'avis complet et l'adresse du dossier.",
    inputSchema: {
      type: "object",
      required: ["id", "clauses"],
      properties: {
        id: { type: "string", description: "Identifiant du dossier (CX-AAAA-NNNN)" },
        langue: { type: "string" },
        type_document: { type: "string", description: "Nature du document en une ligne" },
        parties: { type: "string", description: "Qui contracte avec qui" },
        clauses: {
          type: "array",
          items: {
            type: "object",
            required: ["topic", "status", "quote", "note"],
            properties: {
              topic: { type: "string", enum: TOPICS.map((t) => t.id) },
              status: { type: "string", enum: ["protectrice", "ambiguë", "dangereuse", "absent"] },
              quote: { type: ["string", "null"], description: "Phrase exacte du contrat, non reformulée, ou null si absent" },
              note: { type: "string", description: "Une phrase en français qui explique le statut" },
            },
          },
        },
        observations: { type: "array", items: { type: "string" }, description: "Trois à cinq constats en français hors des douze sujets : loi applicable, arbitrage, renouvellement, résiliation, indemnisation..." },
      },
    },
  },
  {
    name: "consulter_dossier",
    description: "Lit un dossier d'autorisation Aucteva par son identifiant : statut, avis, niveau de vigilance, points bloquants, risques, conditions, mesures, clauses correctives, validation par un avocat.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
  },
  {
    name: "registre",
    description: "Liste les derniers dossiers du registre des autorisations Aucteva : identifiant, date, outil, fournisseur, avis, niveau, validation.",
    inputSchema: { type: "object", properties: { limite: { type: "integer", minimum: 1, maximum: 100 } } },
  },
];

const text = (t) => ({ content: [{ type: "text", text: t }] });
const fail = (t) => ({ content: [{ type: "text", text: t }], isError: true });
const fmtDate = (ms) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }).format(new Date(ms));

function avisTexte(d, base) {
  const r = d.resultat;
  const L = r.lecture;
  const out = [];
  out.push(`Dossier ${d.id}, ${r.meta.outil} (${r.meta.fournisseur}). Avis : ${AVIS[r.verdict]}. Niveau de vigilance ${r.score} sur 100 (moins de 35 autorisé, 35 à 64 sous conditions, 65 et plus non autorisé en l'état). Niveau d'enjeu juridique ${r.niveau_juridique}. Lecture : ${r.meta.moteur}.`);
  out.push("", "Résumé : " + r.resume.join(" "));
  if (L) out.push("", `Lecture du contrat : ${L.type_document || ""} ${L.parties ? `Parties : ${L.parties}.` : ""} Langue : ${L.langue || "?"}. Citations vérifiées : ${L.citations ? `${L.citations.verifiees} sur ${L.citations.total}` : "sans objet"}.` + (L.observations && L.observations.length ? "\nObservations : " + L.observations.join(" ") : ""));
  if (r.points_bloquants.length) out.push("", "Points bloquants :", ...r.points_bloquants.map((b) => `- ${b}`));
  if (r.risques.length) out.push("", "Risques :", ...r.risques.map((x) => `- [${x.gravite}] ${x.titre} : ${x.detail} (${x.base})`));
  if (r.clauses_critiques.length) out.push("", "Clauses critiques :", ...r.clauses_critiques.map((c) => `- [${c.statut}] ${c.sujet} : « ${c.extrait} »${c.note ? ` ${c.note}` : ""}`));
  if (r.clauses_protectrices.length) out.push("", "Clauses protectrices : " + r.clauses_protectrices.map((c) => c.sujet).join(", ") + ".");
  if (r.clauses_manquantes.length) out.push("", "Clauses manquantes : " + r.clauses_manquantes.map((c) => c.sujet).join(", ") + ".");
  out.push("", "Obligations applicables :", ...r.obligations.map((o) => `- ${o.texte} (${o.source})`));
  if (r.conditions.length) out.push("", "Conditions d'usage :", ...r.conditions.map((c) => `- ${c}`));
  out.push("", "Mesures recommandées :", ...r.actions.map((a, i) => `${i + 1}. ${a}`));
  if (r.clauses_correctives.length) out.push("", "Clauses correctives proposées :", ...r.clauses_correctives.map((c) => `- ${c.sujet} : ${c.texte}`));
  out.push("", d.validation ? `Validé par ${d.validation.nom}, ${d.validation.role}, le ${d.validation.when} (signature ${d.validation.hash}).` : "En attente de validation par un avocat.");
  out.push(r.mention, `Dossier complet : ${base}/app/dossier/${d.id}`);
  return out.join("\n");
}

async function callTool(name, args, ctx) {
  const { registre, env, base } = ctx;
  args = args || {};
  if (name === "examiner_outil") {
    const input = {
      tool: args.outil, vendor: args.fournisseur, category: args.categorie || "autre", useCase: args.cas_usage,
      dataTypes: args.donnees || [], countries: args.pays || "", users: args.utilisateurs || 0, contract: args.contrat || "", source: "Connecteur MCP",
    };
    if (!(Array.isArray(args.donnees) ? args.donnees.length : String(args.donnees ?? "").trim())) return fail("Précise les données traitées dans « donnees » : aucune, clients, rh, sante, confidentiel, code. Indique « aucune » seulement si l'outil ne traite aucune donnée personnelle ni confidentielle.");
    const { input: clean, error } = ctx.cleanInput(input);
    if (error) return fail(error);
    const lecture = ["assistant", "regles", "custodix"].includes(args.lecture) ? args.lecture : "assistant";
    if (lecture !== "regles" && clean.contract.length < 200) return fail("Le contrat manque ou est trop court : transmets le texte intégral dans « contrat », ou choisis lecture « regles ».");
    const mode = lecture === "regles" ? "regles" : lecture === "custodix" ? "claude" : "connecteur";
    if (mode === "claude") { const q = await ctx.quota(); if (!q.ok) return fail(q.erreur); }
    const d = await registre.creer(clean, mode, !!env.ANTHROPIC_API_KEY);
    if (mode === "claude" && !env.ANTHROPIC_API_KEY) await ctx.declencherGitHub(env, d.id);
    if (mode === "regles") return text(avisTexte(d, base));
    if (mode === "claude") return text(`Dossier ${d.id} ouvert. Le lecteur de Aucteva lit le contrat (${clean.contract.split(/\s+/).length} mots), compte une à trois minutes. Consulte ensuite le dossier avec consulter_dossier, id ${d.id}. Page : ${base}/app/dossier/${d.id}`);
    return text([
      `Dossier ${d.id} ouvert pour ${clean.tool} (${clean.vendor}). Lis maintenant le contrat que tu as transmis, puis appelle deposer_lecture avec l'id ${d.id}.`,
      "", "Consigne de lecture :", SYSTEM, "", "Sujets à qualifier :", sujetsTexte(),
      "", "Format attendu par deposer_lecture : langue, type_document, parties, clauses (douze entrées, une par sujet, avec topic, status, quote exacte ou null, note), observations (trois à cinq phrases). Les citations sont vérifiées mot pour mot dans le contrat : une citation reformulée ramène le sujet à « absent ».",
    ].join("\n"));
  }
  if (name === "deposer_lecture") {
    const id = String(args.id || "").toUpperCase().trim();
    if (!Array.isArray(args.clauses) || !args.clauses.length) return fail("clauses manquantes.");
    const d0 = await registre.lire(id);
    if (!d0) return fail(`Dossier ${id} inconnu.`);
    if (d0.statut === "termine") return fail(`Le dossier ${id} est déjà terminé : consulte-le avec consulter_dossier.`);
    const reading = { langue: args.langue, type_document: args.type_document, parties: args.parties, clauses: args.clauses.slice(0, 24), observations: Array.isArray(args.observations) ? args.observations.slice(0, 8) : [] };
    const d = await registre.terminer(id, reading, "lecture intégrale v1 (assistant du client)", "assistant externe");
    return text(avisTexte(d, base));
  }
  if (name === "consulter_dossier") {
    const id = String(args.id || "").toUpperCase().trim();
    const d = await registre.lire(id);
    if (!d) return fail(`Dossier ${id} inconnu.`);
    if (d.statut !== "termine") return text(`Dossier ${id} : ${d.statut === "erreur" ? `la lecture a échoué (${d.erreur || "erreur inconnue"})` : "lecture en cours, réessaie dans une minute"}.`);
    return text(avisTexte(d, base));
  }
  if (name === "registre") {
    const list = await registre.liste(Math.min(100, Math.max(1, Number(args.limite) || 20)));
    if (!list.length) return text("Aucun dossier au registre.");
    return text(list.map((x) => `${x.id} | ${fmtDate(x.cree)} | ${x.outil} (${x.fournisseur}) | ${x.statut === "termine" ? `${AVIS[x.verdict] || ""} ${x.score ?? ""}` : x.statut} | ${x.moteur || x.mode} | ${x.validation ? `validé par ${x.validation.nom}, ${x.validation.role}` : "en attente de validation"}`).join("\n"));
  }
  return fail(`Outil inconnu : ${name}`);
}

async function rpc(msg, ctx) {
  const { id, method, params } = msg || {};
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const error = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });
  if (!method) return error(-32600, "Requête invalide");
  if (id === undefined || id === null) return null; // notification : rien à renvoyer
  switch (method) {
    case "initialize":
      return reply({ protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: { name: "aucteva", title: "Aucteva", version: "1.0.0" }, instructions: "Aucteva prépare un avis d'autorisation pour un outil d'intelligence artificielle à partir de son contrat et du cas d'usage. Commence par examiner_outil avec le texte intégral du contrat ; si la réponse contient un guide de lecture, lis le contrat et renvoie ta lecture avec deposer_lecture. L'avis doit toujours être validé par un avocat." });
    case "ping": return reply({});
    case "tools/list": return reply({ tools: TOOLS });
    case "tools/call": {
      const p = params || {};
      try { return reply(await callTool(p.name, p.arguments, ctx)); }
      catch (e) { console.error("mcp tool", p.name, e); return reply(fail("Erreur interne de Aucteva.")); }
    }
    default: return error(-32601, `Méthode inconnue : ${method}`);
  }
}

export async function handleMcp(request, ctx) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, authorization", "access-control-expose-headers": "mcp-session-id" };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method === "GET") return new Response("Serveur MCP de Aucteva. Transport Streamable HTTP sans état : envoyez vos requêtes JSON-RPC en POST.", { status: 405, headers: { ...cors, "content-type": "text/plain; charset=utf-8", allow: "POST, OPTIONS" } });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: cors });
  let body;
  try { body = await request.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON illisible" } }, { status: 400, headers: cors }); }
  const messages = Array.isArray(body) ? body : [body];
  const out = (await Promise.all(messages.map((m) => rpc(m, ctx)))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202, headers: cors });
  return Response.json(Array.isArray(body) ? out : out[0], { headers: { ...cors, "content-type": "application/json" } });
}
