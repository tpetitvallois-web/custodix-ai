// Barre de l'assistant : une question libre, un contrat en pièce jointe, des exemples qui défilent dans le champ.
// Chaque exemple joint un vrai document : le contrat d'un scénario, ou un contrat réel déjà lu et gardé au registre.
import { t, getLang } from "./i18n.js";
import { api, esc, fmtInt, countWords, ICON, toast, slug } from "./ui.js";
import { readFile } from "./files.js";
import { SCENARIOS } from "./scenarios.js";

const L = (fr, en) => (getLang() === "en" ? en : fr);

export const EXAMPLES = [
  { tool: "Mistral AI", dossier: "CX-2026-0041", nom: "mistral-ai-commercial-terms.md", fr: "Tester notre nouveau contrat avec Mistral AI avant de le signer", en: "Test our new Mistral AI contract before we sign it" },
  { tool: "Zoom", dossier: "CX-2026-0037", nom: "zoom-terms-of-service.md", fr: "Zoom peut-il entraîner ses modèles d'IA sur nos réunions ?", en: "Can Zoom train its AI models on our meetings?" },
  { tool: "Intercom Fin", dossier: "CX-2026-0032", nom: "intercom-additional-product-terms.md", fr: "Notre service client veut déployer Intercom Fin. Quels sont les risques ?", en: "Our support team wants to deploy Intercom Fin. What are the risks?" },
  { tool: "RecruiterAI", scn: "recruiter", fr: "Les CV de nos candidats quittent-ils l'Union européenne avec RecruiterAI ?", en: "Do our candidates' CVs leave the EU with RecruiterAI?" },
  { tool: "HubSpot", dossier: "CX-2026-0030", nom: "hubspot-data-processing-agreement.md", fr: "Que prévoit HubSpot si nos données clients fuient ?", en: "What does HubSpot commit to if our customer data leaks?" },
  { tool: "MarketingAI", scn: "marketing", fr: "Le marketing veut produire ses contenus avec MarketingAI. Peut-on l'autoriser ?", en: "Marketing wants to produce content with MarketingAI. Can we approve it?" },
  { tool: "OpenAI", dossier: "CX-2026-0056", nom: "openai-data-processing-addendum.md", fr: "Relire l'accord de traitement des données d'OpenAI pour notre DPO", en: "Review OpenAI's data processing addendum for our DPO" },
  { tool: "SupportAI", scn: "support", fr: "Quelles clauses négocier avant de signer avec SupportAI ?", en: "Which clauses should we negotiate before signing with SupportAI?" },
];

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Démarre une conversation avec le premier message, puis ouvre la conversation dans l'application.
export async function startConversation(text, pieces) {
  const { conversation } = await api("/conversations", {});
  await api(`/conversations/${conversation.id}/messages`, { text, pieces });
  location.hash = `#/app/conversation/${conversation.id}`;
}

async function examplePiece(ex) {
  if (ex.scn) { const s = SCENARIOS.find((x) => x.id === ex.scn); return { nom: `contrat-${slug(s.tool)}.md`, texte: s.contract }; }
  const { texte } = await api(`/examens/${ex.dossier}/contrat`);
  return { nom: ex.nom, texte };
}

