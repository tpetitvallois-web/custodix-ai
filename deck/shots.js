// Captures de la démonstration en ligne pour le deck, en 2x. NODE_PATH=~/gererseul-guide/node_modules node shots.js
const { chromium } = require("playwright");
const URL = "https://custodix-ai.gererseul-avis-worker.workers.dev/";
const VP = { width: 1280, height: 750 }; // 1280x750 → ratio 1,707
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VP, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "shots/accueil.png" });
  await page.getByRole("button", { name: "RecruiterAI" }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "shots/formulaire.png" });
  await page.getByRole("button", { name: "Lancer l'examen" }).click();
  await page.waitForTimeout(2300);
  await page.screenshot({ path: "shots/examen.png" });
  await page.waitForURL(/#\/rapport/, { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: "shots/dossier.png" });
  // Risques identifiés : capture de la section
  const risques = page.locator("section", { hasText: "Risques identifiés" }).first();
  const rb = await risques.boundingBox();
  await page.screenshot({ path: "shots/risques.png", clip: { x: 0, y: rb.y, width: VP.width, height: VP.height }, fullPage: true });
  // Validation par un avocat
  await page.locator("#s-name").fill("Marie Dupont");
  await page.locator("#s-role").selectOption("Avocat");
  await page.getByRole("button", { name: "Valider l'avis" }).click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
  await page.screenshot({ path: "shots/dossier-valide.png" }); // l'en-tête porte « Avis validé par … »
  const val = page.locator("#validation");
  await val.scrollIntoViewIfNeeded();
  const vb = await val.boundingBox(); const vy = await page.evaluate(() => window.scrollY);
  await page.screenshot({ path: "shots/validation.png", clip: { x: 0, y: Math.max(0, vb.y + vy - 420), width: VP.width, height: VP.height }, fullPage: true });
  // Avenant type
  await page.getByRole("button", { name: "Générer l'avenant type" }).click();
  await page.waitForTimeout(500);
  const av = page.locator("#avenant-section");
  await av.scrollIntoViewIfNeeded();
  const ab = await av.boundingBox(); const ay = await page.evaluate(() => window.scrollY);
  await page.screenshot({ path: "shots/avenant.png", clip: { x: 0, y: ab.y + ay - 20, width: VP.width, height: VP.height }, fullPage: true });
  await browser.close();
  console.log("ok shots/");
})();
