# API — Plateforme de Chat

## Vue d'ensemble

API REST + WebSocket (Socket.IO) entre le frontend et le backend.
Préfixe des routes REST : `/api`. Format d'erreur unique :

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Données invalides.",
    "details": [{ "field": "email", "message": "L’adresse email doit être valide." }]
  }
}
```

`details` n'est présent que pour les erreurs de validation.

## Endpoints REST

| Méthode | Route | Auth | Description | Succès |
|---------|-------|------|-------------|--------|
| GET | /health | — | État du service | 200 `{ "status": "ok", "uptime": 12 }` |
| POST | /api/auth/register | — | Inscription (email + mot de passe, profil facultatif) | 201 `{ token, user }` |
| POST | /api/auth/login | — | Connexion (email + mot de passe) | 200 `{ token, user }` |
| GET | /api/users/me | Bearer | Profil de l'utilisateur courant | 200 `{ user }` |
| PUT | /api/users/me | Bearer | Mise à jour du profil (nom, intérêts, localisation) | 200 `{ user }` |
| POST | /api/users/me/photo | Bearer | Envoi d'une photo de profil (`multipart/form-data`, champ `photo`) | 200 `{ user }` |
| DELETE | /api/users/me/photo | Bearer | Suppression de la photo de profil | 200 `{ user }` |
| GET | /api/users | Bearer | Annuaire des utilisateurs (filtres + pagination) | 200 `{ users, total, page, limit, totalPages }` |
| GET | /api/chat/matches/:matchId/messages | Bearer | Historique d'une session de chat | 200 `{ matchId, messages }` |
| POST | /api/reports | Bearer | Signalement d'abus du partenaire de la session | 201 `{ report }` |
| GET | /api/reports/me | Bearer | Signalements émis par l'utilisateur courant | 200 `{ reports }` |
| GET | /uploads/photos/:fichier | — | Photo de profil servie en statique | 200 (image) |

### Objets renvoyés

`user` (privé — propriétaire de la ressource) :

```json
{
  "id": "652f1a...",
  "email": "rakoto@example.mg",
  "pseudonym": "Tsara-4KPQ",
  "role": "user",
  "displayName": "Miora",
  "interests": ["musique"],
  "photoUrl": "/uploads/photos/652f1a-....png",
  "location": "Antananarivo",
  "createdAt": "2026-10-20T10:00:00.000Z"
}
```

`user` (public — annuaire et partenaire) : mêmes champs **sans `email`**.

Le partenaire ne reçoit jamais l'email : il ne voit que le `pseudonym` anonyme. `displayName` et
`photoUrl` n'apparaissent que si l'utilisateur les a explicitement renseignés (anonymat par défaut).

`message` :

```json
{
  "id": "652f1b...",
  "matchId": "652f1c...",
  "senderId": "652f1a...",
  "content": "Salut, ça va ?",
  "createdAt": "2026-10-20T10:01:00.000Z"
}
```

`report` :

```json
{
  "id": "652f1d...",
  "matchId": "652f1c...",
  "reason": "harassment",
  "details": "Insistances déplacées.",
  "status": "pending",
  "reportedPseudonym": "Mety-CD34",
  "createdAt": "2026-10-20T10:05:00.000Z"
}
```

### Mise à jour du profil — `PUT /api/users/me`

Corps JSON (champs facultatifs, seuls ceux fournis sont modifiés) :

```json
{
  "displayName": "Miora",
  "interests": ["musique", "voyage"],
  "location": "Antananarivo"
}
```

| Champ | Règles |
|-------|--------|
| `displayName` | 2 à 60 caractères, chaîne uniquement |
| `interests` | 10 éléments maximum, 30 caractères par élément, dédupliqués sans tenir compte de la casse |
| `location` | 2 à 120 caractères |

Le corps est `strict` : un champ inconnu est refusé (`400`).

### Photo de profil — `POST /api/users/me/photo`

- `multipart/form-data`, un seul fichier dans le champ `photo`.
- Types acceptés : `image/jpeg`, `image/png`, `image/webp`.
- Taille maximale : 2 Mo (`PHOTO_MAX_SIZE_BYTES`).
- Le type MIME **et** la signature binaire du fichier (magic bytes) sont vérifiés : un fichier
  renommé est refusé (`400`).
- La photo précédente est supprimée du stockage lors d'un remplacement.
- Stockage local : `backend/uploads/photos/`, servi sur `/uploads` (hors périmètre de l'API `/api`).
- `DELETE /api/users/me/photo` supprime la photo et le fichier associé.

### Annuaire — `GET /api/users`

| Paramètre | Type | Règles |
|-----------|------|--------|
| `q` | chaîne | ≤ 60 caractères, recherche sur `displayName` et `pseudonym` (insensible à la casse) |
| `interests` | chaîne | Liste séparée par des virgules (10 maximum) ; un utilisateur correspond s'il partage au moins un intérêt |
| `location` | chaîne | ≤ 120 caractères, correspondance partielle (insensible à la casse) |
| `page` | entier | ≥ 1, défaut `1` |
| `limit` | entier | 1 à 50, défaut `20` |

L'utilisateur connecté n'apparaît jamais dans sa propre liste.

```json
{
  "users": [{ "id": "652f1a...", "pseudonym": "Tsara-4KPQ", "displayName": "Miora", "interests": [], "createdAt": "2026-10-20T10:00:00.000Z" }],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### Signalement d'abus — `POST /api/reports`

Corps JSON :

```json
{
  "matchId": "652f1c...",
  "reason": "harassment",
  "details": "Insistances déplacées."
}
```

| Champ | Type | Règles |
|-------|------|--------|
| `matchId` | chaîne | Identifiant de la session de chat (obligatoire) |
| `reason` | énumération | `harassment`, `inappropriate_content`, `nudity`, `spam`, `scam`, `other` |
| `details` | chaîne | Facultatif, 1000 caractères maximum (`REPORT_DETAILS_MAX_LENGTH`) |

Règles :

- L'utilisateur signalé est **toujours l'autre participant** de la session : le client ne peut pas
  désigner une tierce personne (`reportedId` est dérivé côté serveur).
- Seuls les participants actifs d'une session peuvent signaler : sinon `404`.
- Un seul signalement par auteur et par session : un doublon renvoie `409`.
- Le signalement est enregistré avec le statut `pending` : la modération (consultation, traitement,
  sanction) **n'est pas implémentée**, aucun outil de traitement n'est exposé.
- L'utilisateur ne consulte que ses propres signalements (`GET /api/reports/me`, 100 derniers).
- Limitation de débit dédiée : `REPORT_RATE_LIMIT_MAX` signalements par
  `REPORT_RATE_LIMIT_WINDOW_MS` (`429`).

### Règles de validation
- `email` : format email valide, normalisé en minuscules, 254 caractères maximum.
- `password` (inscription) : 8 à 128 caractères, au moins une minuscule, une majuscule et un chiffre.
- `password` (connexion) : non vide (la force n'est pas re-vérifiée à la connexion).
- `matchId` : identifiant MongoDB de la session de chat.
- Corps JSON limité à 32 Ko ; les champs inconnus sont refusés sur les messages.

### Codes HTTP et erreurs

| Code | Signification | Cas |
|------|---------------|-----|
| 200 | Succès | Connexion, profil, historique |
| 201 | Ressource créée | Inscription |
| 400 | Requête invalide | Validation Zod, corps malformé |
| 401 | Non authentifié | Jeton absent, invalide ou expiré, identifiants erronés |
| 403 | Interdit | Accès à l'historique d'une session dont on ne fait pas partie |
| 404 | Introuvable | Route inconnue, session de chat inexistante, session non signalable |
| 409 | Conflit | Email déjà utilisé, signalement déjà envoyé pour cette session |
| 429 | Trop de requêtes | Limitation de débit |
| 500 | Erreur interne | Détails journalisés côté serveur uniquement |

La connexion renvoie toujours le même message (`Identifiants invalides.`) que l'email existe ou non
(anti énumération de comptes). L'inscription renvoie explicitement `409` en cas de doublon.

## WebSocket (Socket.IO)

Connexion : `ws(s)://<hôte>/socket.io` (proxy `/socket.io` configuré côté front).
Authentification obligatoire à la poignée de main :

```js
const socket = io(url, { auth: { token: '<jwt>' });
```

Une connexion sans jeton valide est rejetée (`connect_error`).

### Événements client → serveur

| Événement | Payload | Description |
|-----------|---------|-------------|
| `queue:join` | — | Rejoint la file d'attente de mise en relation |
| `queue:leave` | — | Quitte la file d'attente |
| `chat:skip` | — | Termine la session en cours et rejoint la file d'attente |
| `chat:start` | `{ userId }` | Démarre une discussion directe avec l'utilisateur ciblé |
| `chat:message` | `{ matchId, content }` | Envoie un message texte |
| `media:request` | `{ matchId, audio, video }` | Demande un appel audiovisuel au partenaire |
| `media:accept` | `{ matchId }` | Accepte l'appel entrant |
| `media:offer` | `{ matchId, description }` | Description SDP (offre) |
| `media:answer` | `{ matchId, description }` | Description SDP (réponse) |
| `media:candidate` | `{ matchId, candidate }` | Candidat ICE (sérialisé en JSON) |
| `media:state` | `{ matchId, audio, video }` | État du micro et de la caméra |
| `media:end` | `{ matchId }` | Raccroche l'appel |

### Événements serveur → client

| Événement | Payload | Description |
|-----------|---------|-------------|
| `queue:status` | `{ status: 'idle' \| 'waiting', position? }` | État de la file d'attente |
| `match:found` | `{ matchId, partner: { pseudonym, displayName?, photoUrl? } }` | Mise en relation effectuée (aléatoire ou directe) |
| `match:ended` | `{ matchId, reason }` | Fin de session (`user_skipped`, `partner_disconnected`, `user_disconnected`) |
| `chat:history` | `{ matchId, messages }` | Historique de la session (100 derniers messages) |
| `chat:message` | `{ message }` | Message reçu (émis par l'expéditeur ou le partenaire) |
| `chat:error` | `{ code, message }` | Erreur applicative (`INVALID_MESSAGE`, `NO_ACTIVE_MATCH`, `RATE_LIMITED`, `MESSAGE_FAILED`, `UNAUTHORIZED`, `USER_UNAVAILABLE`, `INVALID_TARGET`, `INVALID_PAYLOAD`, `CALL_ALREADY_ACTIVE`, `CALL_NOT_FOUND`) |
| `media:request` | `{ matchId, audio, video }` | Demande d'appel reçue |
| `media:accepted` | `{ matchId }` | L'appel a été accepté |
| `media:offer` | `{ matchId, description }` | Offre SDP reçue |
| `media:answer` | `{ matchId, description }` | Réponse SDP reçue |
| `media:candidate` | `{ matchId, candidate }` | Candidat ICE reçu |
| `media:state` | `{ matchId, audio, video }` | État micro/caméra du partenaire |
| `media:ended` | `{ matchId, reason }` | Fin de l'appel (`hangup`, `partner_disconnected`, `media_failed`) |

### Règles temps réel

- Un message est accepté uniquement si l'utilisateur a une session active avec le `matchId` fourni.
- Contenu nettoyé (suppression des caractères de contrôle et de direction bidirectionnelle),
  non vide, 2000 caractères maximum.
- Quota d'envoi : 20 messages par fenêtre glissante de 10 secondes par utilisateur
  (`WS_MESSAGE_RATE_MAX`, `WS_MESSAGE_RATE_WINDOW_MS`).
- À la déconnexion d'un client, la session est clôturée (`partner_disconnected`) et le partenaire
  est prévenu.

### Appel audiovisuel — événements `media:*`

Le serveur ne transporte jamais les flux : il ne fait que **relayer** la signalisation entre les
deux participants de la même session de chat. La négociation WebRTC (offre/réponse SDP et
candidats ICE) est entièrement gérée par le navigateur.

Déroulé d'un appel :

1. L'appelant émet `media:request` ; le serveur crée une session d'appel (`pending`) et relaie
   `media:request` au partenaire.
2. Le partenaire émet `media:accept` ; le serveur passe la session d'appel en `active` et relaie
   `media:accepted` à l'appelant.
3. L'appelant crée l'offre SDP et l'envoie (`media:offer`) ; le partenaire répond (`media:answer`).
   Les candidats ICE sont échangés au fur et à mesure (`media:candidate`).
4. `media:state` informe le partenaire de la coupure du micro ou de la caméra.
5. `media:end` (ou la fin de la session de chat) clôture l'appel : le serveur marque la session
   d'appel `ended` et relaie `media:ended`.

Règles :

- Tous les événements `media:*` exigent une session de chat active avec le `matchId` fourni
  (`NO_ACTIVE_MATCH` sinon).
- Un seul appel à la fois par session (`CALL_ALREADY_ACTIVE`).
- Un appel ne peut être accepté que s'il existe une session d'appel en attente (`CALL_NOT_FOUND`).
- Une demande d'appel restée sans réponse est close après 60 secondes (`CALL_REQUEST_TIMEOUT_MS`) :
  les deux participants reçoivent `media:ended` avec le motif `media_failed`.
- L'appel est clôturé automatiquement à la fin de la session de chat, à la déconnexion d'un
  participant ou au changement de partenaire.
- Serveurs ICE : `VITE_STUN_URLS` côté frontend (liste séparée par des virgules), par défaut
  `stun:stun.l.google.com:19302`. Aucun serveur TURN n'est configuré : la connectivité peut donc
  échouer sur des réseaux restrictifs.

### Discussion directe — `chat:start`

Le demandeur émet `chat:start` avec l'identifiant de l'utilisateur ciblé :

```js
socket.emit('chat:start', { userId: '652f1a...' });
```

Règles :

- La cible doit être **connectée** (une session Socket.IO active) : sinon `chat:error`
  avec le code `USER_UNAVAILABLE`.
- La cible ne doit pas être déjà en discussion : sinon `chat:error` avec le code `USER_UNAVAILABLE`.
- Le demandeur ne peut pas cibler son propre compte (`USER_UNAVAILABLE`).
- En cas de succès, les deux participants reçoivent `match:found` avec le même `matchId`, puis
  l'historique de la session via `chat:history` — exactement comme une mise en relation aléatoire.
- Le demandeur quitte sa session précédente et la file d'attente avant la nouvelle session.

## Pagination / filtrage / tri

- L'historique est limité aux 100 derniers messages d'une session.
- L'annuaire des utilisateurs est paginé (`page`, `limit` ≤ 50) et filtrable par intérêts,
  localisation ou recherche textuelle (voir `GET /api/users`).
