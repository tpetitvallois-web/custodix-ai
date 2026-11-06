// Trois scénarios de démonstration. Les fournisseurs, outils et contrats sont fictifs.
// Chaque contrat fait 350 à 550 mots et porte des clauses volontairement différentes :
// protectrices (MarketingAI), ambiguës (SupportAI), dangereuses (RecruiterAI).

export const SCENARIOS = [
  {
    id: "marketing",
    tool: "MarketingAI",
    vendor: "Lumen Content SAS",
    category: "marketing",
    useCase: "Génération de publications pour les réseaux sociaux du groupe à partir de briefs rédigés par l'équipe communication. Relecture avant publication.",
    dataTypes: ["aucune"],
    countries: "France, Belgique",
    users: 40,
    expected: "VERT",
    contract: `CONDITIONS GÉNÉRALES D'UTILISATION DU SERVICE MARKETINGAI
Lumen Content SAS, société au capital de 250 000 euros, siège social à Nantes (France)

Article 1. Objet
Les présentes conditions régissent l'accès au service MarketingAI (le « Service »), une application de génération de contenus rédactionnels et visuels destinés aux réseaux sociaux, mise à disposition du Client par Lumen Content SAS (le « Fournisseur »).

Article 2. Données du Client et confidentialité
Les briefs, documents, visuels et instructions transmis par le Client (les « Contenus Client ») demeurent la propriété exclusive du Client. Le Fournisseur s'interdit d'utiliser les Contenus Client pour entraîner, affiner ou améliorer ses modèles d'intelligence artificielle ou ceux de tiers. Les Contenus Client sont traités uniquement pour fournir le Service. Le Fournisseur peut établir des statistiques d'usage agrégées et anonymisées, sans lien possible avec le Client ou une personne physique.

Article 3. Hébergement et localisation
Le Service est hébergé exclusivement dans l'Union européenne, dans des centres de données situés à Francfort et à Paris. Aucun transfert de données hors de l'Union européenne n'est effectué sans l'accord écrit préalable du Client.

Article 4. Conservation et suppression
Les Contenus Client et les contenus générés sont conservés trente (30) jours après leur création dans l'espace de travail, puis supprimés. Le Client peut demander la suppression anticipée à tout moment. À la fin du contrat, l'ensemble des données est restitué au format ouvert puis supprimé dans un délai de trente (30) jours, certificat de suppression à l'appui.

Article 5. Protection des données personnelles
Lorsque le Service est utilisé pour traiter des données à caractère personnel, le Fournisseur agit en qualité de sous-traitant au sens de l'article 28 du RGPD. Un accord de traitement des données (DPA) annexé aux présentes précise les finalités, la durée, la nature du traitement et les instructions du Client. La liste des sous-traitants ultérieurs figure en annexe 2 ; toute modification est notifiée au Client trente (30) jours à l'avance, le Client pouvant s'y opposer.

Article 6. Sécurité
Les données sont chiffrées en transit (TLS 1.2 minimum) et au repos (AES-256). Le Fournisseur est certifié ISO 27001. Toute violation de données à caractère personnel est notifiée au Client dans un délai maximal de quarante-huit (48) heures après sa découverte, avec les éléments nécessaires à la notification prévue à l'article 33 du RGPD.

Article 7. Audit
Le Client peut, une fois par an et moyennant un préavis de trente (30) jours, auditer ou faire auditer la conformité du Fournisseur aux présentes. Le Fournisseur fournit en outre, sur demande, son dernier rapport d'audit indépendant.

Article 8. Propriété des contenus générés
Le Client est titulaire de l'ensemble des droits sur les contenus générés à partir de ses instructions, dans les limites permises par la loi applicable. Le Fournisseur ne revendique aucun droit sur ces contenus et ne les réutilise pas pour d'autres clients.

Article 9. Transparence et usage responsable
Le Fournisseur informe le Client que les contenus sont générés par un système d'intelligence artificielle et met à disposition une fonction de marquage des contenus générés. Le Client reste responsable de la relecture des contenus avant publication et de leur conformité aux règles applicables à la publicité.

Article 10. Responsabilité
La responsabilité du Fournisseur est plafonnée au montant des sommes versées par le Client au cours des douze (12) derniers mois, sauf en cas de faute lourde, de manquement aux obligations de confidentialité ou de protection des données personnelles, pour lesquels ce plafond ne s'applique pas.

Article 11. Droit applicable
Le présent contrat est soumis au droit français. Tout litige relève des tribunaux de Nantes.`,
  },
  {
    id: "support",
    tool: "SupportAI",
    vendor: "Nimbus Dialog Inc.",
    category: "support",
    useCase: "Chatbot de premier niveau sur le site et dans l'application mobile, entraîné sur l'historique des conversations du service client pour répondre aux questions sur les commandes, les livraisons et les retours.",
    dataTypes: ["clients"],
    countries: "France, Espagne, Italie",
    users: 1200,
    expected: "ORANGE",
    contract: `CONTRAT DE SERVICE SUPPORTAI
Nimbus Dialog Inc., société de droit du Delaware, San Francisco (États-Unis), représentée en Europe par Nimbus Dialog Ireland Ltd

1. Services
Nimbus Dialog fournit au Client une plateforme d'agent conversationnel (« SupportAI ») capable de répondre aux demandes des clients finaux à partir des bases de connaissance et des historiques de conversation connectés par le Client.

2. Données Client
Le Client accorde à Nimbus Dialog le droit d'héberger, de copier, de traiter et d'analyser les Données Client dans la mesure nécessaire pour fournir, maintenir, sécuriser et améliorer les Services. Nimbus Dialog peut utiliser des données dérivées des interactions, sous une forme qui ne permet pas d'identifier directement le Client, afin d'améliorer la qualité de ses modèles et de ses produits. Le Client peut demander à ne pas participer à certains programmes d'amélioration en contactant son représentant commercial.

3. Hébergement
Les Données Client sont hébergées dans l'Union européenne ou aux États-Unis, selon la configuration choisie lors de la mise en service et les besoins opérationnels de Nimbus Dialog. Lorsque des données sont transférées hors de l'Espace économique européen, Nimbus Dialog s'appuie sur des mécanismes de transfert appropriés, dont les clauses contractuelles types de la Commission européenne.

4. Conservation
Les journaux de conversation sont conservés aussi longtemps que nécessaire à la fourniture des Services et à l'amélioration de ceux-ci, puis supprimés ou anonymisés conformément aux politiques internes de Nimbus Dialog. À la résiliation, le Client dispose de trente (30) jours pour exporter ses données.

5. Protection des données
Nimbus Dialog traite les données à caractère personnel pour le compte du Client conformément à son Accord de traitement des données standard, disponible en ligne et susceptible d'être mis à jour. La liste des sous-traitants ultérieurs est disponible sur demande. Nimbus Dialog informe le Client des changements significatifs de sous-traitants par une mise à jour de sa page dédiée.

6. Sécurité et incidents
Nimbus Dialog maintient des mesures de sécurité techniques et organisationnelles raisonnables et conformes aux standards du secteur. Les données sont chiffrées en transit. En cas d'incident de sécurité affectant les Données Client, Nimbus Dialog en informe le Client dans un délai raisonnable, compte tenu des circonstances.

7. Conformité et audit
Nimbus Dialog met à disposition du Client, sur demande et sous accord de confidentialité, son rapport SOC 2 Type II le plus récent. La communication de ce rapport tient lieu de réponse aux demandes d'audit du Client, sauf exigence contraire d'une autorité de contrôle.

8. Contenus générés
Le Client est propriétaire des réponses générées par SupportAI dans son environnement. Nimbus Dialog ne garantit pas l'exactitude des réponses et recommande au Client de prévoir une supervision humaine adaptée à son activité.

9. Limitation de responsabilité
La responsabilité totale de Nimbus Dialog au titre du présent contrat est limitée aux montants payés par le Client au cours des six (6) mois précédant l'événement à l'origine de la réclamation. Nimbus Dialog n'est pas responsable des dommages indirects, y compris les pertes de données.

10. Durée
Le contrat est conclu pour vingt-quatre (24) mois. Nimbus Dialog peut modifier les présentes conditions moyennant un préavis de trente (30) jours publié sur son site.

11. Droit applicable
Le présent contrat est régi par le droit de l'État de Californie. Les parties conviennent de la compétence exclusive des tribunaux de San Francisco.`,
  },
  {
    id: "recruiter",
    tool: "RecruiterAI",
    vendor: "TalentScan Technologies Ltd",
    category: "rh",
    useCase: "Tri et classement automatiques des candidatures reçues pour les postes du groupe en France. Un score par candidat est transmis aux recruteurs, qui ne reçoivent que les 20 premiers profils.",
    dataTypes: ["rh", "sante"],
    countries: "France",
    users: 60,
    expected: "ROUGE",
    contract: `TERMS OF SERVICE – RECRUITERAI (traduction de travail)
TalentScan Technologies Ltd, Londres (Royaume-Uni), avec centres de traitement à Austin (États-Unis) et Bangalore (Inde)

1. Description
RecruiterAI analyse les CV, lettres de motivation et profils publics des candidats, en extrait les compétences, l'expérience, la formation et d'autres signaux, et produit un classement automatique des candidats pour chaque poste ouvert par le Client.

2. Licence sur les documents fournis
Le Client concède à TalentScan une licence mondiale, perpétuelle, irrévocable et gratuite d'utiliser, reproduire, analyser et exploiter les documents et données fournis, y compris les CV et les données des candidats, afin de fournir le service et d'entraîner, tester et améliorer ses modèles d'apprentissage automatique, actuels et futurs.

3. Conservation
TalentScan conserve les documents et données des candidats pendant toute la durée du contrat et pendant cinq (5) ans après son expiration, à des fins d'amélioration des modèles et de défense de ses intérêts légitimes.

4. Transferts
Le Client reconnaît et accepte que les données puissent être traitées et stockées aux États-Unis, en Inde et dans tout autre pays où TalentScan ou ses prestataires exercent leur activité. TalentScan fera des efforts raisonnables pour respecter les lois applicables en matière de protection des données.

5. Sous-traitants
TalentScan peut faire appel à tout sous-traitant de son choix sans notification préalable au Client.

6. Classement automatique et absence de garantie
Le classement des candidats est produit automatiquement. TalentScan ne garantit ni l'exactitude des scores, ni l'absence de biais, ni la conformité du service à une réglementation locale quelconque. Le Client est seul responsable de l'usage des scores dans ses décisions de recrutement.

7. Propriété des résultats
Les scores, classements, profils enrichis et modèles dérivés sont et demeurent la propriété de TalentScan. Le Client bénéficie d'un droit d'usage interne non exclusif pendant la durée du contrat.

8. Sécurité et incidents
TalentScan applique des mesures de sécurité qu'elle juge appropriées. En cas d'incident de sécurité, TalentScan informera le Client lorsqu'elle l'estimera nécessaire, sans engagement de délai.

9. Audit
Le Client renonce à tout droit d'audit sur site ou sur documents. TalentScan pourra, à sa discrétion, fournir une attestation de conformité.

10. Responsabilité
TalentScan exclut toute responsabilité au titre du présent contrat, y compris en cas de perte de données, de décision de recrutement contestée ou de sanction prononcée par une autorité, dans toute la mesure permise par la loi applicable. Le Client garantit TalentScan contre toute réclamation d'un candidat.

11. Modifications
TalentScan peut modifier les présentes conditions à tout moment, les modifications prenant effet dès leur publication en ligne.

12. Droit applicable
Le présent contrat est régi par le droit anglais et relève de la compétence exclusive des tribunaux de Londres.`,
  },
];

export const CATEGORIES = [
  ["chatbot", "Chatbot, assistant interne"],
  ["rh", "Ressources humaines, recrutement"],
  ["marketing", "Marketing, contenus"],
  ["support", "Support client"],
  ["documents", "Analyse de documents"],
  ["code", "Assistant de code"],
  ["autre", "Autre"],
];

export const DATA_TYPES = [
  ["aucune", "Aucune donnée personnelle"],
  ["clients", "Données clients"],
  ["rh", "Données RH (CV, salaires, évaluations)"],
  ["sante", "Données de santé"],
  ["confidentiel", "Documents confidentiels"],
  ["code", "Code propriétaire"],
];
