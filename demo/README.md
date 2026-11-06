# Aucteva (anciennement Custodix AI), le service

Aucteva transforme le contrat d'un fournisseur d'IA et le cas d'usage prévu en un dossier d'analyse documenté : huit domaines de vigilance (regroupant douze sujets), chaque observation reliée à une citation vérifiée dans le texte, proposition d'avis et niveau de vigilance sur 100, conditions, avenant type. Trois temps distincts et tracés : avis préparé par l'IA, avis validé par l'avocat, décision d'utilisation par une personne habilitée. Le tout alimente un registre de gouvernance.

En ligne : https://aucteva.pages.dev (compte Cloudflare perso de Tom). C'est un projet Pages (`pages/`, `_worker.js` en mode avancé) qui relaie tout vers le Worker `custodix-ai` par service binding : ce Worker garde le registre, le renommer repartirait d'un Durable Object vide. Les anciennes adresses custodix-ai.gererseul-avis-worker.workers.dev et aucteva.gererseul-avis-worker.workers.dev (Worker relais `proxy/`) redirigent les visiteurs vers aucteva.pages.dev et servent toujours l'API et le MCP. Déployer Pages : `cd pages && CLOUDFLARE_ACCOUNT_ID=e2d939d2a4a4c9453d118a18388bfcb4 npx wrangler pages deploy --branch main`.

## Interface (public/, modules ES sans build)

