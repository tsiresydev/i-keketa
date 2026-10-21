# I-Keketa

Plateforme de chat en ligne pour les utilisateurs de Madagascar : rencontres aléatoires et
échanges **anonymes**, via une interface web responsive pensée pour le mobile.

Ce dépôt contient l'implémentation des **Sprints 1, 2 et 3** (voir `docs/product/cahier-des-charges.md`) :

**Sprint 1**

- **Inscription / connexion** (email + mot de passe, validation email, JWT)
- **Chat aléatoire** (file d'attente et mise en relation aléatoire)
- **Messagerie texte temps réel** (Socket.IO, messages persistés)

**Sprint 2**

- **Profil enrichi** (nom affiché, centres d'intérêt, localisation)
- **Photo de profil** (upload JPEG/PNG/WebP, 2 Mo maximum, stockage local)
- **Recherche de membres** (filtres intérêts / localisation / recherche textuelle, pagination)
- **Discussion directe** (démarrage d'une session avec un membre choisi)

**Sprint 3**

- **Appel audiovisuel** (WebRTC pair-à-pair, signalisation relayée par Socket.IO, micro et caméra,
  lancé automatiquement dès la mise en relation)
- **Signalement d'abus** (motif, descriptif facultatif, statut `pending`)

> La **modération** n'est pas implémentée : les signalements sont enregistrés et restent au statut
> `pending`. Aucun outil de consultation, de traitement ou de sanction n'est exposé.

## Stack technique

| Couche           | Choix                                                         |
| ---------------- | ------------------------------------------------------------- |
| Frontend         | React 19 + TypeScript + Vite 7 (CSS natif, sans framework UI) |
| Backend          | Node.js 20 + Express 4 + TypeScript                           |
| Temps réel       | Socket.IO 4 (WebSocket)                                       |
| Base de données  | MongoDB + Mongoose 8                                          |
| Authentification | JWT (bcrypt pour le hachage des mots de passe)                |
| Validation       | Zod (client et serveur)                                       |
| Tests            | Vitest + Supertest + socket.io-client + mongodb-memory-server |
| Qualité          | ESLint 9 (flat config) + Prettier + `tsc --noEmit`            |

## Prérequis

- Node.js **>= 20.19**
- npm **>= 10**
- MongoDB (optionnel en développement — voir ci-dessous)

## Installation

```bash
npm install
```

## Configuration

Deux fichiers `.env` (jamais commités, voir `.gitignore`) :

- `backend/.env` — variables du serveur (base de données, JWT, CORS, ports).
- `frontend/.env` — variables du navigateur et cible du proxy de développement.

```bash
copy backend\.env.example backend\.env   # Windows
cp backend/.env.example backend/.env     # Linux / macOS
```

Puis renseignez au minimum `JWT_SECRET` dans `backend/.env`.

| Variable                    | Où       | Rôle                                                                                                               |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`               | backend  | URI MongoDB. Si vide **et** `USE_IN_MEMORY_DB=true`, un MongoDB en mémoire est démarré (développement uniquement). |
| `USE_IN_MEMORY_DB`          | backend  | Démarre un MongoDB en mémoire lorsque `MONGODB_URI` est vide.                                                      |
| `JWT_SECRET`                | backend  | Secret de signature des jetons (16 caractères minimum). **Obligatoire.**                                           |
| `CORS_ORIGIN`               | backend  | Origines autorisées, séparées par des virgules.                                                                    |
| `PORT`                      | backend  | Port du backend (3000 par défaut dans `.env.example`).                                                             |
| `PHOTO_MAX_SIZE_BYTES`      | backend  | Taille maximale d'une photo de profil (2097152 = 2 Mo par défaut).                                                 |
| `PHOTO_STORAGE_DIR`         | backend  | Dossier de stockage des photos, relatif au dossier de travail du backend.                                          |
| `REPORT_DETAILS_MAX_LENGTH` | backend  | Longueur maximale du descriptif d'un signalement (1000 par défaut).                                                |
| `REPORT_RATE_LIMIT_MAX`     | backend  | Nombre maximal de signalements par fenêtre et par IP (5 par défaut).                                               |
| `VITE_API_URL`              | frontend | URL de l'API appelée par le navigateur (vide = même origine).                                                      |
| `VITE_API_PROXY_TARGET`     | frontend | Cible du proxy de développement Vite (`/api`, `/uploads` et `/socket.io`).                                         |
| `VITE_STUN_URLS`            | frontend | Serveurs ICE de la négociation WebRTC, séparés par des virgules (`stun:stun.l.google.com:19302` par défaut).       |

La liste complète est documentée dans `docs/architecture/.env.example`, `backend/.env.example`
et `frontend/.env.example`.

> **Le port du backend et la cible du proxy doivent rester synchronisés.** Si `PORT` vaut `4000`
> dans `backend/.env`, alors `VITE_API_PROXY_TARGET` doit valoir `http://localhost:4000`
> dans `frontend/.env`.

## Démarrage

```bash
npm run dev          # backend + frontend
```

Puis ouvrir <http://localhost:5173>.

Le frontend proxifie `/api`, `/uploads` et `/socket.io` vers le backend. Pour changer de port sans modifier
les fichiers, sur Powershell :

```powershell
$env:VITE_API_PROXY_TARGET="http://localhost:3100"; npm run dev:frontend
```

## Parcours utilisateur

1. **Inscription** (`/inscription`) — email + mot de passe ; le nom affiché, les centres d'intérêt et la
   localisation sont facultatifs.
2. **Mon profil** (`/profil`) — modifier le nom affiché, les intérêts, la localisation ; envoyer ou
   supprimer la photo de profil.
3. **Découvrir** (`/decouvrir`) — rechercher des membres (nom, intérêts, localisation), puis cliquer sur
   « Discuter » pour démarrer une discussion directe.
4. **Discussion** (`/chat`) — mise en relation aléatoire (file d'attente) ou session directe déjà
   initiée. Le partenaire est identifié par son pseudonyme, et par son nom/photo s'il les a
   renseignés. L'appel audiovisuel démarre **automatiquement** dès la mise en relation (le
   navigateur demande l'accès au micro et à la caméra) ; le bouton « Appeler » permet de relancer
   un appel arrêté, le bouton « Signaler » ouvre le formulaire de signalement d'abus.

## API Sprint 2

| Méthode  | Route                      | Description                                                                  |
| -------- | -------------------------- | ---------------------------------------------------------------------------- |
| `PUT`    | `/api/users/me`            | Met à jour le profil (`displayName`, `interests`, `location`)                |
| `POST`   | `/api/users/me/photo`      | Envoie une photo de profil (`multipart/form-data`, champ `photo`)            |
| `DELETE` | `/api/users/me/photo`      | Supprime la photo de profil                                                  |
| `GET`    | `/api/users`               | Annuaire filtrable et paginé (`q`, `interests`, `location`, `page`, `limit`) |
| `GET`    | `/uploads/photos/:fichier` | Photo de profil servie en statique                                           |

Événement temps réel `chat:start` (`{ userId }`) : démarre une session avec un membre précis.
La cible doit être connectée et libre, sinon l'erreur `USER_UNAVAILABLE` est renvoyée.

## API Sprint 3

| Méthode | Route             | Description                                                        |
| ------- | ----------------- | ------------------------------------------------------------------ |
| `POST`  | `/api/reports`    | Signalement d'abus du partenaire (`matchId`, `reason`, `details?`) |
| `GET`   | `/api/reports/me` | Signalements émis par l'utilisateur courant (statut `pending`)     |

Événements temps réel de signalisation : `media:request`, `media:accept`, `media:offer`,
`media:answer`, `media:candidate`, `media:state`, `media:end` (client → serveur) et
`media:request`, `media:accepted`, `media:offer`, `media:answer`, `media:candidate`, `media:state`,
`media:ended` (serveur → client).

Le détail des contrats se trouve dans `docs/architecture/api.md`.

## Déploiement (plan gratuit)

| Composant | Hébergeur | Plan  | URL                               |
| --------- | --------- | ----- | --------------------------------- |
| Frontend  | Vercel    | Hobby | https://i-keketa.vercel.app       |
| Backend   | Render    | Free  | https://i-keketa-api.onrender.com |

Les deux services se construisent automatiquement depuis `main`
(`https://github.com/tsiresydev/i-keketa`) :

- `render.yaml` (racine) décrit le service **Render** (build, démarrage, health check `/health`,
  variables d'environnement) ;
- `frontend/vercel.json` décrit le routage SPA du **frontend Vercel** (`/chat`, `/profil`,
  `/decouvrir` sont servies par `index.html`) ;
- la variable `VITE_API_URL` du frontend pointe vers le backend Render.

Le détail des variables, des limitations du plan gratuit et des commandes de redéploiement se trouve
dans `docs/deployment/deployment.md`.

## Commandes utiles

| Commande                                           | Description                                                    |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                                      | Démarre le backend et le frontend en mode développement        |
| `npm run build`                                    | Build de production (backend `dist/`, frontend `dist/`)        |
| `npm start`                                        | Lance le backend compilé                                       |
| `npm test`                                         | Lance les tests backend puis frontend                          |
| `npm run test:backend` / `npm run test:frontend`   | Tests d'un seul paquet                                         |
| `npm run lint` / `npm run lint:fix`                | Analyse statique ESLint                                        |
| `npm run format`                                   | Formatage Prettier                                             |
| `npm run typecheck`                                | Vérification des types (backend + frontend)                    |
| `npm run verify`                                   | lint + typecheck + tests + build                               |
| `node scripts/e2e-check.cjs http://127.0.0.1:4000` | Vérification fonctionnelle bout-en-bout sur un serveur démarré |

> Le script E2E crée plusieurs comptes : il consomme donc la limite d'authentification
> (`AUTH_RATE_LIMIT_MAX`, 10 requêtes par fenêtre de 15 minutes et par IP). Pour l'enchaîner plusieurs
> fois sans attendre, démarrer le backend avec `AUTH_RATE_LIMIT_MAX=1000` (Powershell :
> `$env:AUTH_RATE_LIMIT_MAX="1000"; npm run dev:backend`).

## Structure du dépôt

```text
i-keketa/
├── backend/              # API REST + temps réel
│   ├── src/
│   │   ├── config/       # variables d'environnement, journalisation
│   │   ├── db/           # connexion MongoDB
│   │   ├── models/       # User, Message, Match, Report, CallSession (Mongoose)
│   │   ├── modules/      # auth, users, chat, media, reports (routes / contrôleurs / services)
│   │   ├── middleware/   # authentification, validation, upload, rate limiting, erreurs
│   │   ├── realtime/     # serveur Socket.IO
│   │   ├── schemas/      # schémas de validation Zod
│   │   └── utils/        # JWT, hachage, erreurs, nettoyage de texte
│   ├── tests/            # tests unitaires et d'intégration
│   └── uploads/photos/   # photos de profil (généré, non versionné)
├── frontend/             # interface React
│   ├── src/
│   │   ├── components/   # composants d'interface réutilisables
│   │   ├── context/      # contexte d'authentification
│   │   ├── hooks/        # useAuth, useChatSocket, useMediaCall
│   │   ├── lib/          # client API, socket, validation, stockage du jeton
│   │   ├── pages/        # Connexion, Inscription, Chat, Profil, Découvrir
│   │   └── styles/       # feuille de style globale
│   └── tests/            # tests de composants et unitaires
├── docs/                 # documentation produit, architecture, développement
└── scripts/              # scripts d'outillage (vérification bout-en-bout)
```

## Documentation

- `docs/product/cahier-des-charges.md` — cahier des charges (**source de vérité**, lecture seule)
- `docs/product/prd.md` — spécification produit et périmètre par sprint
- `docs/architecture/architecture.md` — architecture implémentée
- `docs/architecture/api.md` — contrats REST et temps réel
- `docs/architecture/database.md` — modèle de données
- `docs/development/coding-guidelines.md` — conventions de code
- `docs/development/security.md` — mesures de sécurité
- `docs/development/definition-of-done.md` — critères de fin de tâche
