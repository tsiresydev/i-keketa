# Coding Guidelines — Plateforme de Chat

## Conventions

- Nommage camelCase côté JS/TS, PascalCase pour les composants React, kebab-case pour les fichiers.
- Structure frontend/backend séparée (`frontend/`, `backend/`), monorepo npm workspaces.
- TypeScript strict dans les deux paquets (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`).
- Typage/validation des entrées : Zod côté serveur (source de vérité) et côté client
  (mêmes règles, pour un retour immédiat dans le formulaire).
- Gestion des erreurs centralisée : middleware `error-handler` côté serveur, `ApiError` typé,
  format de réponse unique `{ error: { code, message, details? } }`.
- Tests unitaires et d'intégration (Vitest) : tests d'API (Supertest), tests temps réel
  (socket.io-client), tests de composants (Testing Library).
- Formatage/linting : ESLint 9 (flat config) + Prettier.

## Structure des couches

Backend : `routes` (déclaration HTTP) → `controllers` (HTTP) → `services` (règles métier) →
`models` (persistance). Les contrôleurs ne contiennent pas de logique métier.

Frontend : `pages` (écrans) → `components` (UI réutilisable) → `hooks` (état et effets) →
`lib` (accès API, socket, validation, stockage). L'accès réseau ne se fait que dans `lib/`.

## Dépendances

Ne pas introduire de dépendance sans justification. Dépendances actuelles et rôle :

| Dépendance | Rôle |
|------------|------|
| express / cors / helmet / morgan | API REST, CORS restreint, en-têtes de sécurité, journalisation |
| express-rate-limit | Limitation de débit (anti abus, anti bruteforce) |
| mongoose | Persistance MongoDB |
| socket.io | Temps réel |
| jsonwebtoken / bcryptjs | Authentification (JWT) et hachage des mots de passe (bcrypt) |
| zod | Validation des entrées |
| dotenv | Chargement du `.env` |
| react / react-dom / react-router-dom | Interface |
| socket.io-client | Client temps réel |
| vitest / supertest / socket.io-client / mongodb-memory-server / testing-library | Tests |

## Commandes de vérification

```bash
npm run lint        # ESLint (0 erreur attendue)
npm run typecheck   # tsc --noEmit sur les deux paquets
npm test            # tests backend puis frontend
npm run build       # build de production des deux paquets
npm run verify      # enchaînement des quatre commandes
```

Toute modification doit passer ces quatre commandes avant d'être considérée comme terminée.

## Conventions de commit

Le dépôt n'a pas encore d'historique Git : pas de convention de message établie.
Les messages doivent rester concis et au format impératif (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
