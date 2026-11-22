# Zenkai Card Collection

Crée un site de collection de cartes anime style Kyara en thème sombre et moderne appelé "Zenkai". Mets en place une barre de navigation en haut avec 3 onglets : "Boosters", "Ma Collection" et "Échanges". Sur la page Boosters, affiche un paquet de cartes stylisé au centre avec un bouton "Ouvrir un booster gratuit" qui révèle 3 cartes anime aléatoires avec une animation de retournement et un contour coloré selon la rareté (Commune en gris, Rare en bleu, Épique en violet, Légendaire en doré). Utilise pour l'instant 10 personnages fictifs de test et ajoute un compte à rebours de 10 minutes après chaque ouverture.

This project was built with [Lovable](https://lovable.dev).

## Ouverture des boosters

La bêta se termine le 29 novembre 2026 à 15 h 30 (UTC+1). L'accès par code et le
pack de bienvenue (+500 Zen locaux et titre) sont propres au navigateur, pas sécurisés
contre leur modification. Le raccourci à cinq clics n'est pas une authentification
administrateur. À la fin, les données locales de progression sont effacées une fois
par navigateur lorsque le site est ouvert ou rouvert, et la session locale est
déconnectée. Les données serveur, y compris les comptes et cartes Google, ne sont pas
effacées par ce mécanisme : leur réinitialisation complète, y compris la progression
préexistante, doit être configurée séparément dans Lovable avant le lancement officiel.
Les autres appareils et navigateurs ne sont nettoyés qu'à leur prochaine visite.
Pendant la bêta, le profil permet de réinitialiser la progression locale invitée de
cet appareil à 500 Zen et au niveau 1, après confirmation. Les données locales
partagées sont également effacées ; les comptes connectés ne peuvent pas encore
être réinitialisés depuis ce bouton et nécessitent une opération serveur dans Lovable.

La révélation affiche les cartes de la moins rare à la plus rare, puis le récapitulatif dans
l'ordre inverse. Le badge « NOUVEAU » compare le tirage à la collection avant ouverture.
Sur mobile, la navigation principale est accessible en bas de l'écran. Cliquer ou toucher
une pochette ouvre le choix de quantité et l'aperçu du pack. Pendant l'ouverture, un appui ou un
glissement horizontal déchire la pochette ; la déchirure continue aussi automatiquement.
Un glissement retourne la carte.
Le pack Protagoniste utilise sa pochette dédiée dans le sélecteur et pendant la déchirure,
ainsi que son dos de carte exclusif pendant la déchirure et la révélation.
Les pochettes sont cadrées sur le gabarit Shonen pour garder les mêmes dimensions et
marges dans le sélecteur et pendant l'ouverture.
En développement et pendant la bêta après validation du code, le mode invité permet
des ouvertures gratuites simulées et non sauvegardées ; le Booster Zenkai nécessite
une prise en charge sécurisée du Zen par le serveur et n'est pas encore disponible.
Les raretés de certains personnages sont surchargées dans le catalogue affiché et les
simulations locales. La table `CUSTOM_RARITY` dans `src/lib/cards.ts` accepte des noms
complets en minuscules et prend priorité sur les surcharges existantes. Pour les comptes connectés, le serveur reste seul responsable des
raretés utilisées pour sélectionner les cartes et calculer les gains de recyclage :
ces règles nécessitent une mise à jour des données dans Lovable pour correspondre à l'affichage.
Shonen Mix inclut tout le catalogue dans l'aperçu et les tirages invités, avec les taux
gratuits. La règle universelle des tirages connectés nécessite une mise à jour de
`public.open_boosters` dans Lovable et l'import côté serveur des cartes manquantes ;
l'aperçu peut donc montrer des cartes qui ne sont pas encore tirables en ligne.
Dans l'aperçu des packs, les Transcendances exclusives restent mystérieuses tant que
leur carte n'est pas présente dans la collection active. Si celle-ci est indisponible,
elles restent masquées jusqu'à sa vérification.
Le catalogue affiché inclut jusqu'à 25 personnages My Hero Academia chargés depuis
AniList ; les identifiants de rareté et de rôle correspondent aux personnages AniList.
Leur disponibilité dépend de la réponse d'AniList et des cartes déjà présentes ; les
personnages absents des 25 premiers ne sont pas ajoutés séparément.
Gon « Serment Absolu » est une Transcendance exclusive du catalogue local : les tirages
invités restent des simulations non sauvegardées et sa disponibilité en ligne nécessite
une prise en charge côté serveur dans Lovable. Une copie de Gon déjà transcendée utilise
son illustration éveillée ; l'éveil manuel est actuellement désactivé côté serveur.
Les cartes Transcendance partagent un cadre métallique arc-en-ciel et une plaque collector
en obsidienne, avec des paillettes animées sur l'image, sans voile coloré ni filtre sur
l'illustration, y compris dans les annonces du marché local. Les illustrations sont
affichées plein cadre, avec un recadrage possible ;
les animations respectent le mouvement réduit.
À l'ouverture, chaque Transcendance révélée déclenche un blackout arc-en-ciel suivi d'un
impact et de rayons autour de la carte ; Full Skip reste disponible et le mouvement
réduit affiche la carte directement. Le sceau indique le taux standard, hors bonus.

L'album par anime regroupe les cartes du catalogue chargé par série et compte les
identifiants distincts possédés (pas les formes). Les cartes sans série sont exclues ;
certaines exclusivités locales ne sont pas encore obtenables sur un compte connecté.
Une liste recherchable permet de choisir un anime et d'afficher ses cartes et sa
récompense avant de revenir à la liste.
Les récompenses d'album et les quêtes sont enregistrées sur cet appareil, séparément
pour la collection locale et chaque compte, et créditent le solde de Zen local partagé,
jamais les Coins du serveur. Le titre d'album est conservé dans l'album. Les quêtes
quotidiennes se réinitialisent à minuit, heure locale ; les simulations invitées comptent
comme ouvertures mais ne sauvegardent pas de cartes. La progression ne se synchronise
pas entre appareils, et nécessite que les événements soient suivis dans ce navigateur.
L'onglet Missions rassemble ces récompenses et la progression XP locale, distincte des
missions et niveaux du compte en ligne. L'XP et les Zen locaux sont partagés sur cet
appareil ; les découvertes sont suivies séparément pour la collection locale et chaque
compte. Les cartes déjà possédées lors de l'initialisation servent de référence sans XP
rétroactive ; une carte déjà découverte ne rapporte pas d'XP supplémentaire. Chaque
palier de 600 XP accorde 100 Zen locaux. Le niveau affiché est recalculé à partir de
l'XP totale ; les Zen déjà gagnés avec l'ancienne courbe restent acquis. Le bonus de connexion est partagé sur cet
appareil : une récompense par jour, avec une série de sept jours qui recommence après
le septième jour ou après un jour manqué. Les tirages invités restent des simulations,
mais leurs découvertes et leur XP sont mémorisées localement.

Le bouton Profil de l'en-tête ouvre la personnalisation locale : pseudo, bio, bannière,
avatar, cadre, titre et huit cartes en vitrine. Les quatre premiers emplacements d'un
profil existant sont conservés automatiquement. Le profil est partagé sur cet appareil
et ne modifie pas le profil en ligne ni l'avatar Zenkai+. Les cartes proposées proviennent
de la collection du compte connecté ou, en mode invité, de la collection locale.
Si une carte possédée manque du catalogue chargé, elle ne peut pas être sélectionnée ;
les choix devenus indisponibles doivent être remplacés avant l'enregistrement. Les cadres
de niveau utilisent le niveau local, et les titres d'album sont ceux réclamés pour la
collection active. Les statistiques d'albums suivent le catalogue de l'onglet Album.

Les dix missions secrètes, leurs récompenses et leurs titres sont locaux à cet appareil
et communs aux collections locale et connectée. Les collections sont évaluées séparément ;
le recyclage est compté à partir de l'activation de cette fonctionnalité. Les tirages
invités peuvent débloquer leurs succès, sans ajouter les cartes simulées à la collection.
Les récompenses et titres sont crédités automatiquement dès la réussite ; les anciens
cadeaux découverts mais non réclamés sont crédités à l'ouverture de l'application.
La révélation d'un succès reste affichée jusqu'au clic.

Les favoris se choisissent dans l'aperçu des packs et sont enregistrés sur cet appareil,
pas sur le compte. Ils sont partagés entre les onglets et signalés dans la collection et
à la révélation ; le filtre de favoris se combine aux autres filtres. Un favori suit
l'identifiant de la carte, y compris ses copies transcendées.

L'éditeur de raretés de l'aperçu enregistre ses réglages dans le navigateur, par identifiant
de carte. Il modifie l'affichage et les simulations locales, pas les tirages ni les gains
des comptes connectés. La Transcendance reste un état de copie et ne peut pas être définie
comme rareté de catalogue. L'export copie une constante TypeScript des réglages locaux.
Les choix de l'éditeur priment sur les valeurs par identifiant de `USER_RARITY_OVERRIDES`,
qui priment à leur tour sur les règles de rareté par nom.

## Marché et amis locaux

Pendant la bêta, la Boutique reste accessible depuis la navigation mais les achats de
boosters y sont désactivés ; la page annonce son ouverture prochaine.

Le marché est une simulation enregistrée sur cet appareil : les marchands et les enchérisseurs
sont fictifs. Les Zen et les cartes locaux sont distincts de ceux du compte connecté ; dans
la collection, utilise « Voir ma collection locale » pour vendre une copie locale. Les annonces
et enchères échues sont réglées tant que le site est ouvert, ou à sa prochaine ouverture.
La salle maintient six enchères fictives de 30 minutes à 24 heures ; les ventes du joueur
durent au choix 1, 6, 12, 24 ou 48 heures (24 heures par défaut). Les annonces existantes
conservent leur échéance. Une surenchère augmente l'offre d'au moins
50 Zen ou 10 % (le plus élevé). Les Zen sont réservés puis remboursés en cas de
surenchère ; les cartes mises en vente sont réservées jusqu'à la clôture ou l'annulation.
Un rival fictif offre le prix de départ sur les ventes du joueur. Les enchères sont
également visibles dans `zenkai_market_auctions` ; l'état local de la collection reste
la source des transactions pour éviter de perdre les cartes ou les Zen en cas d'échec.
Une enchère peut avoir un prix d'achat immédiat facultatif, supérieur au prix de départ ;
les suggestions dépendent de la rareté effective et restent modifiables. Une offre qui
atteint ce prix conclut l'achat au prix affiché, en déduisant les Zen déjà réservés.
À 30 secondes, un acheteur fictif a une chance sur deux d'acheter immédiatement une
annonce du joueur dont le prix ne dépasse pas la suggestion de sa rareté ; sinon
l'enchère suit son cours. Les anciennes annonces sans prix immédiat restent inchangées.
Évite les transactions simultanées dans plusieurs onglets. Si le catalogue distant est
indisponible, la salle utilise les cartes intégrées et indique que le choix est réduit.
La collection permet de trier globalement et de filtrer par rareté effective ; les compteurs
indiquent les formes distinctes possédées après le filtre de pack. Les estimations locales
dépendent de la rareté et de la popularité du catalogue ; le recyclage groupé local conserve
la copie ordinaire la plus ancienne, exclut les Transcendances et arrondit le bonus Zenkai+
à l'entier supérieur par rareté. Les montants réellement recyclés sur un compte
connecté restent régis par le serveur et sont affichés en Coins.

La liste d'amis est locale et n'envoie aucune demande. L'ajout par pseudo ne vérifie pas
l'existence d'un joueur ; une recherche de profil vérifié est proposée aux comptes connectés.
Les échanges réels ne sont pas encore disponibles.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ac66641d-974c-4704-8740-5b088578b55a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
