# Custodix AI, questions probables du jury et réponses préparées

Vocabulaire à tenir : avis d'autorisation, examen contractuel, qualification du risque, niveau de vigilance, validation par un avocat, registre des autorisations, démonstration. Jamais : verdict, juge, score, moteur, démonstrateur.

## Sur le produit

**En quoi est-ce différent d'un outil de gestion contractuelle comme Icertis ?**
Icertis gère le cycle de vie du contrat : rédaction, signature, obligations, renouvellement. Il ne répond pas à la question « cet outil peut-il être utilisé, par qui, avec quelles données ». Custodix AI prend le contrat, le croise avec le cas d'usage, les données et la réglementation, et prépare un avis d'autorisation validé par un avocat. Les plateformes contractuelles structurent les contrats, Custodix AI aide à décider comment un outil IA peut être utilisé. Les deux se complètent : le contrat vient de la plateforme, l'avis y retourne.

**Et par rapport à OneTrust, Credo AI, Vanta ?**
Ce sont des outils d'inventaire et de questionnaires : l'entreprise remplit, l'outil classe. Le contrat du fournisseur n'est pas examiné, et aucun avocat ne valide. Custodix AI examine le contrat, cite la clause, et un avocat du cabinet valide l'avis. Un éditeur ne peut pas proposer cela.

**L'IA peut-elle se tromper sur une clause ?**
Oui, et c'est pour cela que trois garde-fous existent. Chaque statut cite la phrase exacte du contrat, vérifiée mot pour mot par le code : une citation introuvable rétrograde le statut. Un niveau de confiance signale les lectures à confirmer. Et l'avocat relit avant de valider : la décision est la sienne.

**Que se passe-t-il si le fournisseur refuse l'avenant ?**
L'avis reste « non autorisé en l'état » ou « sous conditions », et l'entreprise sait pourquoi. Elle peut chercher un autre outil, limiter le périmètre (sans données personnelles, par exemple), ou accepter le risque en connaissance de cause, avec une trace. C'est déjà mieux qu'aujourd'hui, où la décision est prise sans savoir.

**Pourquoi des règles déterministes dans la démonstration et pas directement un modèle de langage ?**
Pour que la démonstration soit explicable et reproductible, et pour montrer que le barème est une décision du cabinet, pas du modèle. Dans la version connectée, le modèle de langage prend en charge l'examen des clauses, et le barème, les règles bloquantes et les obligations restent en code. Le document prompts-claude.md décrit cette architecture.

## Sur le droit

**Quelle responsabilité pour le cabinet qui valide ?**
L'avis est une décision d'usage interne, préparée pour le client, pas une consultation sur la validité du contrat. Le périmètre est écrit dans le dossier. L'avocat valide ce qu'il a relu, comme il le fait aujourd'hui pour une note. La lettre de mission encadre le reste.

**Le calendrier de l'AI Act a changé, cela vous gêne ?**
Non, cela nous aide. L'omnibus numérique adopté en juin 2026 reporte les obligations pleines des systèmes à haut risque de l'annexe III au 2 décembre 2027. Les entreprises ont dix-huit mois pour trier leur parc. L'article 50 sur la transparence s'applique dès le 2 août 2026 et l'obligation de maîtrise de l'IA depuis février 2025. Le RGPD, lui, s'applique depuis 2018 : la plupart de nos règles en viennent.

**Pourquoi le RGPD compte-t-il autant dans vos règles ?**
Parce que c'est le droit applicable aujourd'hui à presque tous les cas : entraînement sur des données personnelles (finalité, art. 5), sous-traitance (art. 28), transferts (art. 44 à 46), décision automatisée (art. 22), violations (art. 33). L'AI Act ajoute la classification par usage et les obligations du déployeur (art. 26).

**Un chatbot de support, c'est vraiment un risque ?**
Un risque limité au sens de l'AI Act, mais un vrai sujet RGPD : il tourne sur l'historique des conversations clients. Notre exemple de chatbot de support sort « autorisé sous conditions » parce que le contrat est ambigu sur l'entraînement, la conservation et l'hébergement. L'avenant type règle les trois points.

## Sur le business

**Qui paie, et qui achète ?**
La direction juridique ou la conformité d'un grand compte, avec le DSI. Le budget existe déjà : c'est celui des revues de contrats et des questionnaires fournisseurs, dispersé entre quatre services.

**Comment avez-vous construit vos hypothèses de prix ?**
Elles ne sont pas dans le pitch, elles sont en annexe, parce qu'elles restent à valider avec KPMG Avocats. Hypothèses de travail : 30 à 60 outils par an, 2 heures d'avocat par dossier grâce à la préparation assistée, soit 60 à 120 heures d'avocat, plus la plateforme et le registre. Le pilote sert à valider ce prix avec KPMG Avocats.

**Pourquoi un pilote de trois mois ?**
Deux grands comptes, vingt outils, les règles RGPD et AI Act, un expert par dossier. Trois mois suffisent pour mesurer le temps gagné, le taux d'avis corrigés par l'avocat, et le nombre d'avenants obtenus.

**Que devient KPMG dans cette histoire : AI ready, c'est-à-dire ?**
Le cabinet propose un service où l'IA prépare et l'avocat décide. Chaque correction de l'avocat enrichit la doctrine du cabinet. Les équipes s'approprient l'IA dans leur pratique, dossier après dossier.

## Sur l'équipe et le projet

**Vous n'êtes pas juristes. Comment avez-vous construit les règles ?**
À partir des textes : RGPD, AI Act, doctrine CNIL, et des contrats de fournisseurs d'IA réels que nous avons lus. Les trois contrats de la démonstration sont fictifs mais chaque clause existe quelque part. Le barème est volontairement simple et sera revu avec les experts du cabinet.

**Le nom Custodix, pourquoi ?**
De custodia, la garde en latin. Custodix veille sur ce qui entre dans l'entreprise : un outil d'IA n'est utilisé qu'une fois son usage autorisé. Le nom dit la fonction, sans promettre plus qu'un service de cabinet.

**Qu'est-ce qui vous manque pour aller plus loin ?**
L'accès à de vrais contrats de fournisseurs et à deux experts du cabinet pour relire le barème. C'est exactement ce que le mentorat de la finale peut apporter.
