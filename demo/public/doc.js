// Lecture du document source : retrouve chaque citation dans le texte, repère les sections, rend le texte numéroté par ligne.
// La recherche replie la casse, les apostrophes, les guillemets et les espaces, comme la vérification côté serveur.
import { esc } from "./ui.js";

const PUNCT = new Set([".", ",", ";", ":", "!", "?", "(", ")"]);
export function fold(text) {
  const f = [], map = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (/[\s  -​ ]/.test(c)) { space = true; continue; }
    if (space && f.length) { f.push(" "); map.push(i - 1); }
    space = false;
    if ("’‘`´".includes(c)) c = "'"; else if ("“”«»".includes(c)) c = '"';
    f.push(c.toLowerCase()); map.push(i);
  }
  // Pas d'espace autour de la ponctuation (la lecture et l'extraction PDF les placent différemment).
  const F = [], M = [];
  for (let i = 0; i < f.length; i++) {
    if (f[i] === " " && (PUNCT.has(f[i - 1]) || PUNCT.has(f[i + 1]))) continue;
    F.push(f[i]); M.push(map[i]);
  }
  return { f: F.join(""), map: M };
}

// Rend [début, fin) dans le texte d'origine, ou null si la citation n'est pas retrouvée.
export function locate(folded, quote) {
  if (!quote) return null;
  const q = fold(String(quote).replace(/(…|\.\.\.)\s*$/, "")).f.trim();
  if (q.length < 8) return null;
  const at = (i, len) => [folded.map[i], folded.map[i + len - 1] + 1];
  let i = folded.f.indexOf(q);
  if (i >= 0) return at(i, q.length);
  const w = q.split(" ");
  if (w.length < 8) return null;
  const head = w.slice(0, 6).join(" "), tail = w.slice(-6).join(" ");
  i = folded.f.indexOf(head);
  if (i < 0) return null;
  const j = folded.f.indexOf(tail, i + head.length);
  if (j >= 0 && j - i < q.length * 2) return at(i, j + tail.length - i);
  return at(i, Math.min(q.length, folded.f.length - i));
}

const HEAD = /^(article|art\.|section|annex|annexe|appendix|schedule|chapitre|chapter|partie|part|exhibit|titre)\b/i;
function isHeading(line) {
  const s = line.trim();
  if (s.length < 2 || s.length > 90 || /[,;:]$/.test(s)) return false;
  if (/^#{1,4}\s/.test(s)) return true;
  if (HEAD.test(s) && s.length < 80) return true;
  if (/^\d{1,2}(\.\d{1,2}){0,2}[.)]?\s+\S/.test(s) && s.length < 70 && !/\.$/.test(s)) return true;
  const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase() && s.length < 70;
}

// ranges : [{ start, end, cls, key }]. Rend { html, sections, lineOf(offset), anchors: Map(key → id du premier repère) }.
export function renderDoc(text, ranges = [], { numbers = true } = {}) {
  const sorted = ranges.filter(Boolean).sort((a, b) => a.start - b.start);
  const kept = [], anchors = new Map();
  for (const r of sorted) {
    const prev = kept[kept.length - 1];
    if (prev && r.start < prev.end) { anchors.set(r.key, `cite-${prev.key}`); continue; } // passage déjà surligné pour un autre sujet
    kept.push(r); anchors.set(r.key, `cite-${r.key}`);
  }
  const lines = text.split("\n");
  const starts = []; let off = 0;
  for (const l of lines) { starts.push(off); off += l.length + 1; }
  const lineOf = (o) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= o) lo = m; else hi = m - 1; } return lo + 1; };
  const sections = [];
  const out = [];
  let blank = false, k = 0;
  const opened = new Set();
  lines.forEach((line, n) => {
    const s0 = starts[n], s1 = s0 + line.length;
    if (!line.trim()) { if (!blank) out.push(`<div class="ln gap" aria-hidden="true"></div>`); blank = true; return; }
    blank = false;
    while (k < kept.length && kept[k].end <= s0) k++;
    let html = "", pos = s0;
    for (let j = k; j < kept.length && kept[j].start < s1; j++) {
      const r = kept[j];
      const a = Math.max(r.start, s0), b = Math.min(r.end, s1);
      if (a >= b) continue;
      html += esc(text.slice(pos, a));
      const id = opened.has(r.key) ? "" : ` id="cite-${esc(r.key)}"`;
      opened.add(r.key);
      html += `<mark class="cite ${r.cls || ""}" data-key="${esc(r.key)}"${id}>${esc(text.slice(a, b))}</mark>`;
      pos = b;
    }
    html += esc(text.slice(pos, s1));
    const h = isHeading(line);
    if (h) sections.push({ n: n + 1, title: line.trim().replace(/^#+\s*/, "").slice(0, 80) });
    out.push(`<div class="ln${h ? " h" : ""}"${numbers ? ` data-n="${n + 1}"` : ""}${h ? ` id="ln-${n + 1}"` : ""} data-l="${n + 1}"><span>${html}</span></div>`);
  });
  return { html: out.join(""), sections, lineOf, anchors };
}

// Section qui contient une ligne donnée.
export const sectionOf = (sections, line) => { let s = null; for (const x of sections) { if (x.n <= line) s = x; else break; } return s; };

// Fait défiler un conteneur jusqu'à un élément, sans bouger la page.
export function scrollWithin(container, el, offset = 80) {
  if (!container || !el) return;
  const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - offset;
  container.scrollTo({ top: Math.max(0, top), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}
