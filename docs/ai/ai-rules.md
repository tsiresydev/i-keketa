# AI Rules — Plateforme de Chat

## Règles communes

- Lire les documents pertinents avant toute tâche.
- Respecter le cahier des charges (`docs/product/cahier-des-charges.md`) — lecture seule.
- Respecter les décisions techniques validées (aucune non validée ne doit être présentée comme telle).
- Ne pas inventer de règles métier ni modifier le périmètre fonctionnel sans validation.
- Préserver les fonctionnalités existantes.
- Respecter les conventions de code de la stack retenue.
- Éviter les duplications et dépendances injustifiées.
- Respecter les règles de sécurité.
- Identifier les hypothèses et points bloquants.
- Vérifier les modifications avant de terminer une tâche.
- Mettre à jour la documentation concernée lorsque nécessaire.
- Signaler toute ambiguïté/contradiction du cahier des charges au lieu de la résoudre silencieusement.

## Règles spécifiques au projet

- Le périmètre de travail est celui du sprint courant ; les fonctions des sprints suivants ne sont
  pas développées en amont (Sprint 1 : inscription/connexion, chat aléatoire, messagerie texte).
- La validation des entrées est définie côté serveur (zod) ; la validation client est un miroir
  de la validation serveur, jamais un remplacement.
- L'email et le hash de mot de passe ne sont jamais exposés par l'API ; le partenaire ne voit que
  le pseudonyme anonyme.
- Toute nouvelle dépendance doit être justifiée dans `docs/development/coding-guidelines.md`.
- Toute fonctionnalité livrée doit être couverte par des tests et les quatre commandes de
  vérification (`lint`, `typecheck`, `test`, `build`) doivent passer.
- Les secrets restent dans les fichiers `.env` (non commités) ; seul `.env.example` est versionné.