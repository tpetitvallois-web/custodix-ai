# Custodix AI, le service

Custodix AI examine le contrat ou les conditions d'utilisation d'un outil d'IA, le croise avec le cas d'usage et les données traitées, et prépare un dossier d'autorisation : avis (autorisé, sous conditions, non autorisé en l'état), niveau de vigilance sur 100, obligations, mesures, avenant type. L'avis est ensuite validé par un avocat et inscrit au registre.

En ligne : https://custodix-ai.gererseul-avis-worker.workers.dev (compte Cloudflare perso de Tom).

## Deux lectures du contrat

- **Lecture par Claude** : le contrat est lu intégralement, dans sa langue, par claude-opus-5-5. Le modèle rend pour douze sujets un statut (protectrice, ambiguë, dangereuse, absent), la citation exacte et une note, plus des observations libres. Le Worker vérifie chaque citation mot pour mot dans le contrat (une citation introuvable ramène le sujet à « absent ») puis applique le barème. Prompt et schéma : `worker/lecture.js`.
- **Règles locales** : douze motifs en français (`public/engine.js`), instantané, sans envoi du contrat. Fait pour les trois scénarios fictifs, inopérant sur un contrat en anglais.

Dans les deux cas, le barème, les points bloquants, les obligations et l'avenant sont calculés par `engine.js` (`analyse(input, { findings, moteur, lecture })`), jamais par le modèle.

## Comment Claude est appelé

1. **Pont local (en service)** : `pont/pont.js` tourne sur le Mac de Tom (agent launchd `com.custodix.pont`, relancé automatiquement, journal `pont/pont.log`). Il interroge le Worker toutes les 3 s (`GET /api/pont/suivant`, jeton `PONT_TOKEN`), lance `claude -p --model opus --json-schema …` avec l'abonnement Claude Code de Tom, et renvoie la lecture (`POST /api/pont/resultat/:id`). Le Mac doit être allumé et connecté.
   - Arrêter : `launchctl bootout gui/$(id -u)/com.custodix.pont`. Relancer : `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.custodix.pont.plist`.
   - Jeton : `pont/.env` (PONT_TOKEN, CUSTODIX_URL) et secret Worker du même nom.
2. **GitHub Actions (à activer, choix de Tom)** : dépôt privé tpetitvallois-web/custodix-ai, workflow `.github/workflows/pont.yml`. Le Worker réveille le workflow à chaque dossier (`repository_dispatch`, secrets Worker `GITHUB_TOKEN` + var `GITHUB_REPO`) ; le workflow installe Claude Code, se connecte avec le jeton d'abonnement `CLAUDE_CODE_OAUTH_TOKEN` (secret du dépôt, créé par `claude setup-token`, même méthode que la veille emploi) et lance `pont.js --once`, qui vide la file et s'arrête. Une passe toutes les 30 minutes en secours. Délai pour l'utilisateur : une à deux minutes. Aucune clé API, aucun serveur à Tom. `GET /api/etat` répond `"lecture":"github"` quand le pont du Mac est hors ligne et que le secret GitHub est posé.
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
npm run deploy
```

En local, `wrangler dev` crée un registre vide et séparé ; le pont pointe sur l'URL de `CUSTODIX_URL`.

## Fichiers

- `public/engine.js` : barème, règles, avenant, `TOPICS` (douze sujets), `analyse`, `avenant`.
- `public/scenarios.js` : les trois exemples fictifs.
- `public/app.js`, `app.css`, `index.html` : interface (accueil, formulaire, examen en cours, dossier, registre).
- `worker/index.js` : Worker, Durable Object `Registre`, appel API ; `worker/lecture.js` : prompt système, guide par sujet, schéma JSON, vérification des citations.
- `../pont/pont.js` : pont local ; `../pont/lot.js` : lot de contrats réels, résultats dans `../contrats-reels/resultats.md`.
