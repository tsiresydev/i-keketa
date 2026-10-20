# Base de données — Plateforme de Chat

## Vue d'ensemble

MongoDB (NoSQL) via Mongoose 8. Schéma flexible ; les index et les contraintes d'unicité
sont déclarés dans les modèles (`backend/src/models/`).

En développement, si `MONGODB_URI` est vide et `USE_IN_MEMORY_DB=true`, un MongoDB en mémoire
(`mongodb-memory-server`) est démarré automatiquement : les données sont alors volatiles.

## Entités (collections)

### `users`

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | — | Identifiant |
| `email` | String | unique, lowercase, trim, max 254 | Identifiant de connexion |
| `passwordHash` | String | required, `select: false` | Hash bcrypt (jamais renvoyé par l'API) |
| `pseudonym` | String | unique, trim, max 40 | Pseudonyme anonyme affiché au partenaire |
| `role` | String | enum `user`/`moderator`/`admin`, défaut `user` | Rôle |
| `displayName` | String | trim, max 60 | Sprint 2 — nom choisi par l'utilisateur |
| `interests` | [String] | défaut `[]` | Sprint 2 — centres d'intérêt |
| `photoUrl` | String | trim, max 500 | Sprint 2 — photo de profil |
| `location` | String | trim, max 120 | Sprint 2 — localisation |
| `createdAt` / `updatedAt` | Date | timestamps | Horodatage |

### `messages`

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | — | Identifiant |
| `matchId` | ObjectId | ref `Match`, required, index | Session de chat |
| `senderId` | ObjectId | ref `User`, required, index | Expéditeur |
| `recipientId` | ObjectId | ref `User`, required, index | Destinataire |
| `content` | String | required, trim, max 2000 | Texte du message |
| `createdAt` / `updatedAt` | Date | timestamps | Horodatage |

### `matches` (session de mise en relation)

| Champ | Type | Contraintes | Description |
|-------|------|-------------|-------------|
| `_id` | ObjectId | — | Identifiant |
| `participants` | [ObjectId] | ref `User`, exactement 2 éléments | Les deux participants |
| `status` | String | enum `active`/`ended`, défaut `active`, index | État de la session |
| `endedAt` | Date | — | Date de clôture |
| `endedReason` | String | enum `user_skipped`/`partner_disconnected`/`user_disconnected` | Motif de clôture |
| `createdAt` / `updatedAt` | Date | timestamps | Horodatage |

### `reports` (Sprint 3)

Entité prévue par le modèle logique, non implémentée dans le Sprint 1
(champs attendus : signalé par, signalé, raison, statut).

## Relations

- User 1..* Message (comme expéditeur ou destinataire)
- User 1..* Match (participant, 2 par session)
- User 1..* Report (auteur et cible) — Sprint 3

## Contraintes

- Email unique (index unique, comparaison insensible à la casse via `lowercase` + `trim`).
- Pseudonyme unique, généré par le serveur.
- Mot de passe hashé avec bcrypt (10 tours par défaut, `BCRYPT_SALT_ROUNDS`).
- Validation des champs à l'entrée : schémas Zod côté API + contraintes Mongoose côté modèle.
- Exactement 2 participants par session de chat (validateur de schéma).

## Index

| Collection | Index | Motif |
|------------|-------|-------|
| `users` | `{ email: 1 }` unique | Recherche par email à la connexion |
| `users` | `{ pseudonym: 1 }` unique | Unicité du pseudonyme |
| `users` | `{ interests: 1 }` | Filtres du Sprint 2 |
| `users` | `{ location: 1 }` | Filtres du Sprint 2 |
| `messages` | `{ matchId: 1 }`, `{ senderId: 1 }`, `{ recipientId: 1 }` | Historique et recherches |
| `messages` | `{ matchId: 1, createdAt: 1 }` | Historique trié par date |
| `matches` | `{ participants: 1, status: 1 }` | Sessions actives d'un utilisateur |
| `matches` | `{ status: 1, createdAt: -1 }` | Sessions récentes |

## Migration

Schéma flexible (NoSQL) : pas de migration SQL nécessaire. Les modèles Mongoose créent les index
au démarrage (`autoIndex` actif en développement). En production, appliquer les index explicitement
lors du déploiement si `autoIndex` y est désactivé.

Les champs `displayName`, `interests`, `photoUrl` et `location` sont utilisés depuis le Sprint 2 :
ils sont renseignés via `PUT /api/users/me` (ou à l'inscription) et exposés par l'annuaire
(`GET /api/users`). `photoUrl` pointe vers le fichier stocké localement et servi sur `/uploads`
(le binaire lui-même n'est pas en base).

## Opérations sur les données sensibles

- `passwordHash` est marqué `select: false` : il n'est chargé que lors de la connexion.
- Les projections `toPublicUser` / `toPrivateUser` contrôlent les champs exposés par l'API.
- L'email n'est jamais transmis au partenaire (seul le `pseudonym` l'est).
- `displayName` et `photoUrl` ne sont exposés publiquement que s'ils ont été explicitement
  renseignés par l'utilisateur (anonymat par défaut).
- Les photos sont servies en statique sur `/uploads` : les noms de fichiers sont non devinables
  (identifiant de l'utilisateur + UUID), et le dossier de stockage n'est pas versionné.
