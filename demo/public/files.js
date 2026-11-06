// Lecture des fichiers déposés : PDF (pdf.js), Word (.docx), texte. Partagé par l'assistant et le formulaire.
import { getLang } from "./i18n.js";
const L = (fr, en) => (getLang() === "en" ? en : fr);

// Rend { texte, pages } : pages = position du début de chaque page dans le texte (PDF seulement).
export async function readFile(file) {
  const name = file.name.toLowerCase();
  if (file.size > 25 * 1048576) throw new Error(L("Fichier trop lourd (25 Mo au plus).", "File too large (25 MB max)."));
  if (name.endsWith(".pdf") || file.type === "application/pdf") return readPdf(file);
  if (name.endsWith(".docx")) return readDocx(file);
  if (/\.(txt|md|text)$/.test(name) || file.type.startsWith("text/")) return { texte: (await file.text()).replace(/\r\n?/g, "\n") };
  throw new Error(L("Formats acceptés : PDF, Word (.docx), texte (.txt, .md).", "Accepted formats: PDF, Word (.docx), text (.txt, .md)."));
}
let pdfjs = null;
async function readPdf(file) {
  if (!pdfjs) { pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs"); pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs"; }
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    let line = "", lastY = null; const out = [];
    for (const it of content.items) { if (!("str" in it)) continue; const y = it.transform ? Math.round(it.transform[5]) : null; if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) { out.push(line.trim()); line = ""; } line += it.str + (it.hasEOL ? "\n" : " "); lastY = y; }
    out.push(line.trim()); pages.push(out.filter(Boolean).join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n"));
  }
  const starts = []; let off = 0;
  for (const pg of pages) { starts.push(off); off += pg.length + 2; }
  return { texte: pages.join("\n\n"), pages: starts };
}
function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Bibliothèque indisponible")); document.head.appendChild(s); }); }
async function readDocx(file) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file("word/document.xml"); if (!doc) throw new Error(L("Document Word illisible", "Unreadable Word document"));
  const xml = new DOMParser().parseFromString(await doc.async("string"), "application/xml");
  return { texte: [...xml.getElementsByTagNameNS("*", "p")].map((p) => [...p.getElementsByTagNameNS("*", "t")].map((x) => x.textContent).join("")).join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}