// el : conteneur. tone : "dark" sur fond bleu nuit, "light" dans l'application. chips : nombre d'exemples affichés sous la barre.
export function askBar(el, { tone = "light", chips = 5, autofocus = false } = {}) {
  const id = `ask${Math.random().toString(36).slice(2, 7)}`;
  const pieces = [];
  el.innerHTML = `
    <form class="ask ask--${tone}" novalidate>
      <div class="ask__pieces"></div>
      <div class="ask__row">
        <label class="ask__icon" for="${id}-f" title="${esc(t("ask.attach"))}">${ICON.clip}<span class="sr-only">${t("ask.attach")}</span></label>
        <input type="file" id="${id}-f" multiple accept=".pdf,.docx,.txt,.md,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
        <textarea class="ask__input" id="${id}-i" rows="1" aria-label="${esc(t("ask.label"))}" aria-describedby="${id}-h"></textarea>
        <button type="submit" class="ask__send" aria-label="${esc(t("ask.send"))}">${ICON.send}</button>
      </div>
      <div class="ask__drop" aria-hidden="true">${t("ask.drop")}</div>
    </form>
    <div class="ask__ex"><span class="ask__exlabel">${t("ask.examples")}</span>${EXAMPLES.slice(0, chips).map((x, i) => `<button type="button" data-ex="${i}">${esc(x.tool)}</button>`).join("")}</div>
    <p class="ask__hint" id="${id}-h">${t("ask.hint")}<span class="ask__tab"> ${t("ask.tab")}</span></p>`;
  const form = el.querySelector("form"), input = el.querySelector("textarea"), send = el.querySelector(".ask__send"), piecesEl = el.querySelector(".ask__pieces");

  const paintPieces = () => {
    piecesEl.innerHTML = pieces.map((p, i) => `<span class="chip">${esc(p.nom)}, ${fmtInt(countWords(p.texte))} ${t("d.words")} <button type="button" data-rm="${i}" aria-label="${esc(t("d.remove"))}">×</button></span>`).join("");
    piecesEl.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { pieces.splice(Number(b.dataset.rm), 1); paintPieces(); input.focus(); }));
  };
  const grow = () => { input.style.height = "auto"; input.style.height = `${Math.min(180, input.scrollHeight)}px`; };
  const addFiles = async (files) => {
    for (const file of [...(files || [])].slice(0, 6)) {
      try { toast(`${L("Lecture de", "Reading")} ${file.name}`); const { texte } = await readFile(file); if (countWords(texte) < 20) { toast(`${file.name} : ${L("presque aucun texte lisible", "almost no readable text")}`, "err"); continue; } pieces.push({ nom: file.name, texte }); }
      catch (e) { toast(e.message, "err"); }
    }
    paintPieces(); input.focus();
  };

  // Exemples qui s'écrivent puis s'effacent dans le champ, tant qu'il est vide.
  let cur = 0, shown = "", phase = "type", timer = null;
  const tick = () => {
    if (!el.isConnected) return;
    const full = EXAMPLES[cur][getLang() === "en" ? "en" : "fr"];
    let wait = 40;
    if (reduced()) { input.placeholder = full; cur = (cur + 1) % EXAMPLES.length; timer = setTimeout(tick, 3800); return; }
    if (phase === "type") { shown = full.slice(0, shown.length + 1); if (shown === full) { phase = "hold"; wait = 2200; } }
    else if (phase === "hold") { phase = "erase"; wait = 30; }
    else { shown = shown.slice(0, -2); wait = 14; if (!shown) { phase = "type"; cur = (cur + 1) % EXAMPLES.length; wait = 350; } }
    input.placeholder = shown;
    timer = setTimeout(tick, wait);
  };
  tick();

  const useExample = async (ex) => {
    input.value = ex[getLang() === "en" ? "en" : "fr"]; grow();
    if (!pieces.some((p) => p.ex === ex.tool)) {
      for (let i = pieces.length - 1; i >= 0; i--) if (pieces[i].ex) pieces.splice(i, 1);
      paintPieces();
      try { const p = await examplePiece(ex); pieces.push({ ...p, ex: ex.tool }); paintPieces(); }
      catch { toast(t("ask.nocontract"), "err"); }
    }
    input.focus(); input.setSelectionRange(input.value.length, input.value.length);
  };
  el.querySelectorAll("[data-ex]").forEach((b) => b.addEventListener("click", () => useExample(EXAMPLES[Number(b.dataset.ex)])));

  input.addEventListener("input", grow);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    if (e.key === "Tab" && !e.shiftKey && !input.value && input.placeholder) { e.preventDefault(); useExample(EXAMPLES[cur]); }
  });
  el.querySelector('input[type="file"]').addEventListener("change", async (e) => { await addFiles(e.target.files); e.target.value = ""; });
  form.addEventListener("dragover", (e) => { e.preventDefault(); form.classList.add("is-drag"); });
  form.addEventListener("dragleave", (e) => { if (!form.contains(e.relatedTarget)) form.classList.remove("is-drag"); });
  form.addEventListener("drop", (e) => { e.preventDefault(); form.classList.remove("is-drag"); addFiles(e.dataTransfer.files); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text && !pieces.length) { input.focus(); return; }
    send.disabled = true; form.classList.add("is-busy");
    try { await startConversation(text, pieces.map(({ nom, texte }) => ({ nom, texte }))); clearTimeout(timer); }
    catch (err) { toast(err.message, "err"); send.disabled = false; form.classList.remove("is-busy"); }
  });
  if (autofocus) requestAnimationFrame(() => input.focus({ preventScroll: true }));
  return { input };
}
