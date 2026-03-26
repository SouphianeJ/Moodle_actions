# Moodle Actions

Application web Next.js pour orchestrer les Web Services Moodle et les automatisations.

## 🚀 Fonctionnalités

- **Authentification sécurisée** : Connexion par email avec code OTP (One-Time Password)
- **Protection des routes** : Toutes les pages et API sont protégées par JWT
- **Actions Moodle** : Interface pour exécuter des actions sur Moodle
- **Design moderne** : Interface responsive et accessible

## 📋 Prérequis

- Node.js 18.x ou supérieur
- npm 9.x ou supérieur
- Un compte MongoDB Atlas
- Un compte Gmail/Google Workspace avec mot de passe d'application

## 🛠️ Installation

### 1. Cloner le repository

```bash
git clone <repository-url>
cd moodle-actions
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

Copier le fichier d'exemple et configurer les valeurs :

```bash
cp .env.example .env.local
```

Éditer `.env.local` avec vos valeurs :

```env
# MongoDB Connection
MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/moodle_actions?retryWrites=true&w=majority"
MONGODB_DBNAME="moodle_actions"

# Moodle Configuration
MOODLE_BASE_URL="https://your-moodle.example.com"
MOODLE_WS_TOKEN="your_moodle_webservice_token"

# Authentication
AUTH_ALLOWED_EMAILS="admin@example.com,user@example.com"
JWT_SECRET="your_very_long_random_secret_key_at_least_32_characters"

# SMTP Configuration (Gmail/Google Workspace)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your_google_app_password"
SMTP_FROM="Moodle Actions <your-email@gmail.com>"
```

#### Configuration Gmail

Pour utiliser Gmail comme serveur SMTP :

1. Activer la validation en deux étapes sur votre compte Google
2. Créer un mot de passe d'application : [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Utiliser ce mot de passe comme `SMTP_PASS`

### 4. Lancer en développement

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 🏗️ Structure du projet

```
├── app/                          # App Router (Next.js)
│   ├── api/                      # API Routes
│   │   └── auth/                 # Routes d'authentification
│   │       ├── request-otp/      # Demande de code OTP
│   │       ├── verify-otp/       # Vérification du code
│   │       └── logout/           # Déconnexion
│   ├── login/                    # Page de connexion
│   └── actions/                  # Pages des actions
│       └── assignment-feedback/  # Feature #1
├── components/                   # Composants React
│   ├── ui/                       # Composants UI réutilisables
│   └── layout/                   # Composants de layout
├── lib/                          # Utilitaires serveur
│   ├── auth/                     # JWT, OTP, protection
│   ├── db/                       # Connexion MongoDB
│   ├── email/                    # Envoi d'emails
│   └── moodle/                   # Client Moodle WS
├── docs/                         # Documentation
├── middleware.ts                 # Protection des routes
└── .env.example                  # Variables d'environnement
```

## 🔐 Sécurité

### Authentification

1. L'utilisateur entre son email sur `/login`
2. Si l'email est dans `AUTH_ALLOWED_EMAILS`, un code OTP à 6 chiffres est généré
3. Le code est hashé (SHA-256) et stocké en base avec une expiration de 10 minutes
4. L'utilisateur reçoit le code par email
5. Après vérification, un JWT est créé et stocké dans un cookie httpOnly

### Protection des routes

- Le middleware Next.js vérifie le JWT pour toutes les routes
- Les routes publiques : `/login`, `/api/auth/request-otp`, `/api/auth/verify-otp`
- Les API retournent 401 si non authentifié
- Les pages redirigent vers `/login`

### Mesures de sécurité

- ✅ OTP hashé en base de données
- ✅ TTL sur les OTP (expiration automatique MongoDB)
- ✅ Limite de tentatives (5 max)
- ✅ Rate limiting par email (5 demandes / 15 minutes)
- ✅ Cookie httpOnly, Secure (prod), SameSite=Lax
- ✅ JWT signé avec secret fort
- ✅ Pas de divulgation d'informations sur les emails autorisés

## 🚀 Déploiement sur Vercel

### 1. Importer le projet

1. Connectez-vous sur [vercel.com](https://vercel.com)
2. Cliquez sur "Add New Project"
3. Importez votre repository Git

### 2. Configurer les variables d'environnement

Dans les paramètres du projet Vercel, ajoutez toutes les variables de `.env.example` avec vos valeurs de production.

**Important** : Utilisez un `JWT_SECRET` différent de celui de développement.

`MONGODB_DBNAME` est optionnel. S'il est défini, l'application l'utilise explicitement ; sinon MongoDB utilise la base portée par `MONGODB_URI`.

### 3. Déployer

Le déploiement est automatique à chaque push sur la branche principale.

### Configuration MongoDB Atlas

Assurez-vous d'autoriser les IP de Vercel dans la liste blanche MongoDB Atlas :
- Vous pouvez autoriser toutes les IP (`0.0.0.0/0`) pour les fonctions serverless
- Ou configurer les IP Vercel spécifiques (voir la documentation Vercel)

## 📖 Documentation

- [Design System](./docs/design-system.md) - Charte graphique et tokens
- [Composants UI](./docs/components.md) - Catalogue des composants
- [API Moodle - Notes de devoir](./docs/moodle-assignment-grades-api.md) - Documentation technique pour intégrer la récupération des notes d'un devoir Moodle dans une application externe

## 🎯 Actions Disponibles

### Récupérer les feedback d'un devoir

Cette action permet d'exporter les feedbacks des étudiants pour un devoir Moodle au format CSV.

**Page UI** : `/actions/assignment-feedback`

**Entrée utilisateur** : L'identifiant de l'évaluation (cmid)
- C'est le paramètre `id` visible dans l'URL Moodle de la page du devoir
- Exemple : dans `https://moodle.example.com/mod/assign/view.php?id=9267`, le cmid est `9267`

**Sortie** : Un fichier CSV avec les colonnes :
- `Nom` : Nom de famille de l'étudiant
- `Prenom` : Prénom de l'étudiant
- `Note` : Note attribuée (vide si non noté)
- `Feedback` : Commentaire texte du feedback (HTML converti en texte brut)

**Caractéristiques du CSV** :
- Délimiteur : point-virgule (`;`)
- Encodage : UTF-8 avec BOM (pour compatibilité Excel)
- Les valeurs contenant des caractères spéciaux sont correctement échappées

**Endpoint API** : `GET /api/actions/assignment-feedback/export?cmid=<cmid>`
- Authentification JWT requise
- Retourne directement le fichier CSV en téléchargement

**Workflow technique** :
1. Résolution du cmid vers l'ID d'instance du devoir (`core_course_get_course_module`)
2. Récupération des soumissions (`mod_assign_get_submissions`)
3. Récupération des informations utilisateurs en batch (`core_user_get_users_by_field`)
4. Récupération du statut de soumission pour chaque étudiant (`mod_assign_get_submission_status`)
5. Génération du CSV

**Limites** :
- Le cmid doit correspondre à un module de type "assign" (devoir)
- Les appels Moodle sont limités en concurrence (5 simultanés) pour éviter le throttling
- Les fichiers attachés aux feedbacks ne sont pas inclus (texte uniquement)

## 🛤️ Roadmap

- [x] Authentification OTP par email
- [x] Protection JWT des routes
- [x] Page "Récupérer les feedback d'un devoir" (UI)
- [x] Intégration API Moodle pour les feedbacks
- [ ] Nouvelles actions Moodle
- [ ] Automatisations planifiées

## 📝 License

MIT
