#!/usr/bin/env node
// Pont local Custodix AI : relie le Worker en ligne au Claude de Tom (claude -p, abonnement Claude Code).
// Boucle : réclame le prochain dossier en attente, fait lire le contrat par Claude en JSON strict, renvoie la lecture.
// Lancement : node pont.js (ou l'agent launchd com.custodix.pont). Variables : CUSTODIX_URL, PONT_TOKEN (fichier .env à côté).
// node pont.js --once : vide la file puis s'arrête (mode GitHub Actions, déclenché par le Worker à chaque dossier).

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BASE = (process.env.CUSTODIX_URL || "https://custodix-ai.gererseul-avis-worker.workers.dev").replace(/\/$/, "");
const TOKEN = process.env.PONT_TOKEN;
const CLAUDE = process.env.CLAUDE_BIN || "claude";
const POLL_MS = Number(process.env.PONT_POLL_MS || 3000);
const TIMEOUT_MS = Number(process.env.PONT_TIMEOUT_MS || 12 * 60 * 1000);
const ONCE = process.argv.includes("--once");
const ONCE_GRACE_MS = Number(process.env.PONT_ONCE_GRACE_MS || 20000); // en mode --once, on attend encore un peu un dossier qui arriverait juste après

if (!TOKEN) { console.error("PONT_TOKEN manquant (fichier pont/.env)."); process.exit(1); }

const log = (...a) => console.log(new Date().toISOString().slice(0, 19).replace("T", " "), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const headers = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };

async function api(path, init = {}) {
  const r = await fetch(BASE + path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} → ${r.status} ${body.erreur || ""}`.trim());
  return body;
}

// Fait lire le contrat par claude -p avec un schéma JSON de sortie. Le prompt passe par stdin (taille libre).
function lire(dossier) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p", "--model", dossier.model || "opus", "--tools", "", "--no-session-persistence",
      "--output-format", "json", "--json-schema", JSON.stringify(dossier.schema), "--system-prompt", dossier.system,
    ];
    const env = { ...process.env };
    delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
    const child = spawn(CLAUDE, args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", errOut = "", done = false;
    const timer = setTimeout(() => { if (!done) { child.kill("SIGKILL"); reject(new Error(`délai dépassé (${Math.round(TIMEOUT_MS / 60000)} min)`)); } }, TIMEOUT_MS);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { errOut += d; });
    child.on("error", (e) => { done = true; clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      done = true; clearTimeout(timer);
      let parsed;
      try { parsed = JSON.parse(out); } catch { return reject(new Error(`sortie illisible (code ${code}) : ${(errOut || out).slice(0, 300)}`)); }
      if (parsed.is_error) return reject(new Error(`claude : ${String(parsed.result || "").slice(0, 300)}`));
      let lecture = parsed.structured_output;
      if (!lecture) { try { lecture = JSON.parse(parsed.result); } catch { return reject(new Error("réponse sans JSON structuré")); } }
      resolve({ lecture, modele: Object.keys(parsed.modelUsage || {})[0] || dossier.model || "claude", duree: parsed.duration_ms, cout: parsed.total_cost_usd });
    });
    child.stdin.end(dossier.prompt);
  });
}

async function boucle() {
  log(`pont démarré sur ${BASE}${ONCE ? " (une passe)" : ""}`);
  let idle = 0, vide = null;
  for (;;) {
    try {
      const { dossier } = await api("/api/pont/suivant");
      if (!dossier) {
        if (ONCE) { vide ??= Date.now(); if (Date.now() - vide > ONCE_GRACE_MS) { log("file vide, fin de la passe"); return; } }
        idle++; if (idle % 200 === 1) log("en attente de dossiers"); await sleep(POLL_MS); continue;
      }
      idle = 0; vide = null;
      log(`dossier ${dossier.id} : lecture par ${dossier.model} (tentative ${dossier.tentative})`);
      const t0 = Date.now();
      try {
        const { lecture, modele, duree } = await lire(dossier);
        const n = (lecture.clauses || []).length;
        await api(`/api/pont/resultat/${dossier.id}`, { method: "POST", body: JSON.stringify({ lecture, modele }) });
        log(`dossier ${dossier.id} : ${n} sujets lus en ${Math.round((duree || Date.now() - t0) / 1000)} s`);
      } catch (e) {
        log(`dossier ${dossier.id} : échec, ${e.message}`);
        await api(`/api/pont/resultat/${dossier.id}`, { method: "POST", body: JSON.stringify({ erreur: e.message }) }).catch((e2) => log("renvoi impossible", e2.message));
      }
    } catch (e) {
      log("réseau :", e.message);
      if (ONCE) { process.exitCode = 1; return; }
      await sleep(15000);
    }
  }
}

boucle();
