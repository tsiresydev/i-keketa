# AI Context — Plateforme de Chat en Ligne pour Madagascar

## Description du projet

Plateforme web responsive de chat en ligne pour utilisateurs de Madagascar, permettant des rencontres et échanges anonymes. Accessible via site web optimisé pour mobiles. Développement en Vibe Coding (Opencode/Kilocode).

## Objectif et périmètre

- **Objectif** : faciliter les rencontres amicales entre utilisateurs de Madagascar, expérience fluide/intuitive, sécurité et confidentialité.
- **Périmètre inclus** : session anonyme sans compte (aucun email ni mot de passe), chat aléatoire,
  messagerie texte temps réel, messagerie audiovisuelle, déploiement Vercel/Render.
- **Périmètre exclu** : inscription/connexion classiques, profil utilisateur et photo, filtres de
  recherche, annuaire des utilisateurs, discussion directe entre deux utilisateurs ciblés (hors file
  d'attente aléatoire).

## Fonctionnalités principales

1. Session anonyme : saisie d'un seul nom affiché (aucun compte, aucun email, aucun mot de passe).
2. Mise en relation aléatoire entre visiteurs.
3. Messagerie texte en temps réel.
4. Messagerie audiovisuelle (chat vidéo/audio) avec appel automatique après la mise en relation.


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
  - Authentification : jeton JWT signé à partir de l'identifiant de session (`sub`) ; aucun mot de passe
  ni bcrypt ; validation : Zod ; tests : Vitest.

## État d'avancement

- Refonte majeure : **sessions anonymes sans inscription/connexion**. Suppression des pages Découvrir et
  Profil, de l'annuaire des utilisateurs et de la discussion directe. Le visiteur saisit uniquement un
  nom affiché et est mis en relation aléatoirement ; l'identifiant technique (pseudonyme) reste interne.
- Sprint 1 (chat aléatoire, messagerie texte) : **implémenté et testé**.
- Sprint 2 (profil, filtres de recherche) : **retiré** (hors périmètre de la refonte).
- Sprint 3 (messagerie audiovisuelle, signalement) : **implémenté et testé**.
  - Signalisation WebRTC pair-à-pair relayée par Socket.IO (événements `media:*`), sessions d'appel
    (`CallSession`) et interface d'appel (`VideoCallPanel`).
  - **Appel vidéo lancé par défaut** : dès la mise en relation, la demande d'appel et l'acceptation
    sont émises automatiquement (le rôle d'appelant reste exclusif) ; le bouton « Lancer le match »
    permet de relancer un appel arrêté.
- Interface responsive et accessible mobile : CSS mobile-first, cibles tactiles ≥ 44 px, safe-area-inset,
  modale plein écran sur mobile.

## Questions encore ouvertes

- Serveur TURN pour les appels WebRTC (réseaux restrictifs) — à valider.
- Mise à l'échelle du temps réel multi-instance (file d'attente en mémoire) — à évaluer si le
  déploiement devient multi-instance.
- Déploiement Vercel / Render : configuration à créer.