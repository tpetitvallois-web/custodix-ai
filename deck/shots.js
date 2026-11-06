// Captures de la démonstration en ligne (Aucteva) pour les decks, en 2x. NODE_PATH=~/gererseul-guide/node_modules node shots.js
// Dossier de référence : RecruiterAI ouvert par conversation (CV-2026-0003 → CX-2026-0050), lu en intégralité.
// L'examen en cours se capture sur une lecture intégrale lancée depuis la page démo (le lecteur doit être en ligne).
const { chromium } = require("playwright");
const URL = "https://custodix-ai.gererseul-avis-worker.workers.dev/";
const CONV = "CV-2026-0003", ID = "CX-2026-0050";
const VP = { width: 1280, height: 750 }; // ratio 1,707, celui des cadres du deck
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VP, deviceScaleFactor: 2 });
  await page.addInitScript(() => { try { localStorage.setItem("aucteva.lang", "fr"); } catch {} });
  const go = async (h, wait = 1500) => { await page.goto(URL + h, { waitUntil: "networkidle" }); await page.waitForTimeout(wait); };

  await go("#/", 1800);
  await page.screenshot({ path: "shots/accueil.png" });

  await go(`#/app/conversation/${CONV}`, 2000);
  await page.locator(".dcard").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/conversation.png" });

  // Analyse : contrat à gauche, domaines à droite, premier passage critique mis en évidence.
  await go(`#/app/dossier/${ID}`, 2500);
  await page.screenshot({ path: "shots/dossier.png" });
  // Une observation dépliée, reliée à son passage, avec ce qu'il faut vérifier et la clause corrective.
  const transfer = page.locator('.dim[data-dim="transfer"]');
  if (!(await transfer.evaluate((e) => e.classList.contains("is-open")))) await transfer.locator("> button").click();
  const go2 = transfer.locator("[data-go]").first();
  if (await go2.count()) await go2.click();
  await transfer.locator("details summary").first().click().catch(() => {});
  await page.waitForTimeout(900);
  await transfer.evaluate((e) => { const sc = document.scrollingElement; const r = e.getBoundingClientRect(); sc.scrollTo(0, sc.scrollTop + r.top - 120); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "shots/risques.png" });

  // Dossier de synthèse avec l'avenant type.
  await go(`#/app/dossier/${ID}/synthese`, 1800);
  await page.click("#av-show").catch(() => {});
  await page.waitForTimeout(400);
  await page.locator("#av").evaluate((e) => { const sc = document.scrollingElement; sc.scrollTo(0, sc.scrollTop + e.getBoundingClientRect().top - 160); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/avenant.png" });

  // Validation par l'avocat, puis décision d'utilisation (si ce n'est pas déjà fait).
  await go(`#/app/dossier/${ID}/decision`, 1800);
  if (await page.locator("#vf").count()) { await page.fill("#v-n", "Marie Dupont"); await page.click("#vf button[type=submit]"); await page.waitForTimeout(2500); }
  if (await page.locator("#df").count()) { await page.fill("#d-n", "Claire Martin"); await page.fill("#d-f", "Directrice juridique"); await page.check('input[name=dd][value=refuse]', { force: true }); await page.fill("#d-m", "Refus en l'état. Réexamen possible après avenant sur l'entraînement des modèles, la supervision humaine et les transferts hors Union européenne."); await page.click("#df button[type=submit]"); await page.waitForTimeout(2500); }
  await go(`#/app/dossier/${ID}/decision`, 1800); // recharge sans la notification
  await page.locator(".wfcards").evaluate((e) => { const sc = document.scrollingElement; sc.scrollTo(0, sc.scrollTop + e.getBoundingClientRect().top - 24); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "shots/validation.png" });
  await go(`#/app/dossier/${ID}`, 2500);
  await page.screenshot({ path: "shots/dossier-valide.png" });

  await go("#/app/registre", 2000);
  await page.screenshot({ path: "shots/registre.png" });
  await go("#/app/connecteur", 1200);
  await page.screenshot({ path: "shots/connecteur.png" });

  // Examen en cours : lecture intégrale de RecruiterAI lancée depuis la démonstration.
  await go("#/demo", 1500);
  await page.click('[data-run="recruiter"][data-mode="claude"]');
  await page.waitForURL(/#\/app\/en-cours\//, { timeout: 20000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "shots/examen.png" });
  await browser.close();
  console.log("ok shots/");
})().catch((e) => { console.error(e.message); process.exit(1); });
