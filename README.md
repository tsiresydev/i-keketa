# I-Keketa

Plateforme de chat en ligne pour les utilisateurs de Madagascar : rencontres alÃ©atoires et
Ã©changes **anonymes**, via une interface web responsive pensÃ©e pour le mobile.

Ce dÃ©pÃ´t contient la refonte majeure de l'application : **sessions anonymes sans inscription ni
connexion**. Le visiteur saisit uniquement un nom affichÃ© et est mis en relation alÃ©atoirement ;
aucun compte, aucun email, aucun mot de passe, aucune photo ni profil n'est demandÃ©.

FonctionnalitÃ©s principales :

- **Session anonyme** (nom affichÃ© uniquement, jeton JWT technique)
- **Chat alÃ©atoire** (file d'attente et mise en relation alÃ©atoire)
- **Messagerie texte temps rÃ©el** (Socket.IO, messages persistÃ©s)
- **Appel audiovisuel** (WebRTC pair-Ã -pair, signalisation relayÃ©e par Socket.IO, micro et camÃ©ra,
  lancÃ© automatiquement dÃ¨s la mise en relation)

> La **discussion directe**, l'**annuaire des membres**, les **profils** et la **photo de profil**
> ont Ã©tÃ© retirÃ©s du pÃ©rimÃ¨tre.

## Stack technique

| Couche           | Choix                                                                 |
| ---------------- | --------------------------------------------------------------------- |
| Frontend         | React 19 + TypeScript + Vite 7 (CSS natif, sans framework UI)         |
| Backend          | Node.js 20 + Express 4 + TypeScript                                   |
| Temps rÃ©el      | Socket.IO 4 (WebSocket)                                               |
| Base de donnÃ©es | MongoDB + Mongoose 8                                                  |
| Authentification | JWT signÃ© Ã  partir de l'identifiant de session (aucun mot de passe) |
| Validation       | Zod (client et serveur)                                               |
| Tests            | Vitest + Supertest + socket.io-client + mongodb-memory-server         |
| QualitÃ©         | ESLint 9 (flat config) + Prettier + `tsc --noEmit`                    |

## PrÃ©requis

- Node.js **>= 20.19**
- npm **>= 10**
- MongoDB (optionnel en dÃ©veloppement â€” voir ci-dessous)

## Installation

```bash
npm install
```

## Configuration

Deux fichiers `.env` (jamais commitÃ©s, voir `.gitignore`) :

- `backend/.env` â€” variables du serveur (base de donnÃ©es, JWT, CORS, ports).
- `frontend/.env` â€” variables du navigateur et cible du proxy de dÃ©veloppement.

```bash
copy backend\.env.example backend\.env   # Windows
cp backend/.env.example backend/.env     # Linux / macOS
```

Puis renseignez au minimum `JWT_SECRET` dans `backend/.env`.

| Variable                | OÃ¹      | RÃ´le                                                                                                                  |
| ----------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`           | backend  | URI MongoDB. Si vide **et** `USE_IN_MEMORY_DB=true`, un MongoDB en mÃ©moire est dÃ©marrÃ© (dÃ©veloppement uniquement). |
| `USE_IN_MEMORY_DB`      | backend  | DÃ©marre un MongoDB en mÃ©moire lorsque `MONGODB_URI` est vide.                                                        |
| `JWT_SECRET`            | backend  | Secret de signature des jetons (16 caractÃ¨res minimum). **Obligatoire.**                                              |
| `CORS_ORIGIN`           | backend  | Origines autorisÃ©es, sÃ©parÃ©es par des virgules.                                                                     |
| `PORT`                  | backend  | Port du backend (3000 par dÃ©faut dans `.env.example`).                                                                |
| `VITE_API_URL`          | frontend | URL de l'API appelÃ©e par le navigateur (vide = mÃªme origine).                                                        |
| `VITE_API_PROXY_TARGET` | frontend | Cible du proxy de dÃ©veloppement Vite (`/api`, `/uploads` et `/socket.io`).                                            |
| `VITE_STUN_URLS`        | frontend | Serveurs ICE de la nÃ©gociation WebRTC, sÃ©parÃ©s par des virgules (`stun:stun.l.google.com:19302` par dÃ©faut).       |

La liste complÃ¨te est documentÃ©e dans `docs/architecture/.env.example`, `backend/.env.example`
et `frontend/.env.example`.

> **Le port du backend et la cible du proxy doivent rester synchronisÃ©s.** Si `PORT` vaut `4000`
> dans `backend/.env`, alors `VITE_API_PROXY_TARGET` doit valoir `http://localhost:4000`
> dans `frontend/.env`.

## DÃ©marrage

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

1. **Page d'accueil** (`/`) â€” saisir un nom affichÃ© (2 Ã  40 caractÃ¨res), puis Â« CrÃ©er une session Â».
   Aucun compte ni mot de passe n'est demandÃ©.
2. **Discussion** (`/chat`) â€” mise en relation alÃ©atoire (file d'attente) avec un autre visiteur. Le
   partenaire est identifiÃ© par son nom affichÃ©. L'appel audiovisuel dÃ©marre **automatiquement** dÃ¨s la
   mise en relation (le navigateur demande l'accÃ¨s au micro et Ã  la camÃ©ra) ; le bouton Â« Lancer le
   match Â» permet de relancer un appel arrÃªtÃ©, le bouton Â« Signaler Â» ouvre le formulaire de
   signalement d'abus.

## API

<|channel|> MÃ©thode | Route | Description |
| ------- | -------------------------- | ---------------------------------------------------------------------------- |
| `POST` | `/api/auth/session` | Ouvre une session anonyme Ã  partir du seul nom affichÃ© |
| `GET` | `/api/auth/session` | Session courante (Bearer) |
| `GET` | `/api/chat/matches/:id/messages` | Historique d'une session de chat (Bearer) |

Ã‰vÃ©nements temps rÃ©el de signalisation : `media:request`, `media:accept`, `media:offer`,
`media:answer`, `media:candidate`, `media:state`, `media:end` (client â†’ serveur) et
`media:request`, `media:accepted`, `media:offer`, `media:answer`, `media:candidate`, `media:state`,
`media:ended` (serveur â†’ client).

Le dÃ©tail des contrats se trouve dans `docs/architecture/api.md`.

## DÃ©ploiement (plan gratuit)

| Composant | HÃ©bergeur | Plan  | URL                               |
| --------- | ---------- | ----- | --------------------------------- |
| Frontend  | Vercel     | Hobby | https://i-keketa.vercel.app       |
| Backend   | Render     | Free  | https://i-keketa-api.onrender.com |

Les deux services se construisent automatiquement depuis `main`
(`https://github.com/tsiresydev/i-keketa`) :

- `render.yaml` (racine) dÃ©crit le service **Render** (build, dÃ©marrage, health check `/health`,
  variables d'environnement) ;
- `frontend/vercel.json` dÃ©crit le routage SPA du **frontend Vercel** (`/` et `/chat` sont servies
  par `index.html`) ;
- la variable `VITE_API_URL` du frontend pointe vers le backend Render.

Le dÃ©tail des variables, des limitations du plan gratuit et des commandes de redÃ©ploiement se trouve
dans `docs/deployment/deployment.md`.

## Commandes utiles

| Commande                                           | Description                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run dev`                                      | DÃ©marre le backend et le frontend en mode dÃ©veloppement         |
| `npm run build`                                    | Build de production (backend `dist/`, frontend `dist/`)           |
| `npm start`                                        | Lance le backend compilÃ©                                         |
| `npm test`                                         | Lance les tests backend puis frontend                             |
| `npm run test:backend` / `npm run test:frontend`   | Tests d'un seul paquet                                            |
| `npm run lint` / `npm run lint:fix`                | Analyse statique ESLint                                           |
| `npm run format`                                   | Formatage Prettier                                                |
| `npm run typecheck`                                | VÃ©rification des types (backend + frontend)                      |
| `npm run verify`                                   | lint + typecheck + tests + build                                  |
| `node scripts/e2e-check.cjs http://127.0.0.1:4000` | VÃ©rification fonctionnelle bout-en-bout sur un serveur dÃ©marrÃ© |

> Le script E2E crÃ©e plusieurs sessions : il consomme donc la limite d'ouverture de session
> (`AUTH_RATE_LIMIT_MAX`, 10 requÃªtes par fenÃªtre de 15 minutes et par IP). Pour l'enchaÃ®ner plusieurs
> fois sans attendre, dÃ©marrer le backend avec `AUTH_RATE_LIMIT_MAX=1000` (Powershell :
> `$env:AUTH_RATE_LIMIT_MAX="1000"; npm run dev:backend`).

## Structure du dÃ©pÃ´t

```text
i-keketa/
â”œâ”€â”€ backend/              # API REST + temps rÃ©el
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ config/       # variables d'environnement, journalisation
â”‚   â”‚   â”œâ”€â”€ db/           # connexion MongoDB
â”‚   â”‚   â”œâ”€â”€ models/       # User, Message, Match, Report, CallSession (Mongoose)
â”‚   â”‚   â”œâ”€â”€ modules/      # auth (session), chat, media, reports (routes / contrÃ´leurs / services)
â”‚   â”‚   â”œâ”€â”€ middleware/   # authentification, validation, rate limiting, erreurs
â”‚   â”‚   â”œâ”€â”€ realtime/     # serveur Socket.IO
â”‚   â”‚   â”œâ”€â”€ schemas/      # schÃ©mas de validation Zod
â”‚   â”‚   â””â”€â”€ utils/        # JWT, hachage, erreurs, nettoyage de texte
â”‚   â”œâ”€â”€ tests/            # tests unitaires et d'intÃ©gration
â”‚   â””â”€â”€ uploads/photos/   # photos de profil (gÃ©nÃ©rÃ©, non versionnÃ©)
â”œâ”€â”€ frontend/             # interface React
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ components/   # composants d'interface rÃ©utilisables
â”‚   â”‚   â”œâ”€â”€ context/      # contexte de session
â”‚   â”‚   â”œâ”€â”€ hooks/        # useSession, useChatSocket, useMediaCall
â”‚   â”‚   â”œâ”€â”€ pages/        # Accueil, Chat
â”‚   â”‚   â””â”€â”€ styles/       # feuille de style globale
â”‚   â””â”€â”€ tests/            # tests de composants et unitaires
â”œâ”€â”€ docs/                 # documentation produit, architecture, dÃ©veloppement
â””â”€â”€ scripts/              # scripts d'outillage (vÃ©rification bout-en-bout)
```

## Documentation

- `docs/product/cahier-des-charges.md` â€” cahier des charges (**source de vÃ©ritÃ©**, lecture seule)
- `docs/product/prd.md` â€” spÃ©cification produit et pÃ©rimÃ¨tre par sprint
- `docs/architecture/architecture.md` â€” architecture implÃ©mentÃ©e
- `docs/architecture/api.md` â€” contrats REST et temps rÃ©el
- `docs/architecture/database.md` â€” modÃ¨le de donnÃ©es
- `docs/development/coding-guidelines.md` â€” conventions de code
- `docs/development/security.md` â€” mesures de sÃ©curitÃ©
- `docs/development/definition-of-done.md` â€” critÃ¨res de fin de tÃ¢che
