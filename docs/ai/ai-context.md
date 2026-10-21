# AI Context — Plateforme de Chat en Ligne pour Madagascar

## Description du projet

Plateforme web responsive de chat en ligne pour utilisateurs de Madagascar, permettant des rencontres et échanges anonymes. Accessible via site web optimisé pour mobiles. Développement en Vibe Coding (Opencode/Kilocode).

## Objectif et périmètre

- **Objectif** : faciliter les rencontres amicales entre utilisateurs de Madagascar, expérience fluide/intuitive, sécurité et confidentialité.
- **Périmètre inclus** : inscription/connexion, chat aléatoire, messagerie texte temps réel, profil utilisateur, filtres de recherche, messagerie audiovisuelle, signalement d'abus, modération, déploiement Vercel/Render.
- **Périmètre exclu** : non précisé dans le cahier des charges → à valider.

## Fonctionnalités principales

1. Inscription/connexion (email + mot de passe).
2. Mise en relation aléatoire entre utilisateurs.
3. Messagerie texte en temps réel.
4. Profil utilisateur (nom, intérêts, photo).
5. Filtres de recherche (intérêts, localisation).
6. Messagerie audiovisuelle (chat vidéo/audio).
7. Signalement d'abus.


## Stack technique confirmée / à valider

- Frontend : HTML, CSS, JavaScript (React ou Vue.js conseillé) — à valider.
- Backend : Node.js + Express — proposé.
- Base de données : NoSQL MongoDB — proposé.
- Déploiement : Vercel et Render — proposé.

## Organisation générale du projet

Frontend + backend séparés; API REST (proposée) entre les deux; DB MongoDB. Détails à valider selon implémentation choisie.

## Documents de référence

1. `docs/product/cahier-des-charges.md` (source de vérité, lecture seule)
2. `docs/product/prd.md`
3. `docs/architecture/architecture.md`
4. `docs/architecture/api.md`
5. `docs/architecture/database.md`
6. `docs/development/coding-guidelines.md`
7. `docs/development/definition-of-done.md`
8. `docs/development/security.md`

## Contraintes importantes

- Interface responsive (mobiles/tablettes).
- Design simple et attractif (UX).
- Sécurité et confidentialité des utilisateurs.
- Tests fonctionnels, performance et sécurité avant lancement.
- Échéancier : 3 sprints de 4 semaines.

## Décisions validées

- Méthodologie Vibe Coding (Opencode/Kilocode).
- Sprints de 4 semaines (3 sprints).
- Sprint 1 implémenté (voir `docs/architecture/architecture.md`) :
  - Frontend : React 19 + TypeScript + Vite.
  - Backend : Node.js 20 + Express 4 + TypeScript.
  - Temps réel : Socket.IO 4.
  - Base de données : MongoDB + Mongoose 8 (repli MongoDB en mémoire en développement).
  - Authentification : JWT + bcrypt ; validation : Zod ; tests : Vitest.

## État d'avancement

- Sprint 1 (inscription/connexion, chat aléatoire, messagerie texte) : **implémenté et testé**.
- Sprint 2 (profil utilisateur, filtres de recherche) : **implémenté et testé**.
- Sprint 3 (messagerie audiovisuelle, signalement) : **implémenté et testé**.
  - Signalisation WebRTC pair-à-pair relayée par Socket.IO (événements `media:*`), sessions d'appel
    (`CallSession`) et interface d'appel (`VideoCallPanel`).
  - **Appel vidéo lancé par défaut** : dès la mise en relation, la demande d'appel et l'acceptation
    sont émises automatiquement (le rôle d'appelant reste exclusif) ; le bouton « Appeler » permet
    de relancer un appel arrêté.
  - Signalement d'abus (`POST /api/reports`, `GET /api/reports/me`) : l'utilisateur signalé est
    toujours l'autre participant, un signalement par session et par auteur (`409`), statut
    `pending` uniquement.
  - **Modération hors périmètre** : aucun outil de traitement ni sanction ; les signalements sont
    seulement enregistrés.

## Questions encore ouvertes

- Serveur TURN pour les appels WebRTC (réseaux restrictifs) — à valider.
- Mise à l'échelle du temps réel multi-instance (file d'attente en mémoire) — à évaluer si le
  déploiement devient multi-instance.
- Déploiement Vercel / Render : configuration à créer.