// Worker Cloudflare de Custodix AI : sert la page, tient le registre des dossiers (Durable Object)
// et fait lire les contrats par Claude, soit par l'API (secret ANTHROPIC_API_KEY), soit par le pont local (claude -p).
import { DurableObject } from "cloudflare:workers";
import Anthropic from "@anthropic-ai/sdk";
import { analyse } from "../public/engine.js";
import { SYSTEM, SCHEMA, userPrompt, verifyReading, MODEL_API, MODEL_PONT } from "./lecture.js";

const MAX_CONTRACT = 600_000; // caractères, environ 150 000 jetons
const PONT_TIMEOUT = 10 * 60 * 1000; // un dossier pris par le pont et sans réponse est remis en file
const PONT_ONLINE = 45 * 1000;
const CHUNK = 40_000; // caractères par tranche de contrat stockée // le pont est « en ligne » s'il a interrogé la file depuis moins de 45 s

const ok = (data, status = 200) => Response.json(data, { status });
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

  async liste(limit = 200) {
    const m = await this.ctx.storage.list({ prefix: "dossier:", reverse: true, limit });
    return [...m.values()].map((d) => ({
      id: d.id, statut: d.statut, mode: d.mode, cree: d.cree,
      outil: d.input.tool, fournisseur: d.input.vendor, categorie: d.input.category,
      verdict: d.resultat?.verdict || null, score: d.resultat?.score ?? null, moteur: d.resultat?.meta?.moteur || null,
      validation: d.validation ? { nom: d.validation.nom, role: d.validation.role, iso: d.validation.iso } : null,
    }));
  }

  async etat() {
    const m = await this.ctx.storage.list({ prefix: "dossier:" });
    let enAttente = 0;
    for (const d of m.values()) if (d.statut === "en_attente" || d.statut === "en_cours") enAttente++;
    const vu = (await this.ctx.storage.get("pont:vu")) || 0;
    return { pont: { enLigne: Date.now() - vu < PONT_ONLINE, vu }, enAttente };
  }

  // Le pont local réclame le plus ancien dossier en attente (ou un dossier pris depuis trop longtemps).
  async suivant() {
    await this.ctx.storage.put("pont:vu", Date.now());
    const m = await this.ctx.storage.list({ prefix: "dossier:" });
    const now = Date.now();
    let pick = null;
    for (const d of m.values()) {
      const stale = d.statut === "en_cours" && now - d.maj > PONT_TIMEOUT;
      if ((d.statut === "en_attente" || stale) && (!pick || d.cree < pick.cree)) pick = d;
    }
    if (!pick) return null;
    pick.statut = "en_cours"; pick.maj = now; pick.tentatives = (pick.tentatives || 0) + 1;
    await this.ctx.storage.put(`dossier:${pick.id}`, pick);
    const contract = await this._contract(pick);
    return { id: pick.id, model: MODEL_PONT, system: SYSTEM, prompt: userPrompt({ ...pick.input, contract }), schema: SCHEMA, tentative: pick.tentatives };
  }

  // Résultat renvoyé par le pont ou par l'API : vérification des citations puis barème.
  async terminer(id, reading, moteur) {
    const d = await this.ctx.storage.get(`dossier:${id}`);
    if (!d) return null;
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
      await this.terminer(d.id, reading, `${MODEL_API} (API)`);
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
    const { input, ...rest } = d;
    const { contract, ...meta } = input;
    if (typeof contract === "string") meta.contrat_mots = contract.trim().split(/\s+/).filter(Boolean).length;
    return { ...rest, input: meta, validation: d.validation ? { ...d.validation, when: fmtDateTime(d.validation.iso) } : null };
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
function cleanInput(b) {
  const s = (v, n) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, n);
  const input = {
    tool: s(b.tool, 120), vendor: s(b.vendor, 120),
    category: CATEGORIES.has(b.category) ? b.category : "autre",
    useCase: s(b.useCase, 2000),
    dataTypes: Array.isArray(b.dataTypes) ? b.dataTypes.filter((d) => DATA.has(d)).slice(0, 6) : [],
    countries: s(b.countries, 200), users: Math.max(0, Math.min(10_000_000, Number(b.users) || 0)),
    contract: String(b.contract ?? "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, MAX_CONTRACT),
    source: s(b.source, 300),
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
  try { r = await fetch(u.toString(), { headers: { "user-agent": "Mozilla/5.0 (compatible; CustodixAI/1.0; +https://custodix-ai.gererseul-avis-worker.workers.dev)", accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5" }, redirect: "follow", cf: { cacheTtl: 0 } }); }
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
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
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
        if (mode === "claude" && input.contract.length < 200) return err("La lecture par Claude demande un contrat d'au moins quelques paragraphes.");
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
        const role = ["Avocat", "DPO", "Expert conformité", "Expert IA"].includes(b.role) ? b.role : "Avocat";
        if (!nom) return err("Le nom est requis.");
        const d = await registre.valider(m[1], nom, role);
        return d ? ok({ ok: true, dossier: d }) : err("Dossier inconnu ou examen non terminé.", 404);
      }
      if (path === "/registre" && method === "GET") return ok({ ok: true, dossiers: await registre.liste() });

      // Pont local : réservé au jeton partagé.
      if (path.startsWith("/pont/")) {
        if (!bearer(request, env)) return err("Non autorisé.", 401);
        if (path === "/pont/suivant" && method === "GET") return ok({ ok: true, dossier: await registre.suivant() });
        if ((m = path.match(/^\/pont\/resultat\/([A-Z0-9-]+)$/)) && method === "POST") {
          const b = await json(); if (!b) return err("Corps JSON attendu.");
          if (b.erreur) { const d = await registre.echouer(m[1], String(b.erreur).slice(0, 500), !!b.definitif); return d ? ok({ ok: true, dossier: d }) : err("Dossier inconnu.", 404); }
          if (!b.lecture || !Array.isArray(b.lecture.clauses)) return err("Lecture invalide.");
          const origine = String(b.origine || "pont local").slice(0, 40);
          const d = await registre.terminer(m[1], b.lecture, `${b.modele || "claude"} (${origine})`);
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
