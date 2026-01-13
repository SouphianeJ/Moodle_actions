# Documentation Technique : API Moodle - Récupération des Notes d'un Devoir

Ce document décrit le workflow technique et le dataflow pour récupérer les informations des étudiants (nom, prénom, email, note) d'un devoir Moodle via les Web Services Moodle.

## 📋 Vue d'ensemble

### Objectif

À partir d'un **identifiant de devoir (assignment ID)**, récupérer pour chaque étudiant inscrit :
- Nom de famille
- Prénom
- Adresse email
- Note attribuée

### Format d'entrée/sortie

**Entrée** : Un identifiant numérique (`cmid` ou `assignmentId`)

**Sortie** : Une liste d'objets JSON au format :

```json
[
  {
    "nom": "Dupont",
    "prenom": "Jean",
    "email": "jean.dupont@example.com",
    "note": "15.5"
  },
  {
    "nom": "Martin",
    "prenom": "Marie",
    "email": "marie.martin@example.com",
    "note": "18.0"
  }
]
```

---

## 🔧 Prérequis Techniques

### Configuration Moodle

1. **Token Web Service** : Un token d'accès aux Web Services Moodle avec les permissions suivantes :
   - `core_course_get_course_module`
   - `mod_assign_get_submissions`
   - `mod_assign_get_submission_status`
   - `core_user_get_users_by_field`

2. **URL de base Moodle** : L'URL de votre instance Moodle (ex: `https://moodle.example.com`)

### Endpoint Web Service

Toutes les requêtes utilisent le même endpoint REST :

```
{MOODLE_BASE_URL}/webservice/rest/server.php
```

Paramètres obligatoires pour chaque appel :
- `wstoken` : Votre token Web Service
- `wsfunction` : Le nom de la fonction à appeler
- `moodlewsrestformat` : `json` (pour recevoir les réponses en JSON)

---

## 🔄 Workflow en 4 Étapes

### Diagramme de flux

