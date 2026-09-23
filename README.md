# UwatchMe

Application de streaming **gratuite et légale** : Android, iPhone, Windows, Mac, Linux (PWA installable).
Interface en arabe (RTL), français et anglais.

Ce que l'app lit :

| Source | Contenu | Lecture |
|---|---|---|
| Playlists YouTube **officielles** (catalog.json) | Séries arabes, turques, anime, enfants, films | Lecteur YouTube intégré (obligatoire, règles YouTube) |
| Internet Archive (`feature_films`, `animationandcartoons`) | Films et dessins animés du domaine public | Lecteur intégré **ou** app externe (MX Player, VLC, Infuse…) |
| TMDB + JustWatch | Toutes les séries et tous les films | Fiche, bande-annonce, épisodes, et **où regarder légalement** dans le pays choisi |

Même structure que Noor : fichiers séparés, pas de framework, pas de build.

```
index.html            coquille de l'app
css/style.css         design
js/i18n.js            textes ar / fr / en
js/core.js            réglages, stockage, API, catalogue, progression, routeur
js/ui.js              icônes, cartes, rangées, toast
js/views.js           accueil, séries, films, anime, recherche, ma liste, paramètres
js/detail.js          fiche TMDB, lecteur série YouTube, lecteur film + apps externes
js/app.js             démarrage et navigation
admin.html, js/admin.js   outil pour construire catalog.json
api/tmdb.js  api/yt.js  api/archive.js   fonctions Vercel (les clés restent côté serveur)
lib/catalog.js        lecture de catalog.json côté serveur
catalog.json          VOTRE catalogue de séries gratuites (vide au départ)
sw.js                 hors ligne + cache
tests/api.test.mjs    tests des fonctions API (node tests/api.test.mjs)
```

## 1. Les clés (gratuites)

1. **TMDB** : créez un compte sur themoviedb.org → Paramètres → API → copiez le **API Read Access Token** (le long jeton).
2. **YouTube Data API v3** : console.cloud.google.com → nouveau projet → « APIs & Services » → activez **YouTube Data API v3** → Identifiants → **Clé API**. Restreignez la clé à « YouTube Data API v3 ».
3. **ADMIN_KEY** : inventez une longue phrase secrète (elle protège l'aperçu des nouvelles playlists).

## 2. Déployer sur Vercel

1. Poussez ce dossier sur GitHub (nouveau repo, ou un dossier `uwatchme` dans un repo existant).
2. Vercel → Add New → Project → importez le repo. Si l'app est dans un sous-dossier, mettez **Root Directory** = ce dossier. Framework : *Other*. Pas de build.
3. Settings → Environment Variables :
   - `TMDB_TOKEN` = le jeton TMDB
   - `YOUTUBE_API_KEY` = la clé YouTube
   - `ADMIN_KEY` = votre phrase secrète
4. Redéployez. En local : `npx vercel dev`.

## 3. Ajouter les séries gratuites

1. Ouvrez `https://VOTRE-APP.vercel.app/admin.html`.
2. Entrez `ADMIN_KEY`, collez le lien d'une playlist, choisissez la catégorie, associez la fiche TMDB si vous voulez (affiche + badge « Gratuit »).
3. L'outil détecte si la playlist commence par le dernier épisode et propose d'inverser l'ordre.
4. **Télécharger catalog.json** → remplacez le fichier dans le repo → push. Vercel redéploie.

**Règle légale, à respecter pour chaque playlist :** uniquement la chaîne officielle qui détient les droits (chaîne TV, société de production, distributeur, souvent avec le badge vérifié). Jamais une chaîne qui ré-uploade le travail d'un autre. Si un film de l'Internet Archive pose problème, ajoutez son identifiant dans « Films à masquer ».

## 4. Installer l'app

- **Android** (Chrome) : menu ⋮ → *Installer l'application*, ou le bouton dans Paramètres.
- **iPhone / iPad** (Safari) : Partager → *Sur l'écran d'accueil*.
- **Windows / Mac / Linux** (Chrome, Edge) : icône d'installation dans la barre d'adresse.

Lecteurs externes pour les films du domaine public : sur Android, le bouton ouvre le sélecteur d'apps vidéo installées (MX Player, VLC…). Sur iPhone : VLC ou Infuse. Partout : copier le lien ou télécharger.
Les épisodes YouTube restent dans le lecteur YouTube : les envoyer vers une autre app est interdit par les règles de YouTube.

## 5. Stores (optionnel)

Allez sur **pwabuilder.com**, entrez l'adresse de l'app :
- **Google Play** : paquet Android (TWA) prêt à envoyer dans la Play Console.
- **Microsoft Store** : paquet Windows.
- **App Store** : paquet iOS à compiler dans Xcode. Apple refuse parfois les apps qui ne sont « qu'un site » (règle 4.2) ; la PWA installée depuis Safari marche sans le store.

## 6. Quotas et mises à jour

- YouTube : 10 000 unités/jour gratuites. Une série de 50 épisodes coûte ~2 unités, et la réponse est mise en cache 6 h sur Vercel : largement suffisant.
- À chaque nouvelle version, changez `VERSION` dans `sw.js` (ex. `uwatchme-v2`) pour que les téléphones récupèrent les nouveaux fichiers.
- Renommer l'app : `F.config` dans `js/core.js`, `manifest.webmanifest`, et `<title>` dans `index.html`.

## Crédits

Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB. Données « où regarder » fournies par JustWatch. Films du domaine public : Internet Archive.
