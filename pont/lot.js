#!/usr/bin/env node
// Passe un lot de contrats réels (contrats-reels/*.md) dans Custodix AI, en lecture par Claude et en règles locales,
// puis écrit contrats-reels/resultats.md : avis, niveau, points bloquants, citations vérifiées, durée.
// Usage : node lot.js [filtre]   (filtre = début du nom de fichier, par exemple "rh-")

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyse } from "../demo/public/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "contrats-reels");
const envFile = join(here, ".env");
if (existsSync(envFile)) for (const line of readFileSync(envFile, "utf8").split("\n")) { const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const BASE = (process.env.CUSTODIX_URL || "https://custodix-ai.gererseul-avis-worker.workers.dev").replace(/\/$/, "");
const filtre = process.argv[2] || "";

// Cas d'usage plausible par famille : c'est lui qui fixe l'exposition (données, personnes concernées).
const CAS = {
  marketing: { category: "marketing", useCase: "Rédaction de contenus marketing (pages web, campagnes emails, posts) par l'équipe communication, à partir de briefs et de documents internes.", dataTypes: ["confidentiel"], users: 25 },
  support: { category: "support", useCase: "Assistant de support client sur le site et par email, qui répond aux clients à partir des historiques de conversation et de la base de connaissance.", dataTypes: ["clients"], users: 300 },
  rh: { category: "rh", useCase: "Présélection et évaluation des candidats (CV, entretiens, tests) et aide aux recruteurs pour le classement des candidatures.", dataTypes: ["rh"], users: 40 },
  public: { category: "chatbot", useCase: "Assistant conversationnel utilisé par les salariés pour rédiger, résumer et traduire des documents de travail, y compris des notes internes.", dataTypes: ["confidentiel", "clients"], users: 500 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(path, body) {
  const r = await fetch(BASE + "/api" + path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json();
  if (!r.ok || d.ok === false) throw new Error(d.erreur || `HTTP ${r.status}`);
  return d;
}

function lireFichier(name) {
  const raw = readFileSync(join(dir, name), "utf8");
  const head = Object.fromEntries(raw.split("\n").slice(0, 8).map((l) => l.split(/\s*:\s*/)).filter((p) => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join(":").trim()]));
  const body = raw.includes("\n---\n") ? raw.slice(raw.indexOf("\n---\n") + 5) : raw;
  return { head, body: body.trim() };
}

async function attendre(id) {
  for (;;) {
    const { dossier } = await api(`/examens/${id}`);
    if (dossier.statut === "termine" || dossier.statut === "erreur") return dossier;
    await sleep(4000);
  }
}

const files = readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "sources.md" && f !== "resultats.md" && f.startsWith(filtre)).sort();
const rows = [];
for (const f of files) {
  const famille = f.split("-")[0];
  const cas = CAS[famille] || CAS.public;
  const { head, body } = lireFichier(f);
  const input = { tool: head.Document || f, vendor: head.Fournisseur || famille, countries: "France", contract: body, source: `${f} (${head["URL source"] || ""})`, ...cas };
  const t0 = Date.now();
  process.stdout.write(`${f} … `);
  let regles, claude;
  try {
    regles = { resultat: analyse(input, { moteur: "règles v1" }) };
    const c = await api("/examens", { ...input, mode: "claude" });
    claude = await attendre(c.dossier.id);
  } catch (e) { console.log("échec :", e.message); rows.push({ f, erreur: e.message }); continue; }
  const sec = Math.round((Date.now() - t0) / 1000);
  const R = regles.resultat, C = claude.resultat;
  console.log(`règles ${R.verdict} ${R.score} | Claude ${claude.statut === "termine" ? `${C.verdict} ${C.score}` : "erreur " + claude.erreur} | ${sec} s`);
  rows.push({ f, head, famille, regles: R, claude: claude.statut === "termine" ? C : null, erreur: claude.erreur, id: claude.id, sec, mots: claude.input.contrat_mots });
}

const AVIS = { VERT: "Autorisé", ORANGE: "Sous conditions", ROUGE: "Non autorisé" };
const statuts = (r) => { const s = { dangereuse: 0, "ambiguë": 0, protectrice: r.clauses_protectrices.length, absent: r.clauses_manquantes.length }; for (const c of r.clauses_critiques) s[c.statut]++; return s; };
const out = [];
out.push("# Contrats réels passés dans Custodix AI", "", `Lot du ${new Date().toISOString().slice(0, 10)}, ${rows.length} documents, service ${BASE}. Lecture par Claude (claude-opus-5-5 via le pont local) et règles locales (douze motifs en français), même cas d'usage par famille.`, "");
out.push("| Document | Famille | Mots | Règles | Claude | Dangereuses | Ambiguës | Protectrices | Absentes | Citations vérifiées | Points bloquants | Durée |", "|---|---|---:|---|---|---:|---:|---:|---:|---|---:|---:|");
for (const r of rows) {
  if (r.erreur && !r.claude) { out.push(`| ${r.f} | | | | erreur : ${r.erreur} | | | | | | | |`); continue; }
  const s = statuts(r.claude); const L = r.claude.lecture || {};
  out.push(`| ${r.f} | ${r.famille} | ${r.mots} | ${AVIS[r.regles.verdict]} ${r.regles.score} | ${AVIS[r.claude.verdict]} ${r.claude.score} | ${s.dangereuse} | ${s["ambiguë"]} | ${s.protectrice} | ${s.absent} | ${L.citations ? `${L.citations.verifiees}/${L.citations.total}` : ""} | ${r.claude.points_bloquants.length} | ${r.sec} s |`);
}
out.push("", "## Détail par document", "");
for (const r of rows) {
  if (!r.claude) continue;
  const C = r.claude, L = C.lecture || {};
  out.push(`### ${r.head.Fournisseur || r.f}, ${r.head.Document || ""} (${r.id})`, "", `Source : ${r.head["URL source"] || ""}. ${L.type_document || ""} ${L.parties ? `Parties : ${L.parties}.` : ""}`, "", `Avis Claude : ${AVIS[C.verdict]}, niveau ${C.score}. Avis règles : ${AVIS[r.regles.verdict]}, niveau ${r.regles.score}.`, "");
  for (const c of C.clauses_critiques) out.push(`- ${c.statut}, ${c.sujet} : « ${c.extrait} » ${c.note ? `(${c.note})` : ""}`);
  for (const c of C.clauses_protectrices) out.push(`- protectrice, ${c.sujet} : « ${c.extrait} »`);
  if (C.clauses_manquantes.length) out.push(`- absentes : ${C.clauses_manquantes.map((c) => c.sujet).join(", ")}`);
  if (C.points_bloquants.length) out.push(`- points bloquants : ${C.points_bloquants.join(" ")}`);
  if (L.observations && L.observations.length) { out.push("", "Observations : " + L.observations.join(" ")); }
  out.push("");
}
writeFileSync(join(dir, "resultats.md"), out.join("\n"));
console.log(`\n${rows.length} documents, résultats dans contrats-reels/resultats.md`);
