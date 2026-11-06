# Aucteva (anciennement Custodix AI), Make AI Happen 2026 (KPMG), thème 3

Chaque outil d'IA, une décision documentée. Gouvernance juridique des outils d'intelligence artificielle en entreprise.
Projet de Céline Lin et Tom Petit Vallois, M2 Innovation, Management des Technologies et Entrepreneuriat,
Paris 1 Panthéon-Sorbonne. A remplacé « Boussole » (~/kpmg-make-ai-happen) le 5 novembre 2026, puis renommé
de Kleros AI en Custodix AI le même soir, avec un ton de cabinet d'avocats (avis, qualification du risque, validation par un avocat).

- deck/ : build.js (pptxgenjs, Charter pour les titres, Barlow pour le corps, un seul accent bleu nuit) produit deux assemblages :
  custodix-ai-agorize (5 slides, limite du formulaire, business plan inclus) et custodix-ai-oral (8 slides + 3 annexes, demi-finale).
  custodix-ai-agorize-images.pptx = rendu garanti pour le dépôt (lien vers la démo posé par-dessus l image, cliquable). Captures de la démo : deck/shots.js (Playwright, NODE_PATH=~/gererseul-guide/node_modules) → deck/shots/. node_modules est un lien vers ~/kpmg-make-ai-happen/node_modules.
  Reconstruire : `cd deck && NODE_PATH=$PWD/node_modules PPTX_SKILL=<skill pptx> node build.js`, soffice en PDF, `pdftoppm -png -r 200 custodix-ai-agorize.pdf hd`, `node build-images.js`.
- demo/ : le service (public/ + worker/), en ligne sur https://aucteva.gererseul-avis-worker.workers.dev (voir demo/README.md). Depuis le 6 novembre 2026 : lecture des contrats par Claude (claude-opus-5-5), dépôt PDF / Word / texte / URL, registre des dossiers dans un Durable Object, validation par un avocat enregistrée.
  Le modèle lit, le code décide : barème, points bloquants, obligations et avenant restent dans public/engine.js (verdict interne VERT/ORANGE/ROUGE affiché « Autorisé / Autorisé sous conditions / Non autorisé en l'état »).
- pont/ : pont local vers le Claude de Tom (`claude -p`, abonnement Claude Code), agent launchd com.custodix.pont. Le Mac doit être allumé ; pour s'en passer, poser le secret ANTHROPIC_API_KEY sur le Worker (le code de l'appel API est en place).
- contrats-reels/ : 34 documents contractuels réels (OpenAI, Anthropic, Mistral, Intercom, HubSpot, Zoom, HireVue, Workable, DeepSeek...), sources.md (URL, langue, mots), resultats.md (avis Claude contre règles sur chaque document, produit par pont/lot.js) et synthese.md (ce qu'on en retient, pistes de calibrage du barème).
- contenu/ : slides-8.md, script-oral.md, questions-jury.md, architecture.md, prompts-claude.md, schema-decision.json, exemple-decision-supportai.json, contrats/.
- textes-agorize.md et custodix-ai-1024x576.png (cover.js) : nom, description, image, résumé, checklist de dépôt.

Le nom est une constante : BRAND dans demo/public/engine.js et deck/build.js, plus cover.js et les textes.
