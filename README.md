# Chloé · Price Consistency Check

Application de vérification de cohérence des prix entre SAP et SFCC (Salesforce Commerce Cloud).

## Stack

- React 18 + Vite
- CSS Modules
- xlsx (parsing Excel + export)
- Zéro backend — 100% client-side

---

## Installation locale

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer en développement
npm run dev

# 3. Build production
npm run build
```

---

## Déploiement sur Vercel

### Option A — Via Vercel CLI (recommandé)

```bash
npm install -g vercel
vercel login
vercel
```

Vercel détecte automatiquement Vite. Accepter les paramètres par défaut.

### Option B — Via GitHub

1. Pousser ce repo sur GitHub
2. Aller sur [vercel.com](https://vercel.com) → New Project
3. Importer le repo GitHub
4. Framework Preset : **Vite** (auto-détecté)
5. Build Command : `npm run build`
6. Output Directory : `dist`
7. Cliquer Deploy

---

## Structure des fichiers

```
src/
├── main.jsx              # Entry point React
├── PriceChecker.jsx      # Composant principal
├── PriceChecker.module.css  # Styles (CSS Modules)
└── utils.js              # Parsers SAP/SFCC + logique de check + export
```

---

## Format des fichiers attendus

### SAP (.xlsx)
| Col A    | Col B      | Col C             | Col D          |
|----------|------------|-------------------|----------------|
| SAP SKU  | Generic ID | SAP Prix Generic  | SAP Prix SKU   |

### SFCC (.xml)
Pricebook Demandware standard :
```xml
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
  <pricebook>
    <price-tables>
      <price-table product-id="CH24AHT84004">
        <amount quantity="1">1890.00</amount>
      </price-table>
    </price-tables>
  </pricebook>
</pricebooks>
```

---

## Logique de check

**Check 1 — Couverture** : le produit SAP a-t-il un prix dans SFCC (niveau SKU ou Generic) ?

**Check 2 — Alignement** : prix alignés si l'une des 4 combinaisons matche :
- SFCC@SKU = SAP Prix SKU
- SFCC@SKU = SAP Prix Generic *(cross-level)*
- SFCC@Generic = SAP Prix SKU *(cross-level)*
- SFCC@Generic = SAP Prix Generic

La colonne **Match** indique quelle combinaison a été utilisée.
