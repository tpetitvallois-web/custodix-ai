// PPTX à rendu garanti pour Agorize : chaque slide = l'image haute définition de la slide du PDF (polices figées).
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "Céline Lin, Tom Petit Vallois";
pres.title = "Aucteva, Make AI Happen 2026, thème 3";
const URL = "custodix-ai.gererseul-avis-worker.workers.dev";
const notes = JSON.parse(fs.readFileSync("notes.json", "utf8"));
for (let i = 1; i <= 5; i++) {
  const s = pres.addSlide();
  s.addImage({ path: `hd-${i}.png`, x: 0, y: 0, w: 13.33, h: 7.5 });
  if (notes[i - 1]) s.addNotes(notes[i - 1]);
  if (i === 5) {
    // Le bouton et l'adresse sont rendus dans l'image ; on pose par-dessus les mêmes éléments, cliquables.
    const b = JSON.parse(fs.readFileSync("link-positions.json", "utf8")).agorize5;
    s.addText("Ouvrir la démonstration", { shape: "roundRect", rectRadius: 0.04, x: b.x, y: b.y, w: b.w, h: b.h, fill: { color: "10233F" }, line: { color: "10233F", width: 0 }, fontFace: "Arial", bold: true, fontSize: 12, color: "FFFFFF", align: "center", valign: "middle", margin: 0, hyperlink: { url: "https://" + URL + "/", tooltip: "Ouvrir la démonstration" } });
    s.addShape("rect", { x: b.x, y: b.y + b.h + 0.06, w: b.w, h: 0.3, fill: { color: "FFFFFF" }, line: { color: "FFFFFF", width: 0 } });
    s.addText([{ text: URL, options: { hyperlink: { url: "https://" + URL + "/" }, color: "10233F", underline: { style: "sng" } } }], { x: b.x, y: b.y + b.h + 0.08, w: b.w, h: 0.25, isTextBox: true, margin: 0, fontFace: "Arial", fontSize: 9, align: "center", valign: "top" });
  }
}
pres.writeFile({ fileName: "aucteva-agorize-images.pptx" }).then(() => console.log("ok aucteva-agorize-images.pptx"));