```
┌─────────────────────────────────────────────────────────────────┐
│                          ENTRÉE                                 │
│                     Assignment ID (cmid)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1 : Résolution du module de cours                         │
│ Fonction : core_course_get_course_module                        │
│ But : Obtenir l'ID d'instance du devoir (assignmentId)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2 : Récupération des soumissions                          │
│ Fonction : mod_assign_get_submissions                           │
│ But : Obtenir la liste des étudiants ayant soumis               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3 : Récupération des informations utilisateurs            │
│ Fonction : core_user_get_users_by_field                         │
│ But : Obtenir nom, prénom, email pour chaque étudiant           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4 : Récupération des notes                                │
│ Fonction : mod_assign_get_submission_status                     │
│ But : Obtenir la note de chaque étudiant                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SORTIE                                 │
│              JSON : [{nom, prenom, email, note}, ...]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📡 Détail des Appels API

### Étape 1 : Résolution du module de cours

**Fonction** : `core_course_get_course_module`

**Paramètres de requête** :
| Paramètre | Type | Description |
|-----------|------|-------------|
| `cmid` | entier | L'identifiant du module de cours (visible dans l'URL Moodle) |

**Modèle de réponse** :
```json
{
  "cm": {
    "id": 9267,
    "instance": 1234,
    "modname": "assign",
    "name": "Nom du devoir"
  }
}
```

**Champs à extraire** :
- `cm.instance` : L'ID d'instance du devoir (utilisé dans les étapes suivantes)
- `cm.modname` : Doit être `"assign"` pour confirmer que c'est un devoir

**Validation** : Si `modname` n'est pas `"assign"`, le cmid ne correspond pas à un devoir.

---

### Étape 2 : Récupération des soumissions

**Fonction** : `mod_assign_get_submissions`

**Paramètres de requête** :
| Paramètre | Type | Description |
|-----------|------|-------------|
| `assignmentids[0]` | entier | L'ID d'instance du devoir (obtenu à l'étape 1) |

**Modèle de réponse** :
```json
{
  "assignments": [
    {
      "assignmentid": 1234,
      "submissions": [
        {
          "id": 5001,
          "userid": 101,
          "status": "submitted",
          "gradingstatus": "graded"
        },
        {
          "id": 5002,
          "userid": 102,
          "status": "submitted",
          "gradingstatus": "notgraded"
        }
      ]
    }
  ]
}
```

**Champs à extraire** :
- `assignments[0].submissions` : Liste des soumissions
- Pour chaque soumission, extraire `userid` (identifiant unique de l'étudiant)

**Traitement** : Collecter tous les `userid` uniques pour les étapes suivantes.

---

### Étape 3 : Récupération des informations utilisateurs

**Fonction** : `core_user_get_users_by_field`

**Paramètres de requête** :
| Paramètre | Type | Description |
|-----------|------|-------------|
| `field` | chaîne | `"id"` (recherche par identifiant utilisateur) |
| `values[0]` | entier | Premier ID utilisateur |
| `values[1]` | entier | Deuxième ID utilisateur |
| `values[n]` | entier | n-ième ID utilisateur |

**Note** : Cette API accepte plusieurs valeurs en une seule requête (batch). Il est recommandé de limiter à 50 utilisateurs par requête pour éviter les timeouts.

**Modèle de réponse** :
```json
[
  {
    "id": 101,
    "firstname": "Jean",
    "lastname": "Dupont",
    "email": "jean.dupont@example.com"
  },
  {
    "id": 102,
    "firstname": "Marie",
    "lastname": "Martin",
    "email": "marie.martin@example.com"
  }
]
```

**Champs à extraire** :
- `id` : Identifiant de l'utilisateur (clé de correspondance)
- `firstname` : Prénom
- `lastname` : Nom de famille
- `email` : Adresse email

**Traitement** : Créer une table de correspondance `userid -> {nom, prenom, email}` pour l'assemblage final.

---

### Étape 4 : Récupération des notes

**Fonction** : `mod_assign_get_submission_status`

**Paramètres de requête** :
| Paramètre | Type | Description |
|-----------|------|-------------|
| `assignid` | entier | L'ID d'instance du devoir |
| `userid` | entier | L'ID de l'utilisateur |

**Note** : Cette fonction doit être appelée une fois par étudiant. Prévoir une gestion de la concurrence pour optimiser les performances (ex: max 5 requêtes simultanées).

**Modèle de réponse** :
```json
{
  "feedback": {
    "grade": {
      "grade": "15.50000",
      "gradefordisplay": "15,5 / 20"
    },
    "plugins": [...]
  }
}
```

> **Note** : Le champ `grade` contient la note au format numérique (point décimal), tandis que `gradefordisplay` est formaté selon la locale Moodle (virgule décimale pour le français). Utilisez `grade` pour les calculs et `gradefordisplay` pour l'affichage.

**Champs à extraire** :
- `feedback.grade.grade` : La note brute (format numérique avec décimales)
- `feedback.grade.gradefordisplay` : La note formatée (optionnel, pour affichage)

**Traitement** : Si `feedback` ou `grade` est absent, l'étudiant n'a pas encore été noté.

---

## 📦 Modèles de Données Génériques

### Modèle d'entrée

```
EntréeAssignment {
    cmid: entier       // Identifiant du module de cours
                       // Source: paramètre "id" dans l'URL Moodle
                       // Exemple: https://moodle.example.com/mod/assign/view.php?id=9267
}
```

### Modèle de sortie

```
SortieEtudiant {
    nom: chaîne        // Nom de famille de l'étudiant
    prenom: chaîne     // Prénom de l'étudiant
    email: chaîne      // Adresse email de l'étudiant
    note: chaîne       // Note attribuée (vide si non noté)
}

ResultatExport {
    etudiants: liste de SortieEtudiant
    statistiques: {
        total: entier           // Nombre total d'étudiants
        notes: entier           // Nombre d'étudiants notés
        nonNotes: entier        // Nombre d'étudiants non notés
        erreurs: entier         // Nombre d'erreurs de récupération
    }
}
```

### Modèles intermédiaires

```
ModuleCours {
    id: entier              // cmid
    instance: entier        // ID d'instance du devoir
    modname: chaîne         // Type de module (doit être "assign")
}

Soumission {
    id: entier              // ID de la soumission
    userid: entier          // ID de l'étudiant
    status: chaîne          // Statut de soumission
    gradingstatus: chaîne   // Statut de notation
}

InfoUtilisateur {
    id: entier
    firstname: chaîne
    lastname: chaîne
    email: chaîne
}

