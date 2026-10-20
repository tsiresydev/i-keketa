# PRD — Plateforme de Chat en Ligne pour Madagascar

**Version** : 1.0
**Date** : 2026-10-15
**Statut** : En préparation — fondé sur `docs/product/cahier-des-charges.md`
**Référence** : `docs/product/cahier-des-charges.md`

---

## Présentation du produit

Application web responsive de chat en ligne pour utilisateurs de Madagascar, rencontres et échanges anonymes, optimisée pour mobiles.

## Problème

Faciliter les rencontres amicales et les échanges anonymes entre utilisateurs malgaches via une plateforme simple, sûre et confidentielle.

## Objectifs

- Faciliter les rencontres amicales.
- Expérience utilisateur fluide et intuitive.
- Sécurité et confidentialité des utilisateurs.

## Utilisateurs et rôles

| Rôle | Description |
|------|-------------|
| Utilisateur | S'inscrit, se connecte, discute, gère son profil, signale des abus |
| Administrateur / Modérateur | Modère les discussions, gère les signalements (rôle déduit, à valider) |

## Périmètre fonctionnel

- Sprint 1 : inscription/connexion, chat aléatoire, messagerie texte.
- Sprint 2 : profil utilisateur, filtres de recherche.
- Sprint 3 : messagerie audiovisuelle, signalement d'abus, modération.

## Fonctionnalités détaillées

### Inscription et connexion
- Formulaire d'inscription avec validation de l'email.
- Connexion via email + mot de passe.

### Chat aléatoire
- Mise en relation aléatoire entre utilisateurs.

### Messagerie texte
- Envoi de messages texte en temps réel.

### Profil utilisateur
- Création/modification : nom, intérêts, photo.

### Filtres de recherche
- Filtrer par intérêts ou localisation.

### Messagerie audiovisuelle
- Chat vidéo et audio.

### Signalement d'abus
- Signaler des comportements inappropriés.

### Modération
- Système de modération pour environnement sûr.

## User stories (exemples)

- En tant qu'utilisateur, je peux m'inscrire avec un email validé pour accéder à la plateforme.
- En tant qu'utilisateur, je peux être mis en relation aléatoirement avec un autre utilisateur pour discuter.
- En tant qu'utilisateur, je peux envoyer des messages texte en temps réel.
- En tant qu'utilisateur, je peux modifier mon profil (nom, intérêts, photo).
- En tant qu'utilisateur, je peux filtrer les utilisateurs par intérêts/localisation.
- En tant qu'utilisateur, je peux initier un chat audio/vidéo.
- En tant qu'utilisateur, je peux signaler un comportement inapproprié.

## Critères d'acceptation (à préciser par fonctionnalité)

- Inscription : email valide requis; mot de passe requis.
- Connexion : accès avec identifiants valides.
- Chat aléatoire : mise en relation aléatoire fonctionnelle.
- Messagerie temps réel : messages délivrés en temps réel.
- Profil : modification persistante.
- Filtres : résultats cohérents avec critères.
- Audio/vidéo : fonctionnement du chat A/V.
- Signalement : enregistrement du signalement.
- Modération : outils de modération disponibles.

## Règles métier

- Anonymat des utilisateurs (identité masquée selon besoin) — à préciser.
- Sécurité et confidentialité prioritaires.

## Exigences non fonctionnelles

- Responsive (mobiles/tablettes).
- Sécurité/performance testées avant lancement.

## Dépendances

- Frontend ↔ Backend ↔ MongoDB.
- Déploiement Vercel (frontend) / Render (backend) — proposé.

## Questions restant à valider

- Choix frontend (React/Vue), WebSocket, auth (JWT), stockage média, modération auto vs manuelle.

---

## État d'avancement de l'implémentation

| Sprint | Contenu | État |
|--------|---------|------|
| Sprint 1 | Inscription/connexion, chat aléatoire, messagerie texte temps réel | **Livré** (React + Express + MongoDB + Socket.IO) |
| Sprint 2 | Profil utilisateur, filtres de recherche | Non démarré |
| Sprint 3 | Messagerie audiovisuelle, signalement d'abus, modération | Non démarré |

Le cahier des charges reste la source de vérité. Les choix techniques appliqués au Sprint 1
(React, Socket.IO, JWT, Zod, bcrypt) sont documentés dans `docs/architecture/architecture.md`
et restent ouverts à validation par le responsable de projet.