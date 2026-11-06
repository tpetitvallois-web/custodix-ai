// Carte de travail affichée pendant qu'Aucteva lit un contrat ou prépare une réponse.
// Les deux premières étapes suivent l'état réel (demande reçue, prise en charge par le lecteur) ;
// la barre et la durée sont des estimations tirées des lectures déjà faites (30 à 70 s pour un contrat, 10 à 20 s pour une question).
import { getLang } from "./i18n.js";
import { esc, fmtInt, ICON } from "./ui.js";

const L = (fr, en) => (getLang() === "en" ? en : fr);
export const expectedSeconds = (reading, words = 0) => (reading ? Math.round(32 + Math.min(30, words / 500)) : 15);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// el : conteneur. opts : { reading, docs: [{ nom, mots }], started (ms), state: "queued" | "running" }.
export function mountWork(el, opts) {
  const words = (opts.docs || []).reduce((a, d) => a + (d.mots || 0), 0);
  const expected = expectedSeconds(opts.reading, words);
  const steps = opts.reading
    ? [L("Demande reçue", "Request received"), L("Prise en charge par le lecteur", "Picked up by the reader"), L(`Lecture intégrale, ${fmtInt(words)} mots`, `Full reading, ${fmtInt(words)} words`), L("Vérification des citations mot pour mot", "Word-for-word quote check"), L("Calcul de l'avis selon le barème", "Opinion computed from the scoring grid")]
    : [L("Question reçue", "Question received"), L("Prise en charge", "Picked up"), L("Rédaction de la réponse", "Writing the answer")];
  let state = opts.state || "queued";
  el.innerHTML = `
    <div class="wk" role="status" aria-live="polite">
      <div class="wk__head">
        <span class="wk__spin" aria-hidden="true"></span>
        <div class="wk__title"><strong>${opts.reading ? L("Aucteva lit le contrat", "Aucteva is reading the contract") : L("Aucteva prépare la réponse", "Aucteva is preparing the answer")}</strong><span class="wk__sub" data-sub></span></div>
        <div class="wk__clock"><span class="mono" data-clock>0:00</span><span>${L("env.", "approx.")} ${expected} s</span></div>
      </div>
      <div class="wk__bar" aria-hidden="true"><span data-fill></span></div>
      ${opts.reading && opts.docs?.length ? `<ul class="wk__docs">${opts.docs.map((d) => `<li>${ICON.doc}<span class="n">${esc(d.nom)}</span><span class="m">${fmtInt(d.mots)} ${L("mots", "words")}</span></li>`).join("")}</ul>` : ""}
      <ol class="wk__steps" data-steps></ol>
    </div>`;
  const paint = () => {
    const on = state === "running" ? 2 : 1;
    el.querySelector("[data-steps]").innerHTML = steps.map((s, i) => `<li class="${i < on ? "is-done" : i === on ? "is-on" : ""}"><span class="ic" aria-hidden="true">${i < on ? ICON.check : ""}</span><span>${esc(s)}</span>${i > on ? `<span class="later">${L("à venir", "next")}</span>` : ""}</li>`).join("");
  };
  const tick = () => {
    if (!el.isConnected) return stop();
    const sec = Math.max(0, (Date.now() - opts.started) / 1000);
    el.querySelector("[data-clock]").textContent = clock(sec);
    el.querySelector("[data-fill]").style.width = `${Math.round(94 * (1 - Math.exp(-2.2 * sec / expected)))}%`;
    el.querySelector("[data-sub]").textContent = sec > expected * 1.5
      ? L("Plus long que prévu. La lecture continue, rien n'est perdu.", "Taking longer than usual. The reading goes on, nothing is lost.")
      : state === "queued" ? L("En attente du lecteur", "Waiting for the reader") : opts.reading ? L("Chaque citation sera vérifiée dans le texte", "Every quote will be checked against the text") : L("Réponse fondée sur le dossier", "Answer based on the file");
  };
  const timer = setInterval(tick, 1000);
  function stop() { clearInterval(timer); }
  paint(); tick();
  return { set(next) { if (next !== state) { state = next; paint(); tick(); } }, stop };
}