StatutSoumission {
    feedback: {
        grade: {
            grade: chaîne
            gradefordisplay: chaîne
        }
    }
}
```

---

## ⚡ Considérations de Performance

### Optimisation des requêtes

1. **Batch des utilisateurs** : L'étape 3 permet de récupérer plusieurs utilisateurs en une seule requête. Grouper les requêtes par lots de 50 utilisateurs maximum.

2. **Concurrence limitée** : L'étape 4 nécessite un appel par étudiant. Limiter à 5 requêtes simultanées pour éviter le throttling Moodle.

3. **Ordre d'exécution** : Exécuter l'étape 3 avant l'étape 4 permet de préparer les informations utilisateurs pendant que les requêtes de notes sont en cours.

### Gestion des timeouts

- Timeout recommandé par requête : 30 secondes
- En cas de timeout, implémenter une logique de retry avec backoff exponentiel

### Cache

Pour les utilisations fréquentes, envisager de mettre en cache :
- Les informations utilisateurs (durée: 1 heure)
- Les correspondances cmid → assignmentId (durée: 24 heures)

---

## 🔐 Sécurité

### Authentification

- Le token Web Service doit être stocké de manière sécurisée (variable d'environnement, vault)
- Ne jamais exposer le token dans les logs ou les réponses d'erreur

### Permissions

Le token doit avoir uniquement les permissions nécessaires :
- Lecture des modules de cours
- Lecture des soumissions
- Lecture des informations utilisateurs
- Lecture des statuts de notation

### Validation des entrées

- Valider que le `cmid` est un entier positif
- Vérifier que le module est bien de type `assign` avant de continuer

---

## 🔍 Gestion des Erreurs

### Erreurs Moodle

Format des erreurs Moodle :
```json
{
  "exception": "webservice_access_exception",
  "errorcode": "accessexception",
  "message": "Description de l'erreur"
}
```

### Cas d'erreur courants

| Code erreur | Cause | Solution |
|-------------|-------|----------|
| `accessexception` | Permissions insuffisantes | Vérifier les capabilities du token |
| `invalidparameter` | Paramètre invalide | Vérifier le format des paramètres |
| `invalidrecord` | ID inexistant | Vérifier que le cmid/assignmentId existe |

### Stratégie de gestion

1. Si l'étape 1 échoue → Arrêter et retourner une erreur
2. Si l'étape 2 échoue → Arrêter et retourner une erreur
3. Si l'étape 3 échoue partiellement → Continuer avec les utilisateurs disponibles
4. Si l'étape 4 échoue pour un étudiant → Retourner un enregistrement avec note vide

---

## 📝 Exemple de Pseudo-code

```
fonction recupererNotesDevoir(cmid):
    // Étape 1: Résolution du module
    moduleInfo = appelerAPI("core_course_get_course_module", {cmid: cmid})
    
    si moduleInfo.erreur:
        retourner Erreur("Module non trouvé")
    
    si moduleInfo.cm.modname != "assign":
        retourner Erreur("Ce module n'est pas un devoir")
    
    assignmentId = moduleInfo.cm.instance
    
    // Étape 2: Récupération des soumissions
    soumissions = appelerAPI("mod_assign_get_submissions", {
        "assignmentids[0]": assignmentId
    })
    
    si soumissions.erreur ou soumissions.assignments est vide:
        retourner Erreur("Impossible de récupérer les soumissions")
    
    listeUserIds = extraireUserIdsUniques(soumissions.assignments[0].submissions)
    
    si listeUserIds est vide:
        retourner ListeVide
    
    // Étape 3: Récupération des infos utilisateurs (en batch)
    tableUtilisateurs = {}
    
    pour chaque batch de 50 dans listeUserIds:
        utilisateurs = appelerAPI("core_user_get_users_by_field", {
            field: "id",
            values: batch
        })
        pour chaque user dans utilisateurs:
            tableUtilisateurs[user.id] = {
                nom: user.lastname,
                prenom: user.firstname,
                email: user.email
            }
    
    // Étape 4: Récupération des notes (avec concurrence limitée)
    resultats = []
    
    pour chaque userId dans listeUserIds (max 5 en parallèle):
        statut = appelerAPI("mod_assign_get_submission_status", {
            assignid: assignmentId,
            userid: userId
        })
        
        infosUser = tableUtilisateurs[userId]
        
        etudiant = {
            nom: infosUser.nom,
            prenom: infosUser.prenom,
            email: infosUser.email,
            note: statut.feedback?.grade?.grade ou ""
        }
        
        resultats.ajouter(etudiant)
    
    retourner resultats
```

---

## 📚 Références

- [Documentation officielle Moodle Web Services](https://docs.moodle.org/dev/Web_services)
- [API mod_assign](https://docs.moodle.org/dev/mod_assign_external)
- [API core_user](https://docs.moodle.org/dev/User_external_functions)
- [API core_course](https://docs.moodle.org/dev/Core_course_external_functions)
