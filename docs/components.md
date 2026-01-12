# Catalogue des Composants UI

Ce document présente tous les composants UI réutilisables de l'application.

## 📦 Import

Tous les composants sont exportés depuis `@/components/ui` :

```tsx
import { Button, Input, Card, Container, PageHeader, Alert, FormRow } from '@/components/ui';
```

---

## Button

Bouton d'action avec plusieurs variantes et états.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'ghost'` | `'primary'` | Style du bouton |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Taille du bouton |
| `loading` | `boolean` | `false` | Affiche un spinner et désactive le bouton |
| `disabled` | `boolean` | `false` | Désactive le bouton |
| `...props` | `ButtonHTMLAttributes` | - | Props HTML standard |

### Exemples

```tsx
// Bouton primaire
<Button>Continuer</Button>

// Bouton secondaire
<Button variant="secondary">Annuler</Button>

// Bouton ghost
<Button variant="ghost">Retour</Button>

// Avec état loading
<Button loading>Chargement...</Button>

// Tailles
<Button size="sm">Petit</Button>
<Button size="md">Moyen</Button>
<Button size="lg">Grand</Button>

// Pleine largeur
<Button className="w-full">Soumettre</Button>
```

---

## Input

Champ de saisie avec label et messages d'aide.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Label au-dessus du champ |
| `helper` | `string` | - | Texte d'aide sous le champ |
| `error` | `string` | - | Message d'erreur (rouge) |
| `...props` | `InputHTMLAttributes` | - | Props HTML standard |

### Exemples

```tsx
// Input basique
<Input placeholder="Entrez une valeur" />

// Avec label
<Input label="Email" type="email" placeholder="votre@email.com" />

// Avec helper
<Input 
  label="ID de l'évaluation"
  placeholder="12345"
  helper="L'identifiant se trouve dans l'URL"
/>

// Avec erreur
<Input 
  label="Email"
  value={email}
  error="Adresse email invalide"
/>

// Désactivé
<Input label="Champ verrouillé" disabled value="Non modifiable" />
```

---

## Card

Conteneur avec fond blanc, bordure et ombre légère.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `padding` | `'none' \| 'sm' \| 'md' \| 'lg'` | `'md'` | Espacement interne |
| `...props` | `HTMLAttributes<HTMLDivElement>` | - | Props HTML standard |

### Exemples

```tsx
// Card basique
<Card>
  <h3>Titre</h3>
  <p>Contenu de la card</p>
</Card>

// Sans padding (pour images, listes)
<Card padding="none">
  <img src="/image.jpg" alt="" />
</Card>

// Comme lien cliquable
<Link href="/page">
  <Card className="hover:border-blue-300 cursor-pointer">
    <h3>Action cliquable</h3>
  </Card>
</Link>
```

---

## Container

Conteneur centré avec max-width responsive.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'lg'` | Largeur maximale |
| `...props` | `HTMLAttributes<HTMLDivElement>` | - | Props HTML standard |

### Exemples

```tsx
// Container standard
<Container>
  <h1>Titre de page</h1>
</Container>

// Container étroit (formulaires)
<Container size="sm">
  <form>...</form>
</Container>

// Container large (dashboard)
<Container size="xl">
  <div className="grid grid-cols-3 gap-4">...</div>
</Container>
```

---

## PageHeader

En-tête de page avec titre et description optionnelle.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | **required** | Titre principal |
| `description` | `string` | - | Description sous le titre |
| `children` | `ReactNode` | - | Actions à droite (boutons) |
| `...props` | `HTMLAttributes<HTMLDivElement>` | - | Props HTML standard |

### Exemples

```tsx
// Header simple
<PageHeader title="Actions" />

// Avec description
<PageHeader 
  title="Récupérer les feedback"
  description="Saisissez l'identifiant de l'évaluation"
/>

// Avec action
<PageHeader title="Utilisateurs">
  <Button>Ajouter</Button>
</PageHeader>
```

---

## Alert

Message d'alerte avec icône et style selon la variante.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Type d'alerte |
| `title` | `string` | - | Titre optionnel en gras |
| `children` | `ReactNode` | **required** | Message de l'alerte |
| `...props` | `HTMLAttributes<HTMLDivElement>` | - | Props HTML standard |

### Exemples

```tsx
// Information
<Alert variant="info">
  Fonctionnalité en développement.
</Alert>

// Succès
<Alert variant="success" title="Succès !">
  L'opération a été effectuée.
</Alert>

// Avertissement
<Alert variant="warning">
  Cette action est irréversible.
</Alert>

// Erreur
<Alert variant="error">
  Une erreur est survenue. Veuillez réessayer.
</Alert>
```

---

## FormRow

Conteneur pour aligner label et champ de formulaire.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | - | Label du champ |
| `htmlFor` | `string` | - | ID du champ associé |
| `children` | `ReactNode` | **required** | Champ(s) de formulaire |

### Exemples

```tsx
// Usage basique
<FormRow label="Email" htmlFor="email">
  <input id="email" type="email" className="..." />
</FormRow>

// Avec Input component
<FormRow>
  <Input label="Nom" />
</FormRow>
```

---

## Composants de Layout

### AppShell

Layout principal de l'application avec header, navigation et zone de contenu.

```tsx
import { AppShell } from '@/components/layout';

export default function MyPage() {
  return (
    <AppShell>
      <PageHeader title="Ma page" />
      <Card>Contenu...</Card>
    </AppShell>
  );
}
```

### Nav

Barre de navigation horizontale (utilisée dans AppShell).

```tsx
import { Nav } from '@/components/layout';

// Généralement utilisé dans AppShell
<Nav />
```

---

## Bonnes pratiques

### Composition

Combinez les composants pour créer des interfaces cohérentes :

```tsx
<AppShell>
  <PageHeader 
    title="Nouvelle action"
    description="Configurez les paramètres"
  />
  
  <Card className="max-w-xl">
    <form>
      <Input 
        label="Nom de l'action"
        required
      />
      <Input 
        label="Description"
        helper="Décrivez brièvement l'action"
      />
      <Button type="submit" className="mt-4">
        Créer
      </Button>
    </form>
  </Card>
</AppShell>
```

### Responsive

Les composants sont mobile-first. Utilisez les classes Tailwind pour ajuster :

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <Card>Item 1</Card>
  <Card>Item 2</Card>
  <Card>Item 3</Card>
</div>
```

### Accessibilité

- Tous les composants supportent les attributs ARIA
- Les inputs ont des labels associés automatiquement
- Les focus states sont visibles
- Les couleurs respectent les ratios de contraste WCAG