- `app.js` routeur. Site public : `#/` (accueil, ancres `#/produit`, `#/fonctionnement`, `#/cas-usage`, `#/securite`), `#/demo`, `#/conditions`, `#/confidentialite`. Application : `#/app` (vue d'ensemble), `#/app/outils`, `#/app/nouveau` (parcours guidé) et `#/app/nouveau/conversation`, `#/app/dossiers`, `#/app/validation`, `#/app/registre`, `#/app/parametres`, `#/app/connecteur`, `#/app/en-cours/ID`, `#/app/conversation/ID`, `#/app/dossier/ID[/synthese|/decision]`. Les anciennes adresses (`#/analyse`, `#/rapport/ID`, `#/registre`...) sont redirigées.
- `i18n.js` toutes les chaînes de l'interface, français et anglais. Le contenu des analyses reste en français.
- `ui.js` accès API, formatage, icônes, statuts ; `doc.js` localisation des citations dans le texte (repli casse, apostrophes, espaces), sections, rendu numéroté ; `site.js` site public ; `shell.js` coque et listes ; `assess.js` parcours guidé, suivi d'analyse, conversation ; `dossier.js` espace d'analyse à deux panneaux, synthèse imprimable, validation et décision.
- `engine.js` expose `DIMENSIONS` (les huit domaines) et `constats` dans le résultat (un constat complet par sujet, citation entière). Les dossiers antérieurs sont reconstitués depuis `clauses_critiques`.
- API ajoutées : `GET /api/examens/ID/contrat` (texte source), `POST /api/examens/ID/decision` (nom, fonction, décision, motif ; exige la validation juridique). Champs de dossier ajoutés : département, usage interne ou externe, responsable, informations complémentaires, documents (nom, format, taille, mots).

## Trois façons d'entrer

- **Conversation (accueil)** : barre de dialogue au centre d'un accueil sombre. L'utilisateur écrit, dépose un contrat (PDF, Word, texte), pose sa question. L'assistant du cabinet (`worker/chat.js`, prompt + schéma JSON, modèle jamais nommé) déduit du contrat le nom de l'outil, le fournisseur, l'usage, ne demande que ce qui manque, et quand le contrat est là rend sa lecture des douze sujets dans le même tour : le Worker vérifie les citations, calcule l'avis et l'ajoute à la conversation avec un lien vers le dossier. Conversations `CV-AAAA-NNNN` dans le Durable Object (messages, pièces en tranches, dossier déduit), file commune avec les dossiers (`suivant()` sert les deux), routes `/api/conversations`.
- **Formulaire** (`#/analyse`) : saisie champ par champ, deux lectures au choix (ci-dessous).
- **Connecteur MCP** (`/mcp`, page `#/connecteur`) : l'assistant de l'utilisateur (Claude, ChatGPT, tout client MCP) ouvre le dossier et lit lui-même ; quatre outils (`worker/mcp.js`), sans authentification pour la démonstration.

## Deux lectures du contrat

- **Lecture par Claude** : le contrat est lu intégralement, dans sa langue, par claude-opus-5-5. Le modèle rend pour douze sujets un statut (protectrice, ambiguë, dangereuse, absent), la citation exacte et une note, plus des observations libres. Le Worker vérifie chaque citation mot pour mot dans le contrat (une citation introuvable ramène le sujet à « absent ») puis applique le barème. Prompt et schéma : `worker/lecture.js`.
- **Règles locales** : douze motifs en français (`public/engine.js`), instantané, sans envoi du contrat. Fait pour les trois scénarios fictifs, inopérant sur un contrat en anglais.

Dans les deux cas, le barème, les points bloquants, les obligations et l'avenant sont calculés par `engine.js` (`analyse(input, { findings, moteur, lecture })`), jamais par le modèle.

## Comment Claude est appelé

1. **Pont local (en service)** : `pont/pont.js` tourne sur le Mac de Tom (agent launchd `com.custodix.pont`, relancé automatiquement, journal `pont/pont.log`). Il interroge le Worker toutes les 3 s (`GET /api/pont/suivant`, jeton `PONT_TOKEN`), lance `claude -p --model opus --json-schema …` avec l'abonnement Claude Code de Tom, et renvoie la lecture (`POST /api/pont/resultat/:id`). Le Mac doit être allumé et connecté.
   - Arrêter : `launchctl bootout gui/$(id -u)/com.custodix.pont`. Relancer : `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.custodix.pont.plist`.
   - Jeton : `pont/.env` (PONT_TOKEN, CUSTODIX_URL) et secret Worker du même nom.
2. **GitHub Actions (en service depuis le 6 novembre 2026)** : dépôt privé tpetitvallois-web/custodix-ai, workflow `.github/workflows/pont.yml`. Le Worker réveille le workflow à chaque dossier (`repository_dispatch`, secrets Worker `GITHUB_TOKEN` + var `GITHUB_REPO`) ; le workflow installe Claude Code, se connecte avec le jeton d'abonnement `CLAUDE_CODE_OAUTH_TOKEN` (secret du dépôt, créé par `claude setup-token`, même méthode que la veille emploi) et lance `pont.js --once`, qui vide la file et s'arrête. Une passe toutes les 30 minutes en secours. Délai pour l'utilisateur : une à deux minutes. Aucune clé API, aucun serveur à Tom. Vérifié avec le pont du Mac coupé : dossier lu en 42 s de bout en bout. Le registre affiche « (GitHub Actions) » ou « (pont local) » selon le lecteur. `GET /api/etat` répond `"lecture":"github"` quand le pont du Mac est hors ligne et que le secret GitHub est posé.
3. **API Anthropic** : codé (SDK, alarme du Durable Object, secret `ANTHROPIC_API_KEY`) mais écarté par Tom.

## Dépôt du contrat

Texte collé, fichier PDF (pdf.js dans le navigateur), Word .docx (JSZip) ou texte, ou adresse d'une page de conditions (`POST /api/extraction`, HTML vers texte côté Worker ; les sites qui bloquent les robots renvoient une erreur explicite). Le texte extrait est placé dans le formulaire pour relecture avant l'examen. Limite : 600 000 caractères.

## API

- `GET /api/etat` : disponibilité de la lecture (`api`, `pont` ou null), dossiers en attente.
- `POST /api/examens` `{tool, vendor, category, useCase, dataTypes, countries, users, contract, source, mode: "claude"|"regles"}` → dossier `CX-AAAA-NNNN`.
- `GET /api/examens/:id` : statut (`en_attente`, `en_cours`, `termine`, `erreur`) et résultat, sans le texte du contrat.
- `POST /api/examens/:id/validation` `{nom, role}` : signature de l'avocat (SHA-256 tronqué).
- `GET /api/registre` : liste des dossiers.
- `GET /api/pont/suivant`, `POST /api/pont/resultat/:id` : réservés au pont (jeton Bearer).

Stockage : Durable Object SQLite `Registre` (binding `REGISTRE`), un objet par dossier, compteur, horodatage du pont. Les contrats déposés y restent : la page le dit, ne pas déposer de contrat confidentiel.

## Lancer en local

```
npm install
npm run dev          # http://localhost:8775 (config launch.json custodix-ai)
npm run pont         # pont local vers claude -p (sinon l'agent launchd le fait déjà)
npm run lot          # passe les contrats réels de ../contrats-reels dans le service
npm run deploy      # wrangler deploy puis redémarrage du pont du Mac (l'objet durable garde l'ancien code tant qu'il est sollicité)
```

En local, `wrangler dev` crée un registre vide et séparé ; le pont pointe sur l'URL de `CUSTODIX_URL`.

## Fichiers

- `public/engine.js` : barème, règles, avenant, `TOPICS` (douze sujets), `analyse`, `avenant`.
- `public/scenarios.js` : les trois exemples fictifs.
- `public/app.js`, `app.css`, `index.html` : interface (accueil, formulaire, examen en cours, dossier, registre).
- `worker/index.js` : Worker, Durable Object `Registre`, appel API ; `worker/lecture.js` : prompt système, guide par sujet, schéma JSON, vérification des citations.
- `../pont/pont.js` : pont local ; `../pont/lot.js` : lot de contrats réels, résultats dans `../contrats-reels/resultats.md`.
