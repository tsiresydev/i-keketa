# Déploiement — I-Keketa (plan gratuit)

Déploiement en deux services :

| Composant | Hébergeur | Plan | URL |
|-----------|-----------|------|-----|
| Frontend (React/Vite) | Vercel | Hobby (gratuit) | `https://i-keketa.vercel.app` |
| Backend (Express + Socket.IO) | Render | Free (gratuit) | `https://i-keketa-api.onrender.com` |

Les deux services sont construits automatiquement depuis le dépôt GitHub
`https://github.com/tsiresydev/i-keketa` (branche `main`).

## 1. Backend sur Render (plan gratuit)

### 1.1 Création du service

Le fichier `render.yaml` (racine du dépôt) décrit le service sous forme de **Blueprint** :

- `New` → `Blueprint` → sélectionner `tsiresydev/i-keketa` ;
- Render lit `render.yaml` et propose le service `i-keketa-api` (plan `free`, région `frankfurt`) ;
- les variables `sync: false` sont à renseigner dans le tableau de bord :
  - `MONGODB_URI` : URI du cluster **MongoDB Atlas M0** (gratuit) ;
  - `CORS_ORIGIN` : `https://i-keketa.vercel.app` ;
- `JWT_SECRET` est généré automatiquement par Render ;
- Render installe les dépendances à la racine du monorepo (`npm ci --include=dev`), puis compile
  le workspace `backend` (`npm run build --workspace backend`) et lance `npm start`.
- `--include=dev` est obligatoire : `NODE_ENV=production` fait omettre par npm les
  devDependencies (dont TypeScript), ce qui fait échouer la compilation.

Le service est vérifié via `GET /health` (`healthCheckPath`).

> **Alternative sans Blueprint** : `New` → `Web Service` → brancher le dépôt, puis
> *Root Directory* = `.`, *Build Command* = `npm ci --include=dev && npm run build --workspace backend`,
> *Start Command* = `npm start`, *Health Check Path* = `/health`.

### 1.2 Variables d'environnement

| Variable | Origine | Rôle |
|----------|---------|------|
| `NODE_ENV` | `production` | Active les vérifications de production (JWT_SECRET ≠ `change-me`) |
| `NODE_VERSION` | `20.19.0` | Version Node (compatible `engines` du dépôt) |
| `MONGODB_URI` | **secrét** | URI Atlas M0 (gratuite) |
| `JWT_SECRET` | **généré par Render** | Signature des jetons (≥ 16 caractères) |
| `CORS_ORIGIN` | `https://i-keketa.vercel.app` | Origines autorisées (séparées par des virgules) |
| `USE_IN_MEMORY_DB` | `false` | Ne pas démarrer un MongoDB éphémère en production |
| `PHOTO_STORAGE_DIR` | `uploads/photos` | Dossier de stockage des photos de profil |
| `REPORT_RATE_LIMIT_MAX` | `5` | Fenêtre de limitation des signalements |
| `AUTH_RATE_LIMIT_MAX` | `10` | Anti-brute-force sur `/api/auth/*` |

Les autres variables (`RATE_LIMIT_MAX`, `MESSAGE_MAX_LENGTH`, `WS_MESSAGE_RATE_MAX`, …) sont
documentées dans `backend/.env.example` et `docs/architecture/.env.example`.

### 1.3 Limites connues du plan gratuit

- **Instance éphémère** : le système de fichiers est réinitialisé à chaque redémarrage et à chaque
  mise en veille (15 min d'inactivité). Les **photos de profil** sont donc perdues : le service
  `photoStorage` (`backend/src/modules/users/photo-storage.service.ts`) est le point d'extension
  prévu pour brancher un stockage objet (S3, Cloudinary) ou GridFS (Atlas M0).
- **Cold start** : après une période d'inactivité, la première requête attend la reprise de
  l'instance (environ 30 à 60 s).
- **Redémarrages** : Render redémarre l'instance/service environ une fois par mois.
- **Quota** : 750 heures d'instance par mois, 5 sauvegardes.

## 2. Frontend sur Vercel (plan gratuit)

### 2.1 Configuration du projet

| Réglage | Valeur |
|---------|--------|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version | 20.x |

### 2.2 Variable d'environnement

| Variable | Valeur | Cible |
|----------|--------|-------|
| `VITE_API_URL` | `https://i-keketa-api.onrender.com` | Production, Preview, Development |

`VITE_API_URL` est **lue au moment du build** : toute modification impose un redéploiement
(`vercel --prod` ou un nouveau push sur `main`).

### 2.3 Routage côté client (SPA)

`frontend/vercel.json` ajoute la réécriture

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

indispensable au `BrowserRouter` : les routes `/chat`, `/profil` et `/decouvrir` sont servies par
`index.html` et non par un 404.

> Le fichier `vercel.json` doit se trouver **dans le dossier racine du projet Vercel**
> (`frontend/`) : placé à la racine du monorepo, il est ignoré.

## 3. Commandes utiles

```bash
# Frontend : redéployer après une modification de VITE_API_URL
vercel --prod --yes

# Frontend : voir les journaux de build
vercel inspect <deployment-url> --logs

# Backend : vérifier l'état
curl https://i-keketa-api.onrender.com/health

# Vérification bout-en-bout contre le backend déployé
node scripts/e2e-check.cjs https://i-keketa-api.onrender.com
```

## 4. Premier lancement

1. Créer le cluster **MongoDB Atlas** (M0, gratuit) et un utilisateur de base de données.
2. Autoriser l'accès réseau : `0.0.0.0/0` (Render utilise des IP dynamiques) — restreindre dès
   qu'un service Render possède une IP fixe.
3. Déployer le backend sur Render avec `MONGODB_URI` et `CORS_ORIGIN`.
4. Vérifier `https://i-keketa-api.onrender.com/health` → `{"status":"ok"}`.
5. Déployer le frontend sur Vercel avec `VITE_API_URL`.
6. Tester l'inscription et la mise en relation depuis `https://i-keketa.vercel.app`.

## 5. État du déploiement (21 octobre 2026)

| Élément | Valeur |
|---------|--------|
| Service Render | `i-keketa-api` (`srv-dbc5ko3bc2fs73bcr40g`), plan `free`, région `frankfurt` |
| URL backend | https://i-keketa-api.onrender.com |
| Projet Vercel | `dev-mada1/i-keketa` (`prj_Ist9kvgm4iJ461b8NwFX3aBS8EAg`) |
| URL frontend | https://i-keketa.vercel.app |
| Déploiement Git | Automatique à chaque push sur `main` (Vercel et Render) |
| Vérification E2E | `node scripts/e2e-check.cjs https://i-keketa-api.onrender.com` → 39/39 |

Le `JWT_SECRET` et l'`MONGODB_URI` sont enregistrés dans les variables d'environnement du service
Render (jamais versionnés). Pour les faire tourner, il faut les régénérer depuis le tableau de bord
Render.
