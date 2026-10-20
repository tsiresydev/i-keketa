# Security — Plateforme de Chat

Mesures appliquées dans les Sprints 1 et 2 et vérifiables dans `backend/src/` et `frontend/src/`.

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
- `displayName` et `photoUrl` ne sont transmis au partenaire que si l'utilisateur les a
  explicitement renseignés : sans eux, il n'est identifié que par son pseudonyme.
- L'annuaire `GET /api/users` exclut toujours l'utilisateur connecté de sa propre liste et
  n'expose jamais l'email.

## Photos de profil

- Un seul fichier par requête, limité à 2 Mo (`PHOTO_MAX_SIZE_BYTES`).
- Le type MIME déclaré **et** la signature binaire du fichier (magic bytes JPEG/PNG/WebP) sont
  vérifiés : un fichier renommé ou un script déguisé en image est refusé (`400`).
- Les noms de fichiers sont générés par le serveur (identifiant de l'utilisateur + UUID) : ils ne
  sont pas devinables et ne reprennent jamais le nom d'origine du fichier.
- Le contenu est servi en statique par `express.static` (aucune interprétation) ; le dossier de
  stockage n'est pas versionné.
- Le remplacement d'une photo supprime l'ancienne du disque ; `DELETE /api/users/me/photo` supprime
  la photo et son fichier.
- Limite connue : le stockage local n'est pas durable sur un hébergeur éphémère (Vercel). Le
  service de stockage est isolé pour permettre le branchement d'un stockage objet.

## Discussion directe

- L'événement `chat:start` est authentifié comme le reste de la connexion Socket.IO.
- La cible doit être connectée ; une cible occupée ou absente reçoit l'erreur `USER_UNAVAILABLE`
  (aucune information divulguée sur sa présence exacte).
- Le demandeur ne peut pas cibler son propre compte.

## Dépendances

- Audit de sécurité des dépendances (`npm audit`) : **0 vulnérabilité** au niveau `high`/`critical`
  après mise à jour de Vitest 4.
- Les dépendances de développement (`vitest`, `mongodb-memory-server`) ne sont pas embarquées
  dans le build de production.
