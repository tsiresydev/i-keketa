# Security — Plateforme de Chat

Mesures appliquées dans le Sprint 1 et Vérifiables dans `backend/src/` et `frontend/src/`.

## Secrets

- JWT secret, DB URI uniquement côté serveur, via `.env` (non committé, `.gitignore`).
- `JWT_SECRET` est obligatoire (16 caractères minimum) et doit être modifié en production :
  le serveur refuse de démarrer avec la valeur `change-me` en `NODE_ENV=production`.
- Les variables d'environnement sont validées au démarrage (zod) : une configuration invalide
  arrête le serveur avec un message explicite.
- Aucun secret, mot de passe ou token dans le code versionné (`.env.example` ne contient que
  des valeurs d'exemple).

## Authentification / autorisation

- Auth par email/mot de passe, hash bcrypt (`bcryptjs`, 10 tours) — le hash n'est jamais renvoyé
  (`select: false` + projections `toPublicUser` / `toPrivateUser`).
- Rôles utilisateur/modérateur/admin portés par le modèle `User`.
- JWT signé côté serveur, transmis en `Authorization: Bearer <token>`.
- La connexion Socket.IO est authentifiée à la poignée de main ; sans jeton valide, la connexion
  est rejetée.
- L'historique d'une session de chat n'est accessible qu'à ses deux participants (403 sinon).
- Mot de passe : 8 caractères minimum, avec majuscule, minuscule et chiffre.

## Validation des entrées

- Validation stricte côté serveur avec Zod, avant tout traitement (`middleware/validate`).
- Les schémas zod n'acceptent que des chaînes : les objets (`{ "$ne": null }`) sont rejetés,
  ce qui bloque l'injection d'opérateurs MongoDB.
- Messages : 1 à 2000 caractères, nettoyage des caractères de contrôle et de direction
  bidirectionnelle avant persistance et affichage.
- Corps JSON limité à 32 Ko ; champs inconnus refusés sur les messages temps réel.
- Validation identique côté client (formulaires) pour un retour immédiat, sans jamais se
  substituer à la validation serveur.

## Vulnérabilités

- **XSS** : React échappe le contenu des messages (aucune insertion de HTML brut) ; le contenu
  est nettoyé côté serveur ; `helmet` pose les en-têtes de sécurité (CSP, X-Content-Type-Options…).
- **CSRF** : l'authentification repose sur un jeton JWT stocké côté client (pas de cookie de
  session), donc aucune protection CSRF n'est nécessaire. Si un passage à des cookies est décidé,
  une protection CSRF devra être ajoutée.
- **Injection** : requêtes MongoDB via Mongoose avec types contrôlés ; aucun besoin de
  sérialisation de requêtes utilisateur.
- **CORS** : liste blanche via `CORS_ORIGIN` ; `credentials: false`.
- **Rate limiting** : limite globale sur `/api` (`RATE_LIMIT_MAX`) et limite renforcée sur
  `/api/auth/*` (`AUTH_RATE_LIMIT_MAX`, anti bruteforce). Quota d'envoi temps réel par utilisateur
  (`WS_MESSAGE_RATE_MAX` / `WS_MESSAGE_RATE_WINDOW_MS`).
- **HTTPS en production** : à activer au niveau de l'hébergeur (Vercel / Render) ; non implémenté
  dans l'application.
- **Énumération de comptes** : la connexion renvoie le même message que l'email existe ou non,
  et une comparaison bcrypt factice est exécutée dans ce cas pour égaliser le temps de réponse.
- **Divulgation d'informations** : les erreurs serveur inattendues sont journalisées côté serveur
  et retournées sous la forme `{ code: 'INTERNAL_ERROR' }` ; l'email n'est jamais transmis au
  partenaire (seul le pseudonyme l'est).

## Signalement / modération

- Journalisation serveur des événements sensibles (connexions, mise en relation, erreurs).
- Pas de fuite d'informations sensibles dans les erreurs.
- Le signalement et la modération arrivent au Sprint 3 : le modèle `Report` est prévu mais pas
  encore implémenté.

## Anonymat

- L'email n'est jamais exposé au partenaire.
- Chaque utilisateur reçoit un pseudonyme anonyme généré par le serveur à l'inscription.
- L'historique d'une session n'est visible que par ses deux participants.

## Dépendances

- Audit de sécurité des dépendances (`npm audit`) : **0 vulnérabilité** au niveau `high`/`critical`
  après mise à jour de Vitest 4.
- Les dépendances de développement (`vitest`, `mongodb-memory-server`) ne sont pas embarquées
  dans le build de production.
