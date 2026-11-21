# Zenkai Card Collection

Crée un site de collection de cartes anime style Kyara en thème sombre et moderne appelé "Zenkai". Mets en place une barre de navigation en haut avec 3 onglets : "Boosters", "Ma Collection" et "Échanges". Sur la page Boosters, affiche un paquet de cartes stylisé au centre avec un bouton "Ouvrir un booster gratuit" qui révèle 3 cartes anime aléatoires avec une animation de retournement et un contour coloré selon la rareté (Commune en gris, Rare en bleu, Épique en violet, Légendaire en doré). Utilise pour l'instant 10 personnages fictifs de test et ajoute un compte à rebours de 10 minutes après chaque ouverture.

This project was built with [Lovable](https://lovable.dev).

## Ouverture des boosters

La révélation affiche les cartes de la moins rare à la plus rare, puis le récapitulatif dans
l'ordre inverse. Le badge « NOUVEAU » compare le tirage à la collection avant ouverture.
En mode invité, l'ouverture reste une simulation non sauvegardée ; le Booster Zenkai nécessite
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

Le marché est une simulation enregistrée sur cet appareil : les marchands et les enchérisseurs
sont fictifs. Les Zen et les cartes locaux sont distincts de ceux du compte connecté ; dans
la collection, utilise « Voir ma collection locale » pour vendre une copie locale. Les annonces
et enchères échues sont réglées à l'ouverture du marché. Évite les transactions simultanées
dans plusieurs onglets. Le chargement initial du catalogue dépend du serveur.
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
