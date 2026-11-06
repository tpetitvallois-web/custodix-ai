# Custodix AI, logique d'analyse et prompts pour la version connectée à Claude

Le démonstrateur en ligne tourne avec un moteur de règles (demo/public/engine.js) : déterministe,
explicable, sans réseau. La version connectée remplace une seule brique, l'extraction des clauses,
par un appel à Claude. Le barème, les règles bloquantes, les obligations et l'avenant restent en code :
c'est ce qui rend la décision reproductible et auditable.

## Architecture la plus simple

1. Page web (celle du démonstrateur) : formulaire, écran d'analyse, rapport.
2. Worker Cloudflare : reçoit le dossier (contrat + cas d'usage), appelle Claude, applique le barème, renvoie le JSON.
3. Claude (modèle `claude-sonnet-5-5`, ou `claude-opus-5-5` pour les contrats longs) : lit le contrat et renvoie
   pour chaque sujet un statut et la citation exacte, en JSON strict.
4. Stockage : une table de fiches de décision (Durable Object SQLite ou D1), une ligne par fiche, avec la
   signature de l'expert et le journal des versions.
5. Plus tard : connecteur CLM (Icertis, API REST) pour récupérer le contrat sans copier-coller, et base
   documentaire (BOFiP, CNIL, AI Act) pour citer la doctrine à jour.

Aucune donnée client ne sert à entraîner un modèle : l'API Claude n'entraîne pas sur les données des
clients API, et le contrat du cabinet avec le fournisseur de modèle le stipule.

## Appel 1, extraction des clauses

Système :

```
Tu es un juriste spécialisé en contrats de services numériques, protection des données et droit de l'IA.
On te donne un contrat ou des conditions d'utilisation d'un outil d'intelligence artificielle.
Pour chacun des sujets listés, tu dois dire si le contrat contient une clause protectrice pour le client,
une clause ambiguë, une clause dangereuse pour le client, ou aucune clause.
Règles :
- Tu cites la phrase exacte du contrat qui fonde ton statut, sans la reformuler. Si tu ne peux pas citer, le statut est « absent ».
- Une négation explicite (« s'interdit », « n'utilise pas ») rend la clause protectrice, même si elle contient les mots du risque.
- « Améliorer nos services », « aussi longtemps que nécessaire », « délai raisonnable », « disponible sur demande » sont ambigus.
- Une licence perpétuelle, un entraînement autorisé, une renonciation à l'audit, une exclusion totale de responsabilité, des transferts vers tout pays sont dangereux.
- Tu ne donnes aucun avis sur l'opportunité d'utiliser l'outil : tu décris le contrat.
Tu réponds uniquement en JSON, selon le schéma fourni, sans texte autour.
```

Utilisateur :

```
Sujets : training, retention, transfer, subprocessors, breach, audit, security, outputs, liability, automated, transparency, changes.
Schéma : {"clauses":[{"topic":"<id>","status":"protectrice|ambiguë|dangereuse|absent","quote":"<phrase exacte ou null>","note":"<une phrase>"}]}
Contrat :
<<<
{{contrat}}
>>>
```

Paramètres : température 0, sortie JSON forcée (tool use avec un schéma, ou `response_format`), 2 000 jetons de sortie.
Vérification côté Worker : chaque `quote` non nulle doit exister mot pour mot dans le contrat (recherche après
normalisation des espaces et des apostrophes). Une citation introuvable rétrograde le statut en « absent » et
abaisse le score de confiance. C'est le garde-fou contre l'hallucination.

## Appel 2, qualification du cas d'usage (optionnel)

Système :

```
Tu es un expert en conformité IA. À partir d'une description d'usage, de la catégorie d'outil et des types de données,
tu qualifies le niveau de risque au sens de l'AI Act (inacceptable, haut risque avec l'annexe et le point, risque limité,
risque minimal) et tu indiques si une décision automatisée au sens de l'article 22 du RGPD est en jeu.
Tu cites l'article ou le point d'annexe. Tu réponds en JSON : {"aiact":"...","reference":"...","article22":true|false,"justification":"..."}
```

## Appel 3, rédaction des clauses correctives

Le moteur de règles fournit déjà un texte par sujet. Claude peut l'adapter au contrat réel :

```
Rédige une clause d'avenant en français, style contractuel, 60 à 120 mots, qui corrige la clause suivante : {{clause}}.
Objectif : {{objectif de la règle}}. Pas de numérotation, pas d'introduction, la clause seule.
```

## Ce qui reste en code, et pourquoi

- Le barème (base par catégorie et par type de données, poids des clauses) : pour qu'un même dossier donne toujours le même score.
- Les règles bloquantes (entraînement sur données personnelles, évaluation automatisée de personnes sans supervision, santé hors UE, renonciation à l'audit) : ce sont des lignes rouges du cabinet, pas des appréciations.
- Les obligations RGPD et AI Act : une table maintenue par les experts du cabinet, versionnée.
- La mention « validation humaine requise » et le bloc de signature : la décision est celle de l'expert.

## Score de confiance

Pour chaque fiche, le Worker calcule un score de confiance : part des citations vérifiées, longueur du contrat lue
(au-delà de 60 pages, découpage et appel par section), accord entre deux lectures à température 0.
Sous 80 %, la fiche est marquée « lecture à confirmer » et l'expert reçoit les passages en surbrillance.
