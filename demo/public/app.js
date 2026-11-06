// Aucteva : routeur par chemin. Site public (/, /produit, ...), démonstration (/demo), application (/app/...).
// Les anciennes adresses (/#/securite, /#/rapport/ID, /registre, ...) restent valides et sont réécrites.
import { renderLanding, renderProduct, renderHow, renderCases, renderSecurity, renderDemo, renderLegal, renderNotFound } from "./site.js";
import { renderOverview, renderTools, renderAssessments, renderQueue, renderRegistry, renderSettings, renderConnector } from "./shell.js";
import { renderNew, renderProgress, renderConversation, clearTimers } from "./assess.js";
import { renderDossier } from "./dossier.js";

const root = document.getElementById("root");
const SITE = "https://aucteva.pages.dev";
// Anciennes adresses, conservées : elles sont réécrites vers les nouvelles.
const ALIAS = [
  [/^\/analyse$/, () => "/app/nouveau/formulaire"], [/^\/registre$/, () => "/app/registre"], [/^\/connecteur$/, () => "/app/connecteur"],
  [/^\/rapport\/([A-Z0-9-]+)$/i, (m) => `/app/dossier/${m[1].toUpperCase()}`], [/^\/en-cours\/([A-Z0-9-]+)$/i, (m) => `/app/en-cours/${m[1].toUpperCase()}`],
  [/^\/conversation\/([A-Z0-9-]+)$/i, (m) => `/app/conversation/${m[1].toUpperCase()}`], [/^\/app\/nouveau\/conversation$/, () => "/app/nouveau"],
];
const PAGES = { produit: renderProduct, fonctionnement: renderHow, "cas-usage": renderCases, securite: renderSecurity };

function route() {
  clearTimers();
  // Liens d'avant le changement d'adresse : /#/securite devient /securite.
  if (location.hash.startsWith("#/")) history.replaceState(null, "", location.hash.slice(1));
  let path = location.pathname.replace(/\/+$/, "") || "/";
  for (const [re, to] of ALIAS) { const m = path.match(re); if (m) { path = to(m); history.replaceState(null, "", path); break; } }
  if (path !== location.pathname) history.replaceState(null, "", path + location.search);
  const canon = document.querySelector('link[rel="canonical"]'); if (canon) canon.href = SITE + (path === "/" ? "/" : path);
  const p = path.split("/").filter(Boolean);
  const id = (p[2] || "").toUpperCase();
  document.body.dataset.zone = p[0] === "app" ? "app" : "site";
  if (!p.length) return renderLanding(root);
  if (PAGES[p[0]] && p.length === 1) return PAGES[p[0]](root);
  if (p[0] === "demo" && p.length === 1) return renderDemo(root);
  if ((p[0] === "conditions" || p[0] === "confidentialite") && p.length === 1) return renderLegal(root, p[0]);
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

// Liens internes : pas de rechargement, l'adresse change et le routeur affiche l'écran.
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("a[href]");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target || a.hasAttribute("download")) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || /^\/(api|mcp)(\/|$)/.test(url.pathname) || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
  if (url.pathname === location.pathname && url.hash && !url.hash.startsWith("#/")) return; // ancre dans la page
  e.preventDefault();
  if (url.pathname + url.search !== location.pathname + location.search) history.pushState(null, "", url.pathname + url.search);
  route();
});
window.addEventListener("popstate", route);
window.addEventListener("hashchange", () => { if (location.hash.startsWith("#/")) route(); });
window.addEventListener("route", route);
route();
