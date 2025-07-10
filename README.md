# Crunchyroll Toolkit

Un scraper avancé pour récupérer les informations d'animés depuis Crunchyroll, conçu pour contourner les protections anti-bot modernes.

## 🚀 Fonctionnalités

- **Recherche d'animés** : Recherche par titre avec résultats pertinents
- **Détails complets** : Récupération des métadonnées (titre, description, thumbnail)
- **Épisodes** : Extraction des épisodes avec leurs thumbnails
- **Anti-détection** : Contournement intelligent de Cloudflare et des protections anti-bot
- **API hybride** : Utilise les APIs Crunchyroll interceptées pour des données précises

## 📦 Installation

```bash
npm install
npm run build
```

## 🎯 Utilisation

### Import et initialisation

```javascript
const { createCrunchyrollScraper } = require('./lib/index');

const scraper = await createCrunchyrollScraper({
  headless: false,
  timeout: 60000,
  locale: 'fr-FR'
});
```

### Recherche d'un animé

```javascript
const result = await scraper.searchAnime('Apocalypse Bringer Mynoghra');
console.log(result.data); // Array d'animés trouvés
```

### Récupération des détails

```javascript
const animeUrl = 'https://www.crunchyroll.com/series/...';
const details = await scraper.getAnimeDetails(animeUrl);
console.log(details.data); // Détails complets de l'animé
```

### Récupération des épisodes

```javascript
const episodes = await scraper.getEpisodes(animeUrl);
console.log(episodes.data); // Array d'épisodes avec thumbnails
```

## 🧪 Test

Un test complet est fourni pour l'animé "Apocalypse Bringer Mynoghra" :

```bash
node tests/crunchyroll-mynoghra.test.js
```

## 📁 Structure du projet

```
crunchyroll-toolkit/
├── src/
│   ├── scrapers/
│   │   └── crunchyroll.scraper.ts    # Scraper principal
│   ├── types/
│   │   └── anime.types.ts            # Types TypeScript
│   ├── utils/
│   │   ├── browser.utils.ts          # Gestion du navigateur
│   │   └── parser.utils.ts           # Utilitaires de parsing
│   └── index.ts                      # Point d'entrée principal
├── tests/
│   └── crunchyroll-mynoghra.test.js  # Test complet
├── lib/                              # Code compilé (généré)
├── package.json
└── tsconfig.json
```

## 🛠️ Technologies utilisées

- **TypeScript** : Typage statique et développement robuste
- **Playwright** : Navigation automatisée et interaction avec le navigateur
- **Anti-détection** : Techniques avancées pour contourner les protections

## ⚡ Performances

Le scraper utilise une approche hybride qui :
- Intercepte les APIs Crunchyroll en temps réel
- Navigue intelligemment pour contourner Cloudflare
- Génère des données cohérentes en cas d'APIs partielles
- Minimise la détection grâce à des techniques furtives

## 🎯 Cas d'usage testés

- ✅ **Mynoghra** : "Apocalypse Bringer Mynoghra: World Conquest Starts with the Civilization of Ruin"
- ✅ Contournement Cloudflare Turnstile
- ✅ Récupération de thumbnails haute qualité
- ✅ Extraction via APIs interceptées

## 📝 Licence

MIT License - voir le fichier [LICENSE](LICENSE) pour les détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! Merci de :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## ⚠️ Avertissement

Ce projet est à des fins éducatives et de recherche. Respectez les conditions d'utilisation de Crunchyroll et les lois en vigueur. 