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
| POST | /api/auth/session | — | Ouvre une session anonyme à partir du seul nom affiché | 201 `{ token, user }` |
| GET | /api/auth/session | Bearer | Session courante | 200 `{ user }` |
| GET | /api/chat/matches/:matchId/messages | Bearer | Historique d'une session de chat | 200 `{ matchId, messages }` |
| POST | /api/reports | Bearer | Signalement d'abus du partenaire de la session | 201 `{ report }` |
| GET | /api/reports/me | Bearer | Signalements émis par l'utilisateur courant | 200 `{ reports }` |

### Objets renvoyés

`user` (session courante) :

```json
{
  "id": "652f1a...",
  "displayName": "Miora",
  "role": "user",
  "createdAt": "2026-10-20T10:00:00.000Z"
}
```

Le pseudonyme technique anonyme (`pseudonym`) n'est **jamais** exposé : il reste interne au serveur
(journalisation, signalements). Le partenaire ne voit que le `displayName` choisi par le visiteur.

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
  "reportedDisplayName": "Mety-CD34",
  "createdAt": "2026-10-20T10:05:00.000Z"
}
```

### Ouverture de session — `POST /api/auth/session`

Corps JSON :

```json
{
  "displayName": "Miora"
}
```

| Champ | Règles |
|-------|--------|
| `displayName` | 2 à 40 caractères, chaîne uniquement (obligatoire) |

Le corps est `strict` : un champ inconnu est refusé (`400`), et la protection contre l'injection
NoSQL s'applique (opérateurs mongo injectés refusés).

Réponse `201` :

```json
{
  "token": "<jwt>",
  "user": { "id": "652f1a...", "displayName": "Miora", "role": "user", "createdAt": "2026-10-20T10:00:00.000Z" }
}
```

### Session courante — `GET /api/auth/session`

Retourne la session associée au jeton Bearer (`200 { user }`), ou `401` si le jeton est absent,
invalide ou expiré.

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
- `displayName` (session) : 2 à 40 caractères, chaîne uniquement.
- `matchId` : identifiant MongoDB de la session de chat.
- Corps JSON limité à 32 Ko ; les champs inconnus sont refusés sur les messages et sur
  `/api/auth/session`.

### Codes HTTP et erreurs

| Code | Signification | Cas |
|------|---------------|-----|
| 200 | Succès | Session courante, historique, signalements |
| 201 | Ressource créée | Ouverture de session, signalement |
| 400 | Requête invalide | Validation Zod, corps malformé |
| 401 | Non authentifié | Jeton absent, invalide ou expiré |
| 403 | Interdit | Accès à l'historique d'une session dont on ne fait pas partie |
| 404 | Introuvable | Route inconnue, session de chat inexistante, session non signalable |
| 409 | Conflit | Signalement déjà envoyé pour cette session |
| 429 | Trop de requêtes | Limitation de débit |
| 500 | Erreur interne | Détails journalisés côté serveur uniquement |

La limitation de débit s'applique à l'ouverture de session (`authLimiter`) et aux signalements
(`reportLimiter`).

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
| `match:found` | `{ matchId, partner: { displayName } }` | Mise en relation effectuée (aléatoire uniquement) |
| `match:ended` | `{ matchId, reason }` | Fin de session (`user_skipped`, `partner_disconnected`, `user_disconnected`) |
| `chat:history` | `{ matchId, messages }` | Historique de la session (100 derniers messages) |
| `chat:message` | `{ message }` | Message reçu (émis par l'expéditeur ou le partenaire) |
| `chat:error` | `{ code, message }` | Erreur applicative (`INVALID_MESSAGE`, `NO_ACTIVE_MATCH`, `RATE_LIMITED`, `MESSAGE_FAILED`, `UNAUTHORIZED`, `INVALID_PAYLOAD`, `CALL_ALREADY_ACTIVE`, `CALL_NOT_FOUND`) |
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

Lancement automatique :

- Dès la mise en relation (`match:found`), le client frontend demande l'accès à la caméra et au
  micro puis émet `media:request` sans action de l'utilisateur ; le bouton « Lancer le match » reste
  disponible pour relancer un appel arrêté.
- L'appel entrant est accepté automatiquement (`media:accept`) : la demande concurrente émise par
  le partenaire est alors rejetée par le serveur (`CALL_ALREADY_ACTIVE`) et cette erreur est
  ignorée côté client.
- Le rôle d'appelant est exclusif : seul celui dont la demande a été acceptée par le serveur
  émet l'offre SDP.

Règles :

- Tous les événements `media:*` exigent une session de chat active avec le `matchId` fourni
  (`NO_ACTIVE_MATCH` sinon).
- Un seul appel à la fois par session (`CALL_ALREADY_ACTIVE`).
- Un appel ne peut être accepté que s'il existe une session d'appel en attente (`CALL_NOT_FOUND`).
- Une demande d'appel restée sans réponse est close après 60 secondes (`CALL_REQUEST_TIMEOUT_MS`) :
  les deux participants reçoivent `media:ended` avec le motif `media_failed`.
- Côté client, la négociation doit aboutir dans les 30 secondes, sinon l'appel est clos et un
  message d'erreur invite à réessayer.
- L'appel est clôturé automatiquement à la fin de la session de chat, à la déconnexion d'un
  participant ou au changement de partenaire.
- Serveurs ICE : `VITE_STUN_URLS` côté frontend (liste séparée par des virgules), par défaut
  `stun:stun.l.google.com:19302`. Aucun serveur TURN n'est configuré : la connectivité peut donc
  échouer sur des réseaux restrictifs.

### Discussion directe — `chat:start`

Supprimée dans la refonte : aucune discussion directe ciblée n'est proposée. La mise en relation se
fait uniquement via la file d'attente aléatoire (`queue:join`). Le serveur ignore l'événement
`chat:start` s'il est émis.

## Pagination / filtrage / tri

- L'historique est limité aux 100 derniers messages d'une session.
