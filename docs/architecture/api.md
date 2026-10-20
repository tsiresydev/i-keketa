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

## Endpoints REST (Sprint 1)

| Méthode | Route | Auth | Description | Succès |
|---------|-------|------|-------------|--------|
| GET | /health | — | État du service | 200 `{ "status": "ok", "uptime": 12 }` |
| POST | /api/auth/register | — | Inscription (email + mot de passe) | 201 `{ token, user }` |
| POST | /api/auth/login | — | Connexion (email + mot de passe) | 200 `{ token, user }` |
| GET | /api/users/me | Bearer | Profil de l'utilisateur courant | 200 `{ user }` |
| GET | /api/chat/matches/:matchId/messages | Bearer | Historique d'une session de chat | 200 `{ matchId, messages }` |

### Objets renvoyés

`user` (privé — propriétaire de la ressource) :

```json
{
  "id": "652f1a...",
  "email": "rakoto@example.mg",
  "pseudonym": "Tsara-4KPQ",
  "role": "user",
  "interests": [],
  "createdAt": "2026-10-20T10:00:00.000Z"
}
```

Le partenaire ne reçoit jamais l'email : il ne voit que le `pseudonym` anonyme.

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
| 404 | Introuvable | Route inconnue, session de chat inexistante |
| 409 | Conflit | Email déjà utilisé |
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
| `chat:message` | `{ matchId, content }` | Envoie un message texte |

### Événements serveur → client

| Événement | Payload | Description |
|-----------|---------|-------------|
| `queue:status` | `{ status: 'idle' \| 'waiting', position? }` | État de la file d'attente |
| `match:found` | `{ matchId, partner: { pseudonym } }` | Mise en relation effectuée |
| `match:ended` | `{ matchId, reason }` | Fin de session (`user_skipped`, `partner_disconnected`, `user_disconnected`) |
| `chat:history` | `{ matchId, messages }` | Historique de la session (100 derniers messages) |
| `chat:message` | `{ message }` | Message reçu (émis par l'expéditeur ou le partenaire) |
| `chat:error` | `{ code, message }` | Erreur applicative (`INVALID_MESSAGE`, `NO_ACTIVE_MATCH`, `RATE_LIMITED`, `MESSAGE_FAILED`, `UNAUTHORIZED`) |

### Règles temps réel

- Un message est accepté uniquement si l'utilisateur a une session active avec le `matchId` fourni.
- Contenu nettoyé (suppression des caractères de contrôle et de direction bidirectionnelle),
  non vide, 2000 caractères maximum.
- Quota d'envoi : 20 messages par fenêtre glissante de 10 secondes par utilisateur
  (`WS_MESSAGE_RATE_MAX`, `WS_MESSAGE_RATE_WINDOW_MS`).
- À la déconnexion d'un client, la session est clôturée (`partner_disconnected`) et le partenaire
  est prévenu.

## Pagination / filtrage / tri

Hors périmètre du Sprint 1. L'historique est limité aux 100 derniers messages d'une session.
Les filtres utilisateurs (intérêts / localisation) arrivent au Sprint 2.
