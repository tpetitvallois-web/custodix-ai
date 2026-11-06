# Lecture des 34 contrats réels, ce qu'on en retient (6 novembre 2026)

Détail document par document dans resultats.md, sources et URL dans sources.md.

## Les règles locales ne voient rien sur un vrai contrat

Les douze motifs de engine.js sont en français. Sur 33 documents en anglais, ils ne repèrent aucune clause : le niveau ne dépend plus que de la famille et des clauses « absentes », d'où le même chiffre pour tous les documents d'une famille (52 en marketing, 64 en support, 74 grand public, 96 en RH). Le moteur de règles reste utile pour les trois scénarios fictifs de la démonstration, pas au-delà.

## Claude lit, cite et distingue

Sur les 34 documents, 290 citations sur 290 ont été retrouvées mot pour mot dans le texte par le Worker : aucune citation inventée. Entre 33 s et 73 s par document, 45 s en moyenne, avec claude-opus-5-5 par le pont local.

Les écarts les plus nets avec les règles sont ceux qu'un avocat attend :
- Jasper (52 → 83) : les entrées et les résultats servent à améliorer les modèles, licence perpétuelle, le client garantit Jasper, modification dès publication.
- Midjourney (52 → 80), HubSpot Product Specific Terms (64 → 85), Intercom (64 → 81), Freshworks Supplemental Terms (64 → 87), Zoom Terms (64 → 82) : clauses d'entraînement, de licence ou de responsabilité dangereuses pour le client.
- Les accords de traitement sont systématiquement mieux notés que les conditions générales du même fournisseur (Anthropic DPA 44, OpenAI DPA 50, HubSpot DPA 57, Zoom DPA 59, HireVue DPA 89 contre 96 pour les conditions du site). C'est cohérent : le DPA porte les engagements RGPD, les CGU portent les exclusions.
- HireVue Terms of Use : Claude signale de lui-même que le document est celui du site et exclut les clients sous contrat signé, donc que le MSA et le DPA manquent.

## Ce que le lot révèle sur le barème (à décider avec Céline)

- Famille RH saturée à 96 : le cas d'usage « présélection des candidats » déclenche le point bloquant « évaluation automatisée de personnes sans supervision garantie » dès que le contrat n'a pas de clause protectrice sur la décision automatisée. Aucun des huit documents RH n'en a. C'est défendable juridiquement (annexe III de l'AI Act) mais le niveau ne distingue plus Eightfold de Paradox. Piste : réserver le point bloquant aux clauses dangereuses, et traiter l'absence comme une clause manquante lourde.
- Sujet « sécurité » : les exclusions de garantie à l'américaine (« we do not warrant that the services will be secure ») sont lues comme dangereuses. Un avocat peut considérer qu'une exclusion de garantie n'est pas une absence de mesures. Piste : demander au modèle de distinguer l'exclusion de garantie de l'absence de mesures, ou pondérer moins ce sujet.
- Les conditions grand public (DeepSeek, Character.AI, Grammarly, Otter) sortent toutes non autorisées pour un usage salarié avec des documents internes : c'est le résultat attendu, et un bon argument de pitch (BYOAI).

## Limites du lot

- Les pages HTML gardent des restes de menus ; le modèle les ignore mais le compte de mots les inclut.
- Un seul cas d'usage par famille. Le même contrat avec « aucune donnée personnelle » donnerait un niveau plus bas.
- Une seule lecture par document, sans double lecture pour mesurer la stabilité.
