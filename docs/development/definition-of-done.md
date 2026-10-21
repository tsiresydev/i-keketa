# Definition of Done — Plateforme de Chat

- [x] Fonctionnalité conforme aux critères d'acceptation.
- [x] Tests pertinents passants.
- [x] Pas de régression connue.
- [x] Conventions respectées.
- [x] Vérifications de sécurité appliquées.
- [x] Documentation mise à jour si nécessaire.
- [x] Résumé des changements et limites restantes.

## Détail par critère (Sprint 1)

| Critère | État | Preuve |
|---------|------|--------|
| Inscription : email valide requis, mot de passe requis | Terminé | `backend/tests/auth.routes.test.ts` (6 cas) |
| Connexion : accès avec identifiants valides | Terminé | `backend/tests/auth.routes.test.ts` (4 cas) |
| Chat aléatoire : mise en relation aléatoire fonctionnelle | Terminé | `backend/tests/realtime.test.ts` (9 cas), `scripts/e2e-check.cjs` |
| Messagerie temps réel : messages délivrés en temps réel | Terminé | `backend/tests/realtime.test.ts`, `frontend/tests/chat-page.test.tsx` |

## Détail par critère (Sprint 2)

| Critère | État | Preuve |
|---------|------|--------|
| Profil : nom affiché, intérêts, localisation | Terminé | `backend/tests/user.routes.test.ts`, `frontend/tests/profile-page.test.tsx` |
| Photo de profil (upload / suppression, formats contraints) | Terminé | `backend/tests/user.routes.test.ts` |
| Annuaire : filtres (intérêts, localisation) + pagination | Terminé | `backend/tests/user.routes.test.ts`, `frontend/tests/discover-page.test.tsx` |
| Discussion directe | Terminé | `backend/tests/realtime.test.ts`, `frontend/tests/chat-page.test.tsx` |

## Détail par critère (Sprint 3)

| Critère | État | Preuve |
|---------|------|--------|
| Appel audiovisuel : signalisation et négociation WebRTC | Terminé | `backend/tests/media.realtime.test.ts` (11 cas), `frontend/tests/call-and-report.test.tsx` (8 cas) |
| Appel : refus, raccrochage, coupure micro/caméra | Terminé | `backend/tests/media.realtime.test.ts`, `frontend/tests/call-and-report.test.tsx` |
| Signalement d'abus : motif, descriptif, statut `pending` | Terminé | `backend/tests/report.routes.test.ts` (10 cas), `frontend/tests/call-and-report.test.tsx` (4 cas) |
| Signalement : doublon refusé, tiers refusé, `reportedId` dérivé | Terminé | `backend/tests/report.routes.test.ts` |
| Modération (consultation, traitement, sanction) | **Hors périmètre** | Aucun outil exposé : les signalements restent `pending` |

## Vérifications exécutées (Sprint 3)

| Commande | Résultat |
|----------|----------|
| `npm run lint` | 0 erreur, 0 avertissement |
| `npm run typecheck` | 0 erreur (backend + frontend) |
| `npm run test:backend` | 88 tests / 88 réussis (9 fichiers) |
| `npm run test:frontend` | 50 tests / 50 réussis (6 fichiers) |
| `npm run build` | Build backend (`dist/`) et frontend (`dist/`) réussi |
| `npm run verify` | lint + typecheck + tests + build réussis |
| `node scripts/e2e-check.cjs <url>` | 39/39 vérifications réussies sur serveur démarré (dont 10 sur le Sprint 3) |

## Points non couverts par ce sprint

- Tests de charge / performance (documentés au cahier des charges, non réalisés).
- Audit de sécurité externe, test de pénétration.
- Déploiement Vercel / Render non configuré (variables d'environnement et fichiers de
  configuration de déploiement restent à créer).
- Serveur TURN pour les appels WebRTC : seul STUN est configuré (`VITE_STUN_URLS`), la traversée
  NAT stricte n'est donc pas gérée.
- Modération automatisée vs manuelle : à valider (hors périmètre du Sprint 3).
