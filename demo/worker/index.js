// Worker Cloudflare de Aucteva : sert la page, tient le registre des dossiers (Durable Object)
// et fait lire les contrats par Claude, soit par l'API (secret ANTHROPIC_API_KEY), soit par le pont local (claude -p).
import { DurableObject } from "cloudflare:workers";
import Anthropic from "@anthropic-ai/sdk";
import { analyse } from "../public/engine.js";
import { SYSTEM, SCHEMA, userPrompt, verifyReading, MODEL_API, MODEL_PONT } from "./lecture.js";
import { handleMcp } from "./mcp.js";
import { MODEL_CHAT, CHAT_SYSTEM, CHAT_SCHEMA, chatPrompt, mergeDossier, avisMessage } from "./chat.js";

const MAX_CONTRACT = 600_000; // caractères, environ 150 000 jetons
const PONT_TIMEOUT = 10 * 60 * 1000; // un dossier pris par le pont et sans réponse est remis en file
const PONT_ONLINE = 45 * 1000;
const CHUNK = 40_000; // caractères par tranche de contrat stockée // le pont est « en ligne » s'il a interrogé la file depuis moins de 45 s

const QUOTA_IP = 60; // lectures par adresse et par jour (un jury derrière une même adresse doit pouvoir tester)
const QUOTA_JOUR = 400; // lectures par jour, toutes adresses confondues

// Empreinte de l'adresse IP : hachée avec le jour et un secret, jamais stockée en clair, inutilisable le lendemain.
async function empreinte(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "inconnue";
  const data = new TextEncoder().encode(`${ip}|${new Date().toISOString().slice(0, 10)}|${env.PONT_TOKEN || "custodix"}`);
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...h.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SECURITE = { "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", "x-frame-options": "SAMEORIGIN", "permissions-policy": "camera=(), microphone=(), geolocation=()" };
function avecEntetes(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITE)) r.headers.set(k, v);
  return r;
}

const ok = (data, status = 200) => Response.json(data, { status });
// Les dossiers créés avant le 6 novembre portaient le nom du modèle dans l'étiquette du moteur : on l'efface à l'affichage.
const neutre = (moteur) => (moteur || "").replace(/^claude\S*/i, "lecture intégrale v1");
const err = (message, status = 400) => Response.json({ ok: false, erreur: message }, { status });

export class Registre extends DurableObject {
  async _next() {
    const n = ((await this.ctx.storage.get("compteur")) || 0) + 1;
    await this.ctx.storage.put("compteur", n);
    return `CX-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
  }

  // Crée un dossier. mode : "regles" (instantané) ou "claude" (file d'attente ou API).
  // Le texte du contrat est stocké à part, en tranches (limite de 128 Kio par valeur), le dossier reste léger.
  async creer(input, mode, apiAvailable) {
    const id = await this._next();
    const now = Date.now();
    const { contract, ...meta } = input;
    const chunks = []; for (let i = 0; i < contract.length; i += CHUNK) chunks.push(contract.slice(i, i + CHUNK));
    const d = { id, mode, statut: "en_attente", cree: now, maj: now, input: { ...meta, contrat_mots: contract.trim().split(/\s+/).filter(Boolean).length, contrat_tranches: chunks.length }, resultat: null, erreur: null, validation: null };
    if (mode === "regles") {
      d.resultat = analyse(input, { moteur: "règles v1" });
      d.statut = "termine";
    } else if (mode === "connecteur") {
      d.statut = "attente_lecture"; // l'assistant du client lit lui-même : jamais pris par le pont
    } else if (apiAvailable) {
      d.statut = "en_attente_api";
      await this.ctx.storage.setAlarm(Date.now() + 50);
    }
    for (let i = 0; i < chunks.length; i++) await this.ctx.storage.put(`contrat:${id}:${i}`, chunks[i]);
    await this.ctx.storage.put(`dossier:${id}`, d);
    return this.public(d);
  }

  async _contract(d) {
    if (typeof d.input.contract === "string") return d.input.contract; // dossiers créés avant le stockage en tranches
    const n = d.input.contrat_tranches || 0;
    let out = "";
    for (let i = 0; i < n; i++) out += (await this.ctx.storage.get(`contrat:${d.id}:${i}`)) || "";
    return out;
  }

  async lire(id) { const d = await this.ctx.storage.get(`dossier:${id}`); return d ? this.public(d) : null; }

  async valider(id, nom, role) {
    const d = await this.ctx.storage.get(`dossier:${id}`);
    if (!d || d.statut !== "termine") return null;
    const now = new Date();
    const payload = `${id}|${nom}|${role}|${now.toISOString()}|${d.resultat.verdict}|${d.resultat.score}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const hash = [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    d.validation = { nom, role, iso: now.toISOString(), hash };
    d.maj = Date.now();
    await this.ctx.storage.put(`dossier:${id}`, d);
    return this.public(d);
  }

  // Décision d'utilisation : prise par une personne habilitée de l'entreprise, après la validation juridique.
  async decider(id, x) {
    const d = await this.ctx.storage.get(`dossier:${id}`);
    if (!d || d.statut !== "termine") return { erreur: "Dossier inconnu ou examen non terminé.", status: 404 };
    if (!d.validation) return { erreur: "La décision suit la validation juridique : faites d'abord valider l'avis.", status: 409 };
    const now = new Date();
    const payload = `${id}|${x.nom}|${x.fonction}|${x.decision}|${now.toISOString()}|${d.validation.hash}`;
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const hash = [...new Uint8Array(buf)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    d.decision = { ...x, iso: now.toISOString(), hash };
    d.maj = Date.now();
    await this.ctx.storage.put(`dossier:${id}`, d);
    return { dossier: this.public(d) };
  }

  async contrat(id) {
    const d = await this.ctx.storage.get(`dossier:${id}`);
    return d ? await this._contract(d) : null;
  }

  async liste(limit = 300) {
    const m = await this.ctx.storage.list({ prefix: "dossier:", reverse: true, limit });
    return [...m.values()].map((d) => ({
      id: d.id, statut: d.statut, mode: d.mode, cree: d.cree,
      outil: d.input.tool, fournisseur: d.input.vendor, categorie: d.input.category,
      cas_usage: (d.input.useCase || "").slice(0, 220), departement: d.input.departement || null, responsable: d.input.responsable || null, usage: d.input.usage || null,
      documents: (d.input.documents || []).map((x) => x.nom).slice(0, 6), source: (d.input.source || "").slice(0, 120), mots: d.input.contrat_mots || 0,
      verdict: d.resultat?.verdict || null, score: d.resultat?.score ?? null, moteur: neutre(d.resultat?.meta?.moteur) || null,
      conditions: d.resultat?.conditions?.length || 0, bloquants: d.resultat?.points_bloquants?.length || 0, maj: d.maj || d.cree,
      validation: d.validation ? { nom: d.validation.nom, role: d.validation.role, iso: d.validation.iso } : null,
      decision: d.decision ? { nom: d.decision.nom, fonction: d.decision.fonction, decision: d.decision.decision, iso: d.decision.iso } : null,
    }));
  }

  // Plafond de lectures : chaque lecture mobilise le lecteur du cabinet, on borne par adresse et au total, par jour.
  async quota(empreinte) {
    const jour = new Date().toISOString().slice(0, 10);
    const kTotal = `q:${jour}:total`, kIp = `q:${jour}:${empreinte}`;
    const [total, parIp] = await Promise.all([this.ctx.storage.get(kTotal), this.ctx.storage.get(kIp)]);
    if (!total) { // premier passage du jour : on efface les compteurs des jours précédents
      const vieux = [...(await this.ctx.storage.list({ prefix: "q:" })).keys()].filter((k) => !k.startsWith(`q:${jour}:`));
      for (let i = 0; i < vieux.length; i += 128) await this.ctx.storage.delete(vieux.slice(i, i + 128));
    }
    if ((parIp || 0) >= QUOTA_IP) return { ok: false, erreur: `Limite de ${QUOTA_IP} lectures par jour atteinte pour votre adresse. Réessayez demain ou utilisez les règles locales.` };
    if ((total || 0) >= QUOTA_JOUR) return { ok: false, erreur: "Le nombre de lectures de la journée est atteint. Réessayez demain ou utilisez les règles locales." };
    await this.ctx.storage.put({ [kTotal]: (total || 0) + 1, [kIp]: (parIp || 0) + 1 });
    return { ok: true };
  }

  // Mesure d'audience sans cookie : un compteur de visites de la page d'accueil par jour, rien d'autre.
  async visite() {
    const k = `v:${new Date().toISOString().slice(0, 10)}`;
    await this.ctx.storage.put(k, ((await this.ctx.storage.get(k)) || 0) + 1);
  }

  async stats() {
    const visites = Object.fromEntries([...(await this.ctx.storage.list({ prefix: "v:" })).entries()].map(([k, v]) => [k.slice(2), v]));
    const dossiers = {}, conversations = {};
    for (const d of (await this.ctx.storage.list({ prefix: "dossier:" })).values()) { const j = new Date(d.cree).toISOString().slice(0, 10); dossiers[j] = (dossiers[j] || 0) + 1; }
    for (const c of (await this.ctx.storage.list({ prefix: "conv:" })).values()) { if (!c.messages?.length) continue; const j = new Date(c.cree).toISOString().slice(0, 10); conversations[j] = (conversations[j] || 0) + 1; }
    return { visites, dossiers, conversations };
  }

  async etat() {
    const m = await this.ctx.storage.list({ prefix: "dossier:" });
    let enAttente = 0;
    for (const d of m.values()) if (d.statut === "en_attente" || d.statut === "en_cours") enAttente++;
    for (const c of (await this.ctx.storage.list({ prefix: "conv:" })).values()) if (c.statut === "en_attente" || c.statut === "en_cours") enAttente++;
    const vu = (await this.ctx.storage.get("pont:vu")) || 0;
    return { pont: { enLigne: Date.now() - vu < PONT_ONLINE, vu }, enAttente };
  }

  // Le pont local réclame le plus ancien dossier en attente (ou un dossier pris depuis trop longtemps).
  async suivant() {
    await this.ctx.storage.put("pont:vu", Date.now());
    const now = Date.now();
    let pick = null, pickAt = Infinity;
    const consider = (x, at) => { const stale = x.statut === "en_cours" && now - x.maj > PONT_TIMEOUT; if ((x.statut === "en_attente" || stale) && at < pickAt) { pick = x; pickAt = at; } };
    for (const d of (await this.ctx.storage.list({ prefix: "dossier:" })).values()) consider(d, d.cree);
    for (const c of (await this.ctx.storage.list({ prefix: "conv:" })).values()) consider(c, c.demande || c.maj);
    if (!pick) return null;
    pick.statut = "en_cours"; pick.maj = now; pick.tentatives = (pick.tentatives || 0) + 1;
    if (pick.id.startsWith("CV-")) {
      await this.ctx.storage.put(`conv:${pick.id}`, pick);
      return { id: pick.id, model: MODEL_CHAT, system: CHAT_SYSTEM, prompt: chatPrompt(pick, await this._pieces(pick)), schema: CHAT_SCHEMA, tentative: pick.tentatives };
    }
    await this.ctx.storage.put(`dossier:${pick.id}`, pick);
    const contract = await this._contract(pick);
    return { id: pick.id, model: MODEL_PONT, system: SYSTEM, prompt: userPrompt({ ...pick.input, contract }), schema: SCHEMA, tentative: pick.tentatives };
  }

  // Résultat renvoyé par le pont ou par l'API : vérification des citations puis barème.
  async terminer(id, reading, moteur, modele = "") {
    const d = await this.ctx.storage.get(`dossier:${id}`);
    if (!d) return null;
    d.modele = modele; // nom du modèle conservé dans le dossier, jamais affiché
    const contract = await this._contract(d);
    const lecture = verifyReading(contract, reading);
    d.resultat = analyse({ ...d.input, contract }, {
      findings: lecture.clauses, moteur,
      lecture: { langue: lecture.langue, type_document: lecture.type_document, parties: lecture.parties, observations: lecture.observations || [], confiance: lecture.confiance, citations: lecture.citations },
    });
    d.statut = "termine"; d.erreur = null; d.maj = Date.now();
    await this.ctx.storage.put(`dossier:${id}`, d);
    return this.public(d);
  }

  async echouer(id, message, definitif = false) {
    const d = await this.ctx.storage.get(`dossier:${id}`);
    if (!d) return null;
    d.erreur = message; d.maj = Date.now();
    d.statut = definitif || (d.tentatives || 0) >= 2 ? "erreur" : "en_attente";
    await this.ctx.storage.put(`dossier:${id}`, d);
    return this.public(d);
  }

  // Conversations : l'utilisateur dialogue, dépose des pièces, l'assistant réclame ce qui manque puis lit.
  async convCreer() {
    const n = ((await this.ctx.storage.get("compteur_conv")) || 0) + 1;
    await this.ctx.storage.put("compteur_conv", n);
    const id = `CV-${new Date().getFullYear()}-${String(n).padStart(4, "0")}`;
    const now = Date.now();
    const c = { id, cree: now, maj: now, statut: "idle", messages: [], pieces: [], dossier: {}, dossierId: null, erreur: null, tentatives: 0 };
    await this.ctx.storage.put(`conv:${id}`, c);
    return this.convPublic(c);
  }

  async convLire(id) { const c = await this.ctx.storage.get(`conv:${id}`); return c ? this.convPublic(c) : null; }

  async convMessage(id, text, pieces) {
    const c = await this.ctx.storage.get(`conv:${id}`);
    if (!c) return { error: "Conversation inconnue.", status: 404 };
    if (c.statut === "en_attente" || c.statut === "en_cours") return { error: "Une réponse est en cours, attendez-la avant d'envoyer un autre message.", status: 409 };
    const total = c.pieces.reduce((a, p) => a + p.chars, 0);
    let budget = MAX_CONTRACT - total;
    const added = [];
    for (const p of pieces) {
      const texte = p.texte.slice(0, Math.max(0, budget)); budget -= texte.length;
      if (!texte.trim()) continue;
      const n = c.pieces.length;
      const chunks = []; for (let i = 0; i < texte.length; i += CHUNK) chunks.push(texte.slice(i, i + CHUNK));
      for (let i = 0; i < chunks.length; i++) await this.ctx.storage.put(`piece:${id}:${n}:${i}`, chunks[i]);
      const piece = { nom: p.nom, mots: texte.trim().split(/\s+/).filter(Boolean).length, chars: texte.length, tranches: chunks.length };
      c.pieces.push(piece); added.push({ nom: piece.nom, mots: piece.mots });
    }
    if (!text && !added.length) return { error: "Message vide.", status: 400 };
    c.messages.push({ role: "user", text: text || (added.length ? "Voici le document." : ""), at: Date.now(), pieces: added });
    if (c.messages.length > 40) c.messages = c.messages.slice(-40);
    c.statut = "en_attente"; c.tentatives = 0; c.erreur = null; c.maj = Date.now(); c.demande = Date.now();
    await this.ctx.storage.put(`conv:${id}`, c);
    return { conv: this.convPublic(c) };
  }

  async _pieces(c) {
    const out = [];
    for (let n = 0; n < c.pieces.length; n++) {
      let texte = "";
      for (let i = 0; i < c.pieces[n].tranches; i++) texte += (await this.ctx.storage.get(`piece:${c.id}:${n}:${i}`)) || "";
      out.push({ ...c.pieces[n], texte });
    }
    return out;
  }

  // Réponse du modèle pour une conversation : message, dossier déduit, et lecture si tout est réuni.
  async convResultat(id, res) {
    const c = await this.ctx.storage.get(`conv:${id}`);
    if (!c) return null;
    const now = Date.now();
    c.dossier = mergeDossier(c.dossier, res && res.dossier);
    const message = String((res && res.message) || "").trim() || "Je n'ai pas pu formuler de réponse. Pouvez-vous reformuler ?";
    c.messages.push({ role: "assistant", text: message, at: now });
    const d = c.dossier;
    if (res && res.pret && res.lecture && Array.isArray(res.lecture.clauses) && c.pieces.length && d.outil && d.fournisseur && d.cas_usage) {
      const pieces = await this._pieces(c);
      const contract = pieces.map((p) => `=== ${p.nom} ===\n${p.texte}`).join("\n\n");
      const input = { tool: d.outil, vendor: d.fournisseur, category: d.categorie || "autre", useCase: d.cas_usage, dataTypes: d.donnees || [], countries: d.pays || "", users: d.utilisateurs || 0, contract, source: `Conversation ${c.id}, ${pieces.map((p) => p.nom).join(", ")}` };
      const opened = await this.creer(input, "connecteur", false);
      const done = await this.terminer(opened.id, res.lecture, "lecture intégrale v1 (conversation)", MODEL_CHAT);
      c.dossierId = done.id;
      c.messages.push({ role: "assistant", text: avisMessage(done), at: Date.now(), dossier: { id: done.id, verdict: done.resultat.verdict, score: done.resultat.score } });
    }
    c.statut = "idle"; c.erreur = null; c.maj = Date.now();
    await this.ctx.storage.put(`conv:${id}`, c);
    return this.convPublic(c);
  }

  async convEchouer(id, message) {
    const c = await this.ctx.storage.get(`conv:${id}`);
    if (!c) return null;
    c.erreur = message; c.maj = Date.now();
    c.statut = (c.tentatives || 0) >= 2 ? "erreur" : "en_attente";
    await this.ctx.storage.put(`conv:${id}`, c);
    return this.convPublic(c);
  }

  convPublic(c) {
    return { id: c.id, statut: c.statut, erreur: c.erreur, dossier: c.dossier, dossierId: c.dossierId, pieces: c.pieces.map((p) => ({ nom: p.nom, mots: p.mots })), messages: c.messages, maj: c.maj };
  }

  // Lecture par l'API Anthropic, déclenchée par alarme pour ne pas dépendre de la durée de la requête HTTP.
  async alarm() {
    const key = this.env.ANTHROPIC_API_KEY;
    if (!key) return;
    const m = await this.ctx.storage.list({ prefix: "dossier:" });
    const todo = [...m.values()].filter((d) => d.statut === "en_attente_api").sort((a, b) => a.cree - b.cree);
    if (!todo.length) return;
    const d = todo[0];
    d.statut = "en_cours_api"; d.maj = Date.now(); d.tentatives = (d.tentatives || 0) + 1;
    await this.ctx.storage.put(`dossier:${d.id}`, d);
    try {
      const reading = await lireParApi(key, { ...d.input, contract: await this._contract(d) });
      await this.terminer(d.id, reading, "lecture intégrale v1 (API)", MODEL_API);
    } catch (e) {
      console.error("lecture API", d.id, e);
      d.erreur = String(e && e.message ? e.message : e); d.maj = Date.now();
      d.statut = d.tentatives >= 2 ? "erreur" : "en_attente_api";
      await this.ctx.storage.put(`dossier:${d.id}`, d);
    }
    if (todo.length > 1 || d.statut === "en_attente_api") await this.ctx.storage.setAlarm(Date.now() + 1000);
  }

  // Vue renvoyée au navigateur : sans le texte du contrat.
  public(d) {
    const { input, modele, ...rest } = d;
    const { contract, ...meta } = input;
    if (typeof contract === "string") meta.contrat_mots = contract.trim().split(/\s+/).filter(Boolean).length;
    if (rest.resultat && rest.resultat.meta) rest.resultat = { ...rest.resultat, meta: { ...rest.resultat.meta, moteur: neutre(rest.resultat.meta.moteur) } };
    return { ...rest, input: meta, validation: d.validation ? { ...d.validation, when: fmtDateTime(d.validation.iso) } : null, decision: d.decision ? { ...d.decision, when: fmtDateTime(d.decision.iso) } : null };
  }
}

async function lireParApi(apiKey, input) {
  const client = new Anthropic({ apiKey, timeout: 15 * 60 * 1000, maxRetries: 2 });
  const response = await client.beta.messages.create({
    model: MODEL_API,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(input) }],
    output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
  });
  if (response.stop_reason === "refusal") throw new Error("Lecture refusée par le modèle" + (response.stop_details?.explanation ? ` : ${response.stop_details.explanation}` : ""));
  if (response.stop_reason === "max_tokens") throw new Error("Réponse du modèle tronquée");
  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  return JSON.parse(text);
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function fmtDateTime(iso) {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t)?.value;
  return `${Number(g("day"))} ${MONTHS[Number(g("month")) - 1]} ${g("year")} à ${g("hour")} h ${g("minute")}`;
}

// Nettoyage et validation du dossier reçu du navigateur.
const CATEGORIES = new Set(["chatbot", "rh", "marketing", "support", "documents", "code", "autre"]);
const DATA = new Set(["aucune", "clients", "rh", "sante", "confidentiel", "code"]);
// Valeurs reçues d'un formulaire ou d'un assistant : on accepte les variantes courantes, on refuse le reste.
// Une valeur inconnue n'est jamais ignorée en silence : l'ignorer rendrait l'avis plus favorable qu'il ne doit l'être.
const plier = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
const DATA_ALIAS = {
  aucune: ["aucune", "aucun", "none", "aucune donnee", "aucune donnee personnelle", "pas de donnees", "non"],
  clients: ["clients", "client", "donnees clients", "donnees client", "personnelles", "donnees personnelles", "personal", "personal data", "customers", "customer data", "prospects", "utilisateurs", "usagers"],
  rh: ["rh", "hr", "salaries", "salarie", "employes", "employees", "candidats", "candidat", "donnees rh", "ressources humaines", "collaborateurs"],
  sante: ["sante", "donnees de sante", "medical", "medicales", "donnees medicales", "health", "health data", "patients"],
  confidentiel: ["confidentiel", "confidentielles", "confidentiel entreprise", "confidential", "secret", "secret des affaires", "strategique", "donnees confidentielles"],
  code: ["code", "code source", "source code", "logiciel"],
};
const CAT_ALIAS = {
  chatbot: ["chatbot", "assistant", "assistant interne", "agent conversationnel"],
  rh: ["rh", "hr", "recrutement", "ressources humaines", "recruiting", "recruitment"],
  marketing: ["marketing", "contenus", "communication"],
  support: ["support", "support client", "service client", "relation client", "customer support"],
  documents: ["documents", "document", "analyse de documents", "analyse documentaire"],
  code: ["code", "developpement", "development", "aide au developpement"],
  autre: ["autre", "other", "autres"],
};
const resoudre = (alias, v) => { const k = plier(v); return Object.keys(alias).find((id) => alias[id].includes(k)) || null; };

function cleanInput(b) {
  const s = (v, n) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, n);
  const brut = Array.isArray(b.dataTypes) ? b.dataTypes : typeof b.dataTypes === "string" && b.dataTypes.trim() ? b.dataTypes.split(/[,;]/) : [];
  const inconnues = brut.filter((d) => String(d ?? "").trim() && !resoudre(DATA_ALIAS, d));
  if (inconnues.length) return { error: `Type de données non reconnu : ${inconnues.map((d) => `« ${String(d).slice(0, 40)} »`).join(", ")}. Valeurs acceptées : ${[...DATA].join(", ")}.` };
  const cat = String(b.category ?? "").trim() ? resoudre(CAT_ALIAS, b.category) : "autre";
  if (!cat) return { error: `Catégorie non reconnue : « ${String(b.category).slice(0, 40)} ». Valeurs acceptées : ${[...CATEGORIES].join(", ")}.` };
  const input = {
    tool: s(b.tool, 120), vendor: s(b.vendor, 120),
    category: cat,
    useCase: s(b.useCase, 2000),
    dataTypes: [...new Set(brut.map((d) => resoudre(DATA_ALIAS, d)).filter(Boolean))].slice(0, 6),
    countries: s(b.countries, 200), users: Math.max(0, Math.min(10_000_000, Number(b.users) || 0)),
    contract: String(b.contract ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, MAX_CONTRACT),
    source: s(b.source, 300),
    departement: s(b.departement, 80), responsable: s(b.responsable, 80), complement: s(b.complement, 1500),
    usage: b.usage === "externe" ? "externe" : b.usage === "interne" ? "interne" : "",
    documents: (Array.isArray(b.documents) ? b.documents : []).slice(0, 10).map((x) => ({ nom: s(x?.nom, 120), format: s(x?.format, 12), taille: Math.max(0, Number(x?.taille) || 0), mots: Math.max(0, Number(x?.mots) || 0) })).filter((x) => x.nom),
  };
  if (!input.tool || !input.vendor || !input.useCase) return { error: "Renseignez le nom de l'outil, le fournisseur et le cas d'usage." };
  return { input };
}

// Récupération d'une page de conditions en ligne : HTML vers texte lisible.
function htmlToText(html) {
  let h = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ");
  const title = (h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const main = (h.match(/<main[\s\S]*?<\/main>/i) || h.match(/<article[\s\S]*?<\/article>/i) || [])[0];
  if (main && main.length > 3000) h = main;
  h = h.replace(/<\/(p|div|li|h[1-6]|tr|section|article|blockquote|pre|dd|dt)>/gi, "\n").replace(/<(br|hr)\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  const ent = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ugrave: "ù", ecirc: "ê", ocirc: "ô", icirc: "î", acirc: "â", hellip: "…", ndash: "–", mdash: "—" };
  h = h.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, c) => {
    if (c[0] === "#") { const n = c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ent[c.toLowerCase()] ?? m;
  });
  // Les menus et pieds de page reviennent plusieurs fois : une ligne courte déjà vue est ignorée.
  const seen = new Set();
  const lines = h.split("\n").map((l) => l.replace(/[ \t\u00A0]+/g, " ").trim()).filter((l) => { if (!l) return false; if (l.length < 80) { if (seen.has(l)) return false; seen.add(l); } return true; });
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  return { title: title.replace(/\s+/g, " ").trim(), text };
}

async function extraction(body) {
  let u;
  try { u = new URL(String(body.url || "").trim()); } catch { return err("Adresse invalide."); }
  if (u.protocol !== "https:" && u.protocol !== "http:") return err("Seules les adresses http(s) sont acceptées.");
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(u.hostname)) return err("Adresse refusée.");
  let r;
  try { r = await fetch(u.toString(), { headers: { "user-agent": "Mozilla/5.0 (compatible; Aucteva/1.0; +https://custodix-ai.gererseul-avis-worker.workers.dev)", accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" }, redirect: "follow", cf: { cacheTtl: 0 } }); }
  catch (e) { return err("La page n'a pas pu être récupérée : " + (e.message || e)); }
  if (!r.ok) return err(`La page répond ${r.status}. Si le site bloque les robots, copiez le texte ou déposez le PDF.`);
  const type = (r.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/pdf")) return err("Cette adresse est un PDF : téléchargez-le puis déposez le fichier dans le formulaire.");
  const raw = await r.text();
  const { title, text } = type.includes("text/plain") ? { title: "", text: raw } : htmlToText(raw);
  const mots = text.split(/\s+/).filter(Boolean).length;
  if (mots < 150) return err("La page ne contient pas assez de texte lisible (site dynamique ou protégé). Copiez le texte ou déposez le PDF.");
  return ok({ ok: true, titre: title, texte: text.slice(0, MAX_CONTRACT), mots, url: u.toString() });
}

// Sans clé API ni pont permanent, chaque dossier réveille le workflow GitHub Actions du dépôt (secrets GITHUB_TOKEN, GITHUB_REPO),
// qui installe Claude Code, vide la file avec pont.js --once et s'arrête. Rien ne se passe si les secrets manquent.
async function declencherGitHub(env, id) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return;
  try {
    const r = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/dispatches`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "custodix-ai-worker", "x-github-api-version": "2022-11-28" },
      body: JSON.stringify({ event_type: "custodix-dossier", client_payload: { id } }),
    });
    if (r.status !== 204) console.error("GitHub dispatch", r.status, await r.text());
  } catch (e) { console.error("GitHub dispatch", e); }
}

const bearer = (request, env) => {
  const h = request.headers.get("authorization") || "";
  return !!env.PONT_TOKEN && h === `Bearer ${env.PONT_TOKEN}`;
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") { url.protocol = "https:"; return Response.redirect(url.toString(), 301); }
    if (url.pathname === "/mcp" || url.pathname === "/mcp/") {
      const registre = env.REGISTRE.get(env.REGISTRE.idFromName("principal"));
      const quota = async () => registre.quota(await empreinte(request, env));
      return handleMcp(request, { registre, env, base: url.origin, cleanInput, declencherGitHub, quota });
    }
    if (!url.pathname.startsWith("/api/")) {
      if (url.pathname === "/" && request.method === "GET" && (request.headers.get("accept") || "").includes("text/html") && !/bot|crawl|spider|preview|headless/i.test(request.headers.get("user-agent") || "")) {
        ctx.waitUntil(env.REGISTRE.get(env.REGISTRE.idFromName("principal")).visite().catch(() => {}));
      }
      return avecEntetes(await env.ASSETS.fetch(request));
    }
    const registre = env.REGISTRE.get(env.REGISTRE.idFromName("principal"));
    const path = url.pathname.slice(4);
    const method = request.method;
    const json = async () => { try { return await request.json(); } catch { return null; } };

    try {
      if (path === "/health") return ok({ ok: true });

      if (path === "/etat" && method === "GET") {
        const e = await registre.etat();
        const api = !!env.ANTHROPIC_API_KEY;
        const github = !!(env.GITHUB_TOKEN && env.GITHUB_REPO);
        return ok({ ok: true, api, github, pont: e.pont, enAttente: e.enAttente, lecture: api ? "api" : e.pont.enLigne ? "pont" : github ? "github" : null });
      }

      if (path === "/extraction" && method === "POST") { const b = await json(); return b ? extraction(b) : err("Corps JSON attendu."); }

      if (path === "/examens" && method === "POST") {
        const b = await json(); if (!b) return err("Corps JSON attendu.");
        const { input, error } = cleanInput(b);
        if (error) return err(error);
        const mode = b.mode === "claude" ? "claude" : "regles";
        if (mode === "claude" && input.contract.length < 200) return err("La lecture intégrale demande un contrat d'au moins quelques paragraphes.");
        if (mode === "claude") { const q = await registre.quota(await empreinte(request, env)); if (!q.ok) return err(q.erreur, 429); }
        const d = await registre.creer(input, mode, !!env.ANTHROPIC_API_KEY);
        if (mode === "claude" && !env.ANTHROPIC_API_KEY) ctx.waitUntil(declencherGitHub(env, d.id));
        return ok({ ok: true, dossier: d });
      }

      let m;
      if ((m = path.match(/^\/examens\/([A-Z0-9-]+)$/)) && method === "GET") {
        const d = await registre.lire(m[1]);
        return d ? ok({ ok: true, dossier: d }) : err("Dossier inconnu.", 404);
      }
      if ((m = path.match(/^\/examens\/([A-Z0-9-]+)\/validation$/)) && method === "POST") {
        const b = await json(); if (!b) return err("Corps JSON attendu.");
        const nom = String(b.nom || "").trim().slice(0, 80);
        const role = ["Avocat", "Avocat associé", "DPO", "Expert conformité", "Expert IA"].includes(b.role) ? b.role : "Avocat";
        if (!nom) return err("Le nom est requis.");
        const d = await registre.valider(m[1], nom, role);
        return d ? ok({ ok: true, dossier: d }) : err("Dossier inconnu ou examen non terminé.", 404);
      }
      if ((m = path.match(/^\/examens\/([A-Z0-9-]+)\/contrat$/)) && method === "GET") {
        const t = await registre.contrat(m[1]);
        return t === null ? err("Dossier inconnu.", 404) : ok({ ok: true, texte: t });
      }
      if ((m = path.match(/^\/examens\/([A-Z0-9-]+)\/decision$/)) && method === "POST") {
        const b = await json(); if (!b) return err("Corps JSON attendu.");
        const nom = String(b.nom || "").trim().slice(0, 80), fonction = String(b.fonction || "").trim().slice(0, 80);
        const decision = ["autorise", "autorise_conditions", "refuse"].includes(b.decision) ? b.decision : null;
        if (!nom || !fonction) return err("Le nom et la fonction de la personne habilitée sont requis.");
        if (!decision) return err("Choisissez une décision : autorisé, autorisé sous conditions ou refusé.");
        const r = await registre.decider(m[1], { nom, fonction, decision, motif: String(b.motif || "").trim().slice(0, 1000) });
        return r.erreur ? err(r.erreur, r.status) : ok({ ok: true, dossier: r.dossier });
      }
      if (path === "/registre" && method === "GET") return ok({ ok: true, dossiers: await registre.liste() });

      // Conversations.
      if (path === "/conversations" && method === "POST") return ok({ ok: true, conversation: await registre.convCreer() });
      if ((m = path.match(/^\/conversations\/(CV-[0-9-]+)$/)) && method === "GET") {
        const c = await registre.convLire(m[1]);
        return c ? ok({ ok: true, conversation: c }) : err("Conversation inconnue.", 404);
      }
      if ((m = path.match(/^\/conversations\/(CV-[0-9-]+)\/messages$/)) && method === "POST") {
        const b = await json(); if (!b) return err("Corps JSON attendu.");
        const text = String(b.text || "").replace(/\u0000/g, "").trim().slice(0, 6000);
        if (!text && !(Array.isArray(b.pieces) && b.pieces.length)) return err("Message vide.");
        { const q = await registre.quota(await empreinte(request, env)); if (!q.ok) return err(q.erreur, 429); }
        const pieces = (Array.isArray(b.pieces) ? b.pieces : []).slice(0, 6).map((p) => ({ nom: String(p.nom || "document").slice(0, 120), texte: String(p.texte || "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim() })).filter((p) => p.texte);
        const r = await registre.convMessage(m[1], text, pieces);
        if (r.error) return err(r.error, r.status);
        if (!env.ANTHROPIC_API_KEY) ctx.waitUntil(declencherGitHub(env, m[1]));
        return ok({ ok: true, conversation: r.conv });
      }

      // Pont local : réservé au jeton partagé.
      if (path.startsWith("/pont/")) {
        if (!bearer(request, env)) return err("Non autorisé.", 401);
        if (path === "/pont/suivant" && method === "GET") return ok({ ok: true, dossier: await registre.suivant() });
        if (path === "/pont/stats" && method === "GET") return ok({ ok: true, ...(await registre.stats()) });
        if ((m = path.match(/^\/pont\/resultat\/([A-Z0-9-]+)$/)) && method === "POST") {
          const b = await json(); if (!b) return err("Corps JSON attendu.");
          if (m[1].startsWith("CV-")) {
            if (b.erreur) { const c = await registre.convEchouer(m[1], String(b.erreur).slice(0, 500)); return c ? ok({ ok: true, conversation: c }) : err("Conversation inconnue.", 404); }
            if (!b.lecture || typeof b.lecture.message !== "string") return err("Réponse invalide.");
            const c = await registre.convResultat(m[1], b.lecture);
            return c ? ok({ ok: true, conversation: c }) : err("Conversation inconnue.", 404);
          }
          if (b.erreur) { const d = await registre.echouer(m[1], String(b.erreur).slice(0, 500), !!b.definitif); return d ? ok({ ok: true, dossier: d }) : err("Dossier inconnu.", 404); }
          if (!b.lecture || !Array.isArray(b.lecture.clauses)) return err("Lecture invalide.");
          const origine = String(b.origine || "pont local").slice(0, 40);
          const d = await registre.terminer(m[1], b.lecture, `lecture intégrale v1 (${origine})`, String(b.modele || "").slice(0, 60));
          return d ? ok({ ok: true, dossier: d }) : err("Dossier inconnu.", 404);
        }
      }
      return err("Route inconnue.", 404);
    } catch (e) {
      console.error("api", path, e);
      return err("Erreur serveur.", 500);
    }
  },
};
