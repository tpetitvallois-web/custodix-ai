// Image de participation Agorize 1024x576 : le nom en Charter, le slogan en Charter bleu nuit, le sous-titre en Barlow.
const fontkit = require("fontkit"); const sharp = require("sharp"); const os = require("os");
const INK = "#26292E", NAVY = "#10233F", GREY = "#6B6F76"; const W = 2048, H = 1152;
function wordmark(text, file, ps, size) {
  const font = ps ? fontkit.openSync(file, ps) : fontkit.openSync(file); const scale = size / font.unitsPerEm; const run = font.layout(text, ["kern"]);
  let x = 0; const parts = [];
  run.glyphs.forEach((g, i) => { const p = run.positions[i]; parts.push(`<path d="${g.path.scale(scale, -scale).translate(x + p.xOffset * scale, 0).toSVG()}"/>`); x += p.xAdvance * scale; });
  return { d: parts.join(""), adv: x };
}
const CH = "/System/Library/Fonts/Supplemental/Charter.ttc";
const logo = wordmark("Custodix AI", CH, "Charter-Roman", 300);
const slogan = wordmark("Chaque IA passe par Custodix.", CH, "Charter-Roman", 84);
const sub = wordmark("Autorisation et gouvernance des outils d'intelligence artificielle en entreprise", os.homedir() + "/Library/Fonts/Barlow-Regular.ttf", null, 50);
const y0 = 500;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#FFFFFF"/>
<g transform="translate(${(W - logo.adv) / 2} ${y0})" fill="${INK}">${logo.d}</g>
<rect x="${W / 2 - 60}" y="${y0 + 70}" width="120" height="4" fill="${NAVY}"/>
<g transform="translate(${(W - slogan.adv) / 2} ${y0 + 190})" fill="${NAVY}">${slogan.d}</g>
<g transform="translate(${(W - sub.adv) / 2} ${y0 + 290})" fill="${GREY}">${sub.d}</g></svg>`;
sharp(Buffer.from(svg)).resize(1024, 576).png().toFile("custodix-ai-1024x576.png").then(() => console.log("ok custodix-ai-1024x576.png"));
