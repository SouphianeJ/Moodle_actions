# Design System

Ce document définit la charte graphique et les tokens de design pour l'application Moodle Actions.

## 🎨 Principes de design

- **Simple et moderne** : Interface épurée sans surcharge visuelle
- **Accessible** : Contraste suffisant, composants accessibles au clavier
- **Responsive** : Mobile-first, adaptation à tous les écrans
- **Cohérent** : Utilisation systématique des tokens définis

## 🎨 Couleurs

### Couleurs principales

| Nom | Valeur | Usage |
|-----|--------|-------|
| Primary | `blue-600` (#2563EB) | Actions principales, liens, focus |
| Primary Hover | `blue-700` (#1D4ED8) | Hover sur actions principales |
| Primary Light | `blue-100` (#DBEAFE) | Backgrounds actifs, badges |

### Couleurs neutres

| Nom | Valeur | Usage |
|-----|--------|-------|
| Gray 900 | #111827 | Texte principal |
| Gray 700 | #374151 | Labels, texte secondaire important |
| Gray 600 | #4B5563 | Texte secondaire |
| Gray 500 | #6B7280 | Texte désactivé, helpers |
| Gray 400 | #9CA3AF | Placeholders |
| Gray 300 | #D1D5DB | Bordures |
| Gray 200 | #E5E7EB | Bordures légères |
| Gray 100 | #F3F4F6 | Backgrounds hover |
| Gray 50 | #F9FAFB | Backgrounds page |
| White | #FFFFFF | Cards, modales |

### Couleurs sémantiques

| Nom | Couleur | Usage |
|-----|---------|-------|
| Success | `green-*` | Succès, validation |
| Warning | `yellow-*` | Avertissements |
| Error | `red-*` | Erreurs, destructif |
| Info | `blue-*` | Informations |

## 📐 Espacements

Basés sur Tailwind CSS (multiples de 4px) :

| Token | Valeur | Tailwind |
|-------|--------|----------|
| xs | 4px | `1` |
| sm | 8px | `2` |
| md | 16px | `4` |
| lg | 24px | `6` |
| xl | 32px | `8` |
| 2xl | 48px | `12` |
| 3xl | 64px | `16` |

### Usage

- **Padding cards** : `p-6` (24px)
- **Gap entre éléments** : `gap-4` (16px)
- **Margin entre sections** : `mb-8` (32px)

## 📝 Typographie

### Police

- **Sans-serif** : Geist Sans (variable `--font-geist-sans`)
- **Monospace** : Geist Mono (variable `--font-geist-mono`)

### Tailles

| Nom | Tailwind | Usage |
|-----|----------|-------|
| xs | `text-xs` | Labels, helpers |
| sm | `text-sm` | Texte secondaire, boutons |
| base | `text-base` | Texte courant |
| lg | `text-lg` | Sous-titres, titres cards |
| xl | `text-xl` | Titres secondaires |
| 2xl | `text-2xl` | Titres pages (mobile) |
| 3xl | `text-3xl` | Titres pages (desktop) |

### Graisse

| Nom | Tailwind | Usage |
|-----|----------|-------|
| Normal | `font-normal` | Texte courant |
| Medium | `font-medium` | Labels, boutons |
| Semibold | `font-semibold` | Titres cards |
| Bold | `font-bold` | Titres pages |

## 📦 Bordures et ombres

### Border radius

| Nom | Tailwind | Usage |
|-----|----------|-------|
| sm | `rounded` | Inputs, boutons petits |
| md | `rounded-lg` | Boutons, cards petites |
| lg | `rounded-xl` | Cards |
| full | `rounded-full` | Avatars, badges circulaires |

### Bordures

- **Couleur** : `border-gray-200` ou `border-gray-300`
- **Épaisseur** : `border` (1px)

### Ombres

| Nom | Tailwind | Usage |
|-----|----------|-------|
| sm | `shadow-sm` | Cards, éléments flottants légers |
| md | `shadow-md` | Hover cards, modales |

## 📱 Breakpoints

Suivre les breakpoints Tailwind par défaut :

| Nom | Largeur min | Usage |
|-----|-------------|-------|
| sm | 640px | Mobile paysage |
| md | 768px | Tablette |
| lg | 1024px | Desktop petit |
| xl | 1280px | Desktop |
| 2xl | 1536px | Grand écran |

## 🎯 États des composants

### Focus

```css
focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
```

### Disabled

```css
disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50
```

### Hover

```css
hover:bg-gray-100 /* pour éléments légers */
hover:bg-blue-700 /* pour boutons primary */
```

## 🔄 Transitions

Standard pour tous les composants interactifs :

```css
transition-colors duration-200
```

## 📐 Layout

### Container

- **Max-width** : Adaptatif selon le contexte
  - `sm` : 448px (formulaires)
  - `md` : 672px (contenu texte)
  - `lg` : 896px (pages standard)
  - `xl` : 1152px (dashboards)
- **Padding horizontal** : `px-4 sm:px-6 lg:px-8`

### Page

- **Background** : `bg-gray-50`
- **Padding vertical** : `py-8`

### Header

- **Hauteur** : `h-16` (64px)
- **Background** : `bg-white`
- **Bordure** : `border-b border-gray-200`
