# I-Keketa

Plateforme de chat en ligne pour les utilisateurs de Madagascar : rencontres aléatoires et
échanges **anonymes**, via une interface web responsive pensée pour le mobile.

Ce dépôt contient l'implémentation du **Sprint 1** (voir `docs/product/cahier-des-charges.md`) :

- **Inscription / connexion** (email + mot de passe, validation email, JWT)
- **Chat aléatoire** (file d'attente et mise en relation aléatoire)
- **Messagerie texte temps réel** (Socket.IO, messages persistés)

> Le périmètre fonctionnel est celui du Sprint 1. Les fonctions des sprints 2 et 3
> (profil, filtres de recherche, audio/vidéo, signalement, modération) ne sont pas implémentées.

## Stack technique

| Couche | Choix |
|--------|-------|
| Frontend | React 19 + TypeScript + Vite 7 (CSS natif, sans framework UI) |
| Backend | Node.js 20 + Express 4 + TypeScript |
| Temps réel | Socket.IO 4 (WebSocket) |
| Base de données | MongoDB + Mongoose 8 |
| Authentification | JWT (bcrypt pour le hachage des mots de passe) |
| Validation | Zod (client et serveur) |
| Tests | Vitest + Supertest + socket.io-client + mongodb-memory-server |
| Qualité | ESLint 9 (flat config) + Prettier + `tsc --noEmit` |

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

| Variable | Où | Rôle |
|----------|-----|------|
| `MONGODB_URI` | backend | URI MongoDB. Si vide **et** `USE_IN_MEMORY_DB=true`, un MongoDB en mémoire est démarré (développement uniquement). |
| `USE_IN_MEMORY_DB` | backend | Démarre un MongoDB en mémoire lorsque `MONGODB_URI` est vide. |
| `JWT_SECRET` | backend | Secret de signature des jetons (16 caractères minimum). **Obligatoire.** |
| `CORS_ORIGIN` | backend | Origines autorisées, séparées par des virgules. |
| `PORT` | backend | Port du backend (3000 par défaut dans `.env.example`). |
| `VITE_API_URL` | frontend | URL de l'API appelée par le navigateur (vide = même origine). |
| `VITE_API_PROXY_TARGET` | frontend | Cible du proxy de développement Vite (`/api` et `/socket.io`). |

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

Le frontend proxifie `/api` et `/socket.io` vers le backend. Pour changer de port sans modifier
les fichiers, sur Powershell :

```powershell
$env:VITE_API_PROXY_TARGET="http://localhost:3100"; npm run dev:frontend
```

## Commandes utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le backend et le frontend en mode développement |
| `npm run build` | Build de production (backend `dist/`, frontend `dist/`) |
| `npm start` | Lance le backend compilé |
| `npm test` | Lance les tests backend puis frontend |
| `npm run test:backend` / `npm run test:frontend` | Tests d'un seul paquet |
| `npm run lint` / `npm run lint:fix` | Analyse statique ESLint |
| `npm run format` | Formatage Prettier |
| `npm run typecheck` | Vérification des types (backend + frontend) |
| `npm run verify` | lint + typecheck + tests + build |
| `node scripts/e2e-check.cjs http://127.0.0.1:4000` | Vérification fonctionnelle bout-en-bout sur un serveur démarré |

## Structure du dépôt

```text
i-keketa/
├── backend/              # API REST + temps réel
│   ├── src/
│   │   ├── config/       # variables d'environnement, journalisation
│   │   ├── db/           # connexion MongoDB
│   │   ├── models/       # User, Message, Match (Mongoose)
│   │   ├── modules/      # auth, users, chat (routes / contrôleurs / services)
│   │   ├── middleware/   # authentification, validation, rate limiting, erreurs
│   │   ├── realtime/     # serveur Socket.IO
│   │   ├── schemas/      # schémas de validation Zod
│   │   └── utils/        # JWT, hachage, erreurs, nettoyage de texte
│   └── tests/            # tests unitaires et d'intégration
├── frontend/             # interface React
│   ├── src/
│   │   ├── components/   # composants d'interface réutilisables
│   │   ├── context/      # contexte d'authentification
│   │   ├── hooks/        # useAuth, useChatSocket
│   │   ├── lib/          # client API, socket, validation, stockage du jeton
│   │   ├── pages/        # Connexion, Inscription, Chat
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
