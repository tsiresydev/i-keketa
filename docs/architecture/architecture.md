# Architecture — Plateforme de Chat

## Vue d'ensemble

Application web composée d'un frontend (React + TypeScript + Vite) et d'un backend (Node.js + Express),
avec MongoDB. Déploiement Vercel (frontend) / Render (backend). Temps réel via Socket.IO.

## Style architectural

Client-serveur avec API REST + WebSocket (Socket.IO) pour le temps réel. Séparation frontend/backend.

## Composants

- Frontend : UI, gestion d'état (contexte React), appels API (`fetch`), client Socket.IO.
- Backend : API Express, auth JWT, gestion utilisateurs, matchmaking, messagerie temps réel.
- Base de données : MongoDB (utilisateurs, messages, sessions de chat).

## Organisation des modules

Monorepo npm workspaces : `backend/` et `frontend/` à la racine, documentation dans `docs/`.

```text
backend/src/
├── config/       # variables d'environnement validées (zod), journalisation serveur
├── db/           # connexion MongoDB (+ repli MongoDB en mémoire en développement)
├── models/       # schémas Mongoose : User, Message, Match
├── modules/      # auth, users, chat → routes / contrôleurs / services
├── middleware/   # authenticate, validate, upload, rate-limiters, error-handler
├── realtime/     # serveur Socket.IO (authentification, événements, quotas)
├── schemas/      # schémas de validation Zod (source de vérité des entrées)
├── types/        # augmentations de types (Express)
└── utils/        # jwt, password, api-error, async-handler, text

frontend/src/
├── components/   # Alert, AppHeader, AuthLayout, ChatComposer, FormField, MessageBubble, ProtectedRoute
├── context/      # contexte d'authentification (contexte + provider)
├── hooks/        # useAuth, useChatSocket
├── lib/          # api-client, auth-storage, socket-client, validation
├── pages/        # LoginPage, RegisterPage, ChatPage, ProfilePage, DiscoverPage
├── styles/       # feuille de style globale (CSS natif, variables CSS)
└── types.ts      # types partagés avec l'API
```

## Flux de données

Client ↔ API REST (auth, profil, annuaire, historique) + Socket.IO (file d'attente, mise en relation,
messages temps réel, discussion directe).

- `POST /api/auth/register` → création du compte, pseudonyme anonyme généré par le serveur,
  profil facultatif (nom affiché, intérêts, localisation).
- `POST /api/auth/login` → jeton JWT (Bearer).
- `GET /api/users/me` → profil de l'utilisateur authentifié.
- `PUT /api/users/me` → mise à jour du profil.
- `POST /api/users/me/photo` / `DELETE /api/users/me/photo` → photo de profil (stockage local,
  servie sur `/uploads`).
- `GET /api/users` → annuaire filtrable (intérêts, localisation, recherche) et paginé.
- `GET /api/chat/matches/:matchId/messages` → historique, réservé aux participants.
- Socket.IO : `queue:join` / `queue:leave` / `chat:message` / `chat:skip` / `chat:start`
  (client → serveur) ;
  `queue:status` / `match:found` / `match:ended` / `chat:message` / `chat:history` / `chat:error`
  (serveur → client).

Voir `docs/architecture/api.md` pour les contrats détaillés.

## Intégrations externes

- MongoDB (persistance) — instance réelle en production, MongoDB en mémoire possible en développement.
- Vercel (frontend) / Render (backend) — déploiement proposé, non configuré dans ce sprint.
- Service TURN/STUN pour WebRTC (A/V) — à valider, hors périmètre du Sprint 1.

## Stockage des photos de profil

Les photos sont stockées sur le disque du backend (`backend/uploads/photos/`, chemin relatif au
process) et servies en statique sur `/uploads`. Le service `photo-storage.service` isole cet accès :
c'est le point d'extension prévu pour brancher un stockage objet (S3, Cloudinary) sans modifier les
contrôleurs ni l'interface. Le dossier n'est pas versionné (`.gitignore`).

## Gestion des erreurs

- Codes HTTP standards (200, 201, 400, 401, 403, 404, 409, 429, 500) avec messages génériques côté client.
- Format unique : `{ "error": { "code": "...", "message": "...", "details": [...] } }`.
- Middleware `error-handler` centralisé : les erreurs inattendues sont journalisées côté serveur
  (`logger.error`) et retournées sous la forme `{ "error": { "code": "INTERNAL_ERROR", ... } }`.
- Les détails des erreurs de validation Zod sont renvoyés par champ (`details[].field`).

## Authentification / autorisation

- JWT signé avec `JWT_SECRET` (serveur uniquement), transmis en `Authorization: Bearer <token>`.
- La connexion Socket.IO est authentifiée lors de la poignée de main (`handshake.auth.token`) :
  une connexion sans jeton valide est rejetée.
- Rôles : `user`, `moderator`, `admin` (champ `role` du modèle User ; les routes de modération
  appartiennent au Sprint 3).

## Configuration et environnements

Variables via `.env` (jamais commité), chargées et validées par `backend/src/config/env.ts`.
Voir `docs/architecture/.env.example` et `backend/.env.example`.

- `frontend/.env` : `VITE_API_URL` (URL de l'API en production) et `VITE_API_PROXY_TARGET`
  (cible du proxy de développement).

## Décisions techniques validées / à valider

**Validées par l'implémentation des Sprints 1 et 2 :**

| Sujet | Décision | Justification |
|-------|----------|---------------|
| Frontend | React 19 + TypeScript + Vite | Framework interactif Explicitement « conseillé » par le cahier des charges ; Vite pour un build rapide et simple |
| Serveur temps réel | Socket.IO 4 | API événementielle mature, reconnexion automatique, rooms, s'appuie sur WebSocket |
| Authentification | JWT (Bearer) | Sans état, adapté à une API REST + WebSocket ; compatible avec le déploiement séparé frontend/backend |
| Validation | Zod | Schémas partagés entre client et serveur, messages d'erreur par champ |
| Mots de passe | bcrypt (`bcryptjs`) | Algorithme bcrypt demandé par la documentation ; implémentation pure JS, sans compilation native |
| Tests | Vitest + Supertest + socket.io-client + mongodb-memory-server | Exécution rapide, tests d'intégration sur un vrai moteur MongoDB |
| Base de données de développement | MongoDB en mémoire (`mongodb-memory-server`) | Permet de lancer la plateforme sans installer MongoDB ; désactivé en production |
| Photo de profil | Stockage local + `express.static` sur `/uploads` | Aucun service externe à configurer pour le sprint ; le service de stockage est isolé pour permettre un passage ultérieur à un stockage objet |
| Discussion directe | Événement socket `chat:start` | Réutilise la mécanique de session existante (`match:found`, historique) sans nouveau modèle de données |

**À valider :**

- Stockage des médias (audio/vidéo) — hors périmètre du Sprint 1.
- Modération automatisée vs manuelle — Sprint 3.
- Passer Socket.IO à un déploiement multi-instance : la file d'attente est en mémoire, une instance
  unique est donc requise (adaptable avec un adaptateur Redis si le besoin se présente).
