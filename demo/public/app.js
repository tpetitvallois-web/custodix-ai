// Aucteva : routeur. Site public (#/), démonstration (#/demo), application (#/app/...).
// Les anciennes adresses (#/analyse, #/rapport/ID, #/registre, ...) restent valides et sont redirigées.
import { renderLanding, renderDemo, renderLegal, renderNotFound } from "./site.js";
import { renderOverview, renderTools, renderAssessments, renderQueue, renderRegistry, renderSettings, renderConnector } from "./shell.js";
import { renderNew, renderProgress, renderConversation, clearTimers } from "./assess.js";
import { renderDossier } from "./dossier.js";

const root = document.getElementById("root");
const ALIAS = [
  [/^#\/analyse/, () => "#/app/nouveau"], [/^#\/registre/, () => "#/app/registre"], [/^#\/connecteur/, () => "#/app/connecteur"],
  [/^#\/rapport\/([A-Z0-9-]+)/i, (m) => `#/app/dossier/${m[1].toUpperCase()}`], [/^#\/en-cours\/([A-Z0-9-]+)/i, (m) => `#/app/en-cours/${m[1].toUpperCase()}`],
  [/^#\/conversation\/([A-Z0-9-]+)/i, (m) => `#/app/conversation/${m[1].toUpperCase()}`],
];
const ANCHORS = { produit: "produit", fonctionnement: "fonctionnement", "cas-usage": "cas-usage", securite: "securite" };

function route() {
  clearTimers();
  const hash = location.hash || "#/";
  for (const [re, to] of ALIAS) { const m = hash.match(re); if (m) { location.replace(to(m)); return; } }
  const p = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const id = (p[2] || "").toUpperCase();
  document.body.dataset.zone = p[0] === "app" ? "app" : "site";
  if (!p.length) return renderLanding(root);
  if (ANCHORS[p[0]]) return renderLanding(root, ANCHORS[p[0]]);
  if (p[0] === "demo") return renderDemo(root);
  if (p[0] === "conditions" || p[0] === "confidentialite") return renderLegal(root, p[0]);
  if (p[0] !== "app") return renderNotFound(root);
  switch (p[1]) {
    case undefined: return renderOverview(root);
    case "outils": return renderTools(root);
    case "nouveau": return renderNew(root, p[2]);
    case "dossiers": return renderAssessments(root);
    case "validation": return renderQueue(root);
    case "registre": return renderRegistry(root);
    case "parametres": return renderSettings(root);
    case "connecteur": return renderConnector(root);
    case "en-cours": return renderProgress(root, id);
    case "conversation": return renderConversation(root, id);
    case "dossier": return renderDossier(root, id, p[3] || "analyse");
    default: return renderNotFound(root);
  }
}

window.addEventListener("hashchange", route);
route();
