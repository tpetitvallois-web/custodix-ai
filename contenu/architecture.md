# Custodix AI, architecture la plus simple

## Démonstrateur (ce qui est en ligne)

- Une page web statique (HTML, CSS, JavaScript en modules), sans framework ni build.
- `engine.js` : le moteur de règles. Lit le contrat phrase par phrase, repère pour douze sujets une clause protectrice, ambiguë, dangereuse ou absente, calcule le score, applique les règles bloquantes, produit la fiche et l'avenant.
- `scenarios.js` : trois dossiers prêts (MarketingAI, SupportAI, RecruiterAI) avec leurs contrats fictifs.
- Un Worker Cloudflare qui sert les fichiers. Aucun stockage, aucune donnée envoyée : tout se passe dans le navigateur.
- Hébergement sur le compte Cloudflare personnel de Tom, comme les autres projets d'école.

## Version connectée (phase pilote)

```
Navigateur ──► Worker Cloudflare ──► Claude (lecture des clauses, JSON strict)
                    │
                    ├──► Barème, règles bloquantes, obligations (code, versionné)
                    ├──► Durable Object SQLite : fiches, signatures, journal
                    └──► Connecteur CLM (Icertis, API REST) : contrat entrant, fiche sortante
```

- La lecture des clauses passe de regex à Claude. Le reste ne change pas : même schéma JSON (schema-decision.json).
- Les citations renvoyées par le modèle sont vérifiées mot pour mot dans le contrat avant d'être affichées.
- Les fiches, la signature de l'expert et les versions sont stockées ; chaque relecture d'un contrat modifié crée une nouvelle version.
- Hébergement cible chez KPMG : Azure région France, modèle via le fournisseur sous contrat du cabinet, aucune donnée client utilisée pour l'entraînement.

## Extensions

- Base documentaire : doctrine CNIL, lignes directrices du Comité européen, décisions, mise à jour par la veille du cabinet.
- Veille : quand un texte change (AI Act, décision CNIL), les fiches concernées sont marquées « à revoir ».
- Registre groupe : vue par entité, par pays, par type de données, exportable pour un contrôle.

## État réel au 6 novembre 2026

La version connectée est en service sur le même site. Ce qui est fait : lecture par Claude (claude-opus-5-5) avec sortie JSON contrainte (statut, citation, note par sujet, observations), vérification mot pour mot des citations côté Worker, barème inchangé, registre des dossiers et signature de l'avocat dans un Durable Object SQLite, dépôt PDF / Word / texte / page web. Le modèle est appelé par un pont local (`claude -p` sur le Mac de Tom) ; l'appel direct à l'API Anthropic depuis Cloudflare est codé et s'active avec un secret. Ce qui reste : connecteur CLM, base documentaire, découpage des contrats de plus de 150 000 jetons, double lecture pour le score de confiance.
