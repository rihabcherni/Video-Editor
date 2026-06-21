# 🎬 Éditeur de Vidéo Web (Video Editor)

Une application web d'édition et de traitement de vidéos, propulsée par **Fastify**, **React** & **Vite**, **Redis & BullMQ** (gestion des tâches en arrière-plan), **FFmpeg** (traitement vidéo), **yt-dlp** (téléchargement depuis YouTube) et **OpenAI Whisper (Faster-Whisper)** (génération automatique de sous-titres).

Ce projet permet de télécharger, découper, éditer et transcrire des vidéos de manière simple et intuitive.

---

## 🚀 Fonctionnalités Principales

*   **Téléchargement de vidéos** : Intégration complète avec `yt-dlp` pour récupérer des vidéos depuis YouTube et d'autres plateformes.
*   **Traitement de vidéos** : Découpage, fusion, extraction de l'audio et ré-encodage de vidéos via `FFmpeg` et `FFprobe`.
*   **Génération de sous-titres** : Transcription automatique de l'audio en fichiers `.srt` avec `faster-whisper` (Python).
*   **Incrustation de sous-titres** : Gravure directe (burn-in) des sous-titres dans la vidéo finale.
*   **Gestion de files d'attente (Queues)** : Traitement asynchrone robuste des tâches d'édition et de transcription avec `BullMQ` et `Redis`.
*   **API Documentée** : Documentation interactive Swagger accessible en local.

---

## 🛠️ Configuration (Fichier `.env`)

Avant de démarrer l'application (que ce soit via Docker ou en manuel), vous devez configurer les variables d'environnement.

1. Copiez le fichier d'exemple à la racine du projet :
   ```bash
   cp .env.example .env
   ```
2. Modifiez le fichier `.env` selon vos besoins. Les variables clés incluent :
   *   `BACKEND_PORT` (par défaut `3005`)
   *   `MAX_UPLOAD_MB` (taille maximale des fichiers téléversés, ex: `500`)
   *   `WHISPER_MODEL_DEFAULT` (modèle whisper : `tiny`, `base`, `small`, etc.)
   *   `WHISPER_PY_BIN` (chemin vers l'exécutable Python pour la transcription)
   *   `YTDLP_COOKIES` (chemin vers le fichier de cookies Netscape pour éviter le blocage YouTube)

---

## 🐳 Option 1 : Installation et Exécution avec Docker (Recommandé)

C'est la méthode la plus simple et rapide car elle installe automatiquement toutes les dépendances système complexes (FFmpeg, yt-dlp, Python, Faster-Whisper, Redis).

### Prérequis
*   [Docker](https://www.docker.com/products/docker-desktop/) installé et démarré sur votre machine.
*   [Docker Compose](https://docs.docker.com/compose/install/) (généralement inclus avec Docker Desktop).

### Étapes de démarrage

1. **Préparer le fichier de cookies yt-dlp** (facultatif mais fortement recommandé pour YouTube) :
   *   Créez un dossier nommé `cookies` à la racine si nécessaire.
   *   Placez votre fichier de cookies au format Netscape sous `cookies/ytdlp_cookies.txt`.
   
2. **Démarrer les conteneurs** :
   Ouvrez un terminal à la racine du projet et lancez :
   ```bash
   docker-compose up --build -d
   ```
   *Cette commande va télécharger les images nécessaires, compiler le frontend (Nginx) et le backend (Node + Python), et lancer Redis.*

3. **Accéder à l'application** :
   *   **Interface Web (Frontend)** : [http://localhost:5175](http://localhost:5175)
   *   **API Swagger (Backend)** : [http://localhost:3005/docs](http://localhost:3005/docs)
   *   **Endpoint de santé API** : [http://localhost:3005/health](http://localhost:3005/health)

4. **Arrêter l'application** :
   ```bash
   docker-compose down
   ```

---

## 💻 Option 2 : Installation et Exécution Manuelle (sans Docker)

L'installation manuelle nécessite d'installer les dépendances système individuellement sur votre machine hôte.

### Prérequis Système
Vous devez installer et configurer les outils suivants dans votre `PATH` :
1.  **Node.js** (v20 ou supérieure recommandée)
2.  **Redis** (doit être démarré en tâche de fond sur le port `6379`)
3.  **FFmpeg & FFprobe** (requis pour le traitement vidéo)
4.  **Python 3** (requis pour la transcription Whisper)
5.  **yt-dlp** (requis pour les téléchargements de vidéos)

---

### Étapes d'installation détaillées

#### Étape 2.1 : Configuration de Redis
Assurez-vous que le serveur Redis est installé et actif :
* Lancez Redis via WSL (`sudo service redis-server start`) ou via l'installateur Windows natif (`redis-server`).


#### Étape 2.2 : Configuration de FFmpeg et yt-dlp
*   **FFmpeg** : Téléchargez FFmpeg et ajoutez le dossier `/bin` à la variable d'environnement `PATH` de votre système.
*   **yt-dlp** : Téléchargez l'exécutable depuis le [dépôt officiel yt-dlp](https://github.com/yt-dlp/yt-dlp) et placez-le dans un dossier faisant partie de votre `PATH`.

#### Étape 2.3 : Configuration de l'environnement virtuel Python (Whisper)
Pour la transcription, le backend utilise un script Python faisant appel à `faster-whisper`.
1. Créez un environnement virtuel Python à la racine du projet ou dans le dossier `backend` :
   *   **Windows (PowerShell)** :
       ```powershell
       python -m venv venv
       .\venv\Scripts\pip install --upgrade pip
       .\venv\Scripts\pip install faster-whisper
       ```
  2. Dans votre fichier `.env`, configurez la variable `WHISPER_PY_BIN` pour pointer vers le binaire python de l'environnement virtuel :
   * `WHISPER_PY_BIN=.\venv\Scripts\python.exe`

---

### Démarrage des Services en local

Ouvrez **deux terminaux distincts** pour démarrer le Backend et le Frontend :

#### 1. Démarrer le Backend (Fastify)
1. Allez dans le dossier backend :
   ```bash
   cd backend
   ```
2. Installez les packages Node.js :
   ```bash
   npm install
   ```
3. Démarrez en mode développement (utilise `nodemon` et `ts-node`) :
   ```bash
   npm run dev
   ```
   *Le serveur démarre sur [http://localhost:3005](http://localhost:3005). Les dossiers `uploads/`, `outputs/`, `temp/`, et `final-outputs/` seront créés automatiquement au démarrage.*

#### 2. Démarrer le Frontend (Vite + React)
1. Allez dans le dossier frontend :
   ```bash
   cd frontend
   ```
2. Installez les packages Node.js :
   ```bash
   npm install
   ```
3. Démarrez le serveur de développement :
   ```bash
   npm run dev
   ```
   *Le frontend sera disponible sur [http://localhost:5173](http://localhost:5173). Les requêtes API seront automatiquement redirigées vers le backend grâce au proxy configuré dans `vite.config.ts`.*

---

## 📂 Structure du Projet

```
Video-editor/
├── backend/                 # Backend Fastify (TypeScript)
│   ├── src/                 # Code source (routes, controlleurs, utils)
│   │   ├── routes/          # Routes API (upload, download, process, subtitles)
│   │   └── utils/           # Fonctions utilitaires (ffmpeg, ytdlp)
│   ├── scripts/             # Scripts utilitaires (transcription Whisper, validation de cookies)
│   ├── fonts/               # Polices d'écriture pour l'incrustation des sous-titres
│   ├── Dockerfile           # Dockerfile du Backend
│   └── tsconfig.json        # Config TypeScript
├── frontend/                # Frontend React + Vite (TypeScript)
│   ├── src/                 # Composants React, hooks et store Zustand
│   ├── public/              # Assets publics
│   ├── Dockerfile           # Dockerfile du Frontend
│   ├── nginx.conf           # Config serveur web Nginx (Docker)
│   └── vite.config.ts       # Configuration Vite avec Proxy backend
├── cookies/                 # Dossier pour les cookies yt-dlp (ex: ytdlp_cookies.txt)
├── docker-compose.yml       # Configuration multi-conteneurs Docker
├── .env.example             # Exemple de variables d'environnement
└── README.md                # Documentation (ce fichier)
```

---

## 🍪 Utilisation des Cookies yt-dlp

Si vous rencontrez des erreurs de type "Sign in to confirm your age" ou de détection de bot lors du téléchargement de vidéos YouTube :
1. Utilisez une extension de navigateur (comme *Get cookies.txt LOCALLY*) pour exporter vos cookies YouTube au format **Netscape**.
2. Nommez le fichier `ytdlp_cookies.txt`.
3. Déposez-le dans le dossier `cookies/` à la racine du projet.
4. Si vous exécutez l'application en manuel, vérifiez que le chemin de votre variable `YTDLP_COOKIES` dans `.env` correspond bien à l'emplacement de ce fichier.
