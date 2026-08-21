# SLAH Academy — Suivi des paiements

Application web privée pour suivre les paiements mensuels des élèves de SLAH Academy (tuteurs privés en Tunisie). HTML/CSS/JS pur, Supabase (auth + base de données), déployée sur Vercel.

## Structure

```
slah-academy/
├── index.html            ← page de connexion
├── app.html              ← application principale (protégée)
├── css/style.css
├── js/
│   ├── auth.js           ← logique Supabase Auth
│   ├── db.js             ← tous les appels base de données
│   ├── compute.js        ← fonctions pures (aucune DB/DOM)
│   ├── render.js         ← rendu DOM
│   └── app.js            ← point d'entrée + navigation
├── config.local.js       ← configuration locale (JAMAIS committée)
├── .env.example
├── vercel.json
└── README.md
```

## Setup

### 1. Cloner le dépôt

```bash
git clone https://github.com/<vous>/slah-academy.git
cd slah-academy
```

### 2. Créer le projet Supabase et les tables

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Ouvrez l'éditeur SQL (SQL Editor) et exécutez les deux scripts suivants.

**Table `students` + RLS :**

```sql
create table students (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  nom_complet text not null,
  contact_parent text,
  niveau text not null,
  classe text not null,
  annee_scolaire text not null default '2024-2025',
  numero integer,
  user_id uuid references auth.users(id) on delete cascade
);

alter table students enable row level security;

create policy "Users can only access their own students"
on students for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

**Table `paiements` + RLS :**

```sql
create table paiements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  student_id uuid references students(id) on delete cascade,
  mois text not null check (mois in ('aout','septembre','octobre','novembre','decembre','janvier','fevrier','mars','avril','mai')),
  statut text not null check (statut in ('paye','impaye','partiel')),
  user_id uuid references auth.users(id) on delete cascade,
  unique(student_id, mois)
);

alter table paiements enable row level security;

create policy "Users can only access their own paiements"
on paiements for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

### 3. Créer le compte enseignant

Dans le tableau de bord Supabase : **Authentication → Users → Add user** et créez le compte email + mot de passe de l'enseignant (un seul compte).

### 4. Configuration locale

Copiez `.env.example` vers `config.local.js` et remplissez avec les vraies valeurs :

```bash
cp .env.example config.local.js
```

Résultat attendu :

```js
const CONFIG = {
  SUPABASE_URL: 'https://votre-projet.supabase.co',
  SUPABASE_ANON_KEY: 'votre-cle-anon'
};
```

`config.local.js` est ignoré par git et ne doit **jamais** être committé (contient les clés réelles).

### 5. Tester en local

Ouvrez `index.html` dans le navigateur (double-clic), ou utilisez l'extension **Live Server** de VS Code. Cliquez avec le bouton droit sur `index.html` → *Open with Live Server*.

Connectez-vous avec le compte enseignant créé à l'étape 3.

### 6. Pousser sur GitHub

```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

Vérifiez que `config.local.js` n'apparaît pas dans le commit (il est dans `.gitignore`).

### 7. Connecter le dépôt à Vercel

1. Allez sur [vercel.com](https://vercel.com) → **Add New Project** → `Import` votre dépôt GitHub.
2. Le framework est détecté automatiquement (aucun build nécessaire).

### 8. Variables d'environnement dans Vercel

Dans les réglages du projet (Settings → Environment Variables), ajoutez :

| Nom | Valeur |
| --- | --- |
| `SUPABASE_URL` | `https://votre-projet.supabase.co` |
| `SUPABASE_ANON_KEY` | `votre-cle-anon` |

Le `buildCommand` dans `vercel.json` génère `config.local.js` automatiquement à partir de ces variables à chaque déploiement.

### 9. Déployer

Vercel déploie automatiquement à chaque push sur `main` (ou cliquez sur **Deploy**).

## Sécurité

- **RLS activé** sur les deux tables : chaque utilisateur ne voit que ses propres données, même avec une clé anon fuitée.
- La clé `anon` n'est **jamais** commitée. `config.local.js`, `.env` et `.env.local` sont dans `.gitignore`.
- Les erreurs Supabase brutes ne sont jamais affichées dans l'interface — elles sont traduites en messages français.
- En cas de session expirée (réponse 401/403), redirection automatique vers `index.html`.

## Utilisation (ajouter vos données)

1. Connectez-vous sur `https://slah-academy.vercel.app` avec l'email/mot de passe de l'enseignant.
2. Dans la barre latérale gauche, cliquez sur un niveau puis une classe, ex. `7ème Primaire → Classe A`.
3. **Ajouter un élève** : bouton `+ Ajouter un élève` en haut à droite → Numéro (automatique), Nom complet, Contact parent → `Ajouter`.
4. **Marquer les paiements** : cliquez sur une cellule du mois (Août → Mai) pour faire défiler les statuts : `·` vide → `✓` payé → `✗` impayé → `~` partiel → retour à vide. Chaque clic est enregistré automatiquement.
5. **Modifier** : double-cliquez sur un nom ou un contact pour le modifier en ligne (Entrée = valider, Échap = annuler).
6. **Supprimer** : survolez une ligne → 🗑️ → confirmez avec `Oui`.
7. **Réordonner** : faites glisser la poignée ↕️ d'une ligne pour changer l'ordre (le numéro est mis à jour).
8. Le **Tableau de bord** montre le total, les retards (2 mois consécutifs impayés) et la liste des élèves en retard — cliquez sur une ligne pour aller à sa classe.

Toutes les données sont enregistrées dans Supabase et restent après rechargement de la page.

## Changement d'année scolaire

Cliquez sur le badge d'année dans la barre latérale (ou la pilule « Année » du tableau de bord) : les saisons déjà présentes dans la base sont proposées, plus les 10 prochaines années. Le choix est mémorisé sur l'appareil ; chaque année garde ses propres élèves et paiements.

## Notes

- Pas de build, pas de React, pas de npm. Tout passe par CDN.
- `config.local.js` doit être present dans le dossier pour le développement local ; il est généré par Vercel en production.