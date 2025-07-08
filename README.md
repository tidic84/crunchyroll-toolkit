# Crunchyroll Scraper 🎌

Un package Node.js puissant pour scraper les informations d'animés et les thumbnails d'épisodes depuis Crunchyroll avec des techniques avancées anti-détection **2024/2025**.

## 🚀 Installation

```bash
npm install crunchyroll-scraper
```

ou avec Yarn :

```bash
yarn add crunchyroll-scraper
```

## ⚠️ Protections Anti-Bot et Solutions

**Crunchyroll utilise des protections Cloudflare très strictes.** Ce package propose **4 types de scrapers** :

1. **🚀 Scraper Avancé** (`createCrunchyrollScraper`) : **NOUVEAU !** Techniques 2024/2025 pour contourner Cloudflare
2. **🛡️ Scraper Robuste** (`createRobustCrunchyrollScraper`) : Anti-détection avec mode headless
3. **📜 Scraper Legacy** (`createLegacyCrunchyrollScraper`) : Version basique pour tests
4. **🎭 Scraper Demo** (`createDemoCrunchyrollScraper`) : Données d'exemple pour développement

**Le scraper avancé intègre** : masquage WebDriver, simulation comportementale humaine, headers réalistes, techniques anti-empreinte digitale, et navigation furtive.

## 📋 Prérequis

- Node.js >= 14.0.0
- Chrome/Chromium installé (requis par Playwright)

## 🔧 Configuration

Le package utilise Playwright pour automatiser le navigateur. Lors de la première installation, Playwright téléchargera automatiquement les navigateurs nécessaires.

Si vous rencontrez des problèmes, vous pouvez installer manuellement les dépendances de Playwright :

```bash
npx playwright install chromium
```

## 💡 Utilisation

### 🚀 Scraper Avancé (RECOMMANDÉ - Nouvelles techniques 2024/2025)

```javascript
const { createCrunchyrollScraper } = require('crunchyroll-scraper');

async function scrapingAvance() {
  const scraper = await createCrunchyrollScraper({
    headless: false, // Mode visible pour éviter la détection
    timeout: 60000,  // Timeout plus long pour les challenges
    locale: 'fr-FR'
  });

  try {
    // Le scraper utilise automatiquement :
    // - Masquage des propriétés WebDriver/Playwright
    // - Simulation de comportement humain (souris, délais)
    // - Headers HTTP réalistes
    // - Navigation furtive avec échauffement
    
    const searchResult = await scraper.searchAnime('One Piece');
    
    if (searchResult.success) {
      const anime = searchResult.data[0];
      console.log(`✅ Trouvé: ${anime.title}`);
      
      // Récupérer les épisodes avec techniques avancées
      const episodesResult = await scraper.getEpisodes(anime.url);
      console.log(`📺 ${episodesResult.data.length} épisodes trouvés`);
    }
  } finally {
    await scraper.close();
  }
}
```

### 🛡️ Autres Options de Scrapers

```javascript
// Scraper robuste (headless avec anti-détection)
const { createRobustCrunchyrollScraper } = require('crunchyroll-scraper');
const robustScraper = await createRobustCrunchyrollScraper();

// Scraper legacy (basique)
const { createLegacyCrunchyrollScraper } = require('crunchyroll-scraper');
const legacyScraper = await createLegacyCrunchyrollScraper();

// Scraper demo (données d'exemple)
const { createDemoCrunchyrollScraper } = require('crunchyroll-scraper');
const demoScraper = await createDemoCrunchyrollScraper();
```

### Utilisation avancée avec TypeScript

```typescript
import { CrunchyrollScraper, AnimeSeries } from 'crunchyroll-scraper';

const scraper = new CrunchyrollScraper({
  headless: false,  // Afficher le navigateur
  timeout: 60000,   // Timeout d'1 minute
  maxRetries: 3     // 3 tentatives max
});

await scraper.initialize();

// Récupérer une série complète avec tous les détails
const result = await scraper.getAnimeSeries('https://www.crunchyroll.com/series/...');

if (result.success) {
  const series: AnimeSeries = result.data;
  console.log(`${series.title} - ${series.episodeCount} épisodes`);
  
  // Accéder aux thumbnails des épisodes
  series.episodes.forEach(episode => {
    console.log(`Episode ${episode.episodeNumber}: ${episode.thumbnail}`);
  });
}
```

## 📚 API

### CrunchyrollScraper

#### Constructor Options

```typescript
interface ScraperOptions {
  headless?: boolean;      // Mode headless (défaut: true)
  timeout?: number;        // Timeout en ms (défaut: 30000)
  maxRetries?: number;     // Nombre de tentatives (défaut: 3)
  userAgent?: string;      // User agent personnalisé
  locale?: string;         // Locale (défaut: 'fr-FR')
}
```

#### Méthodes

##### `searchAnime(query: string): Promise<ScraperResult<Anime[]>>`

Recherche des animés par titre.

##### `getAnimeDetails(animeUrl: string): Promise<ScraperResult<Anime>>`

Récupère les détails d'un animé (description, genres, année, note).

##### `getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>>`

Récupère la liste des épisodes avec leurs thumbnails.

##### `getAnimeSeries(animeUrl: string): Promise<ScraperResult<AnimeSeries>>`

Récupère les détails de l'animé ET tous ses épisodes en une seule fois.

### Types

```typescript
interface Anime {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  url: string;
  genres?: string[];
  releaseYear?: number;
  rating?: number;
  episodeCount?: number;
}

interface Episode {
  id: string;
  animeId: string;
  title: string;
  episodeNumber: number;
  seasonNumber?: number;
  thumbnail: string;
  description?: string;
  duration?: number;
  releaseDate?: Date;
  url: string;
}

interface ScraperResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## 🛠️ Exemples

### Télécharger toutes les thumbnails d'une série

```javascript
const fs = require('fs');
const https = require('https');
const path = require('path');

async function downloadThumbnail(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, response => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function downloadAllThumbnails(animeUrl) {
  const scraper = await createCrunchyrollScraper();
  
  try {
    const result = await scraper.getAnimeSeries(animeUrl);
    
    if (result.success) {
      const series = result.data;
      const dir = `./thumbnails/${series.title.replace(/[^a-z0-9]/gi, '_')}`;
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      for (const episode of series.episodes) {
        const filename = `episode_${episode.episodeNumber}.jpg`;
        const filepath = path.join(dir, filename);
        
        await downloadThumbnail(episode.thumbnail, filepath);
        console.log(`✅ Téléchargé: ${filename}`);
      }
    }
  } finally {
    await scraper.close();
  }
}
```

### Recherche et export en JSON

```javascript
async function exportAnimeData(searchQuery) {
  const scraper = await createCrunchyrollScraper();
  
  try {
    const searchResult = await scraper.searchAnime(searchQuery);
    
    if (searchResult.success && searchResult.data.length > 0) {
      const anime = searchResult.data[0];
      const seriesResult = await scraper.getAnimeSeries(anime.url);
      
      if (seriesResult.success) {
        const data = seriesResult.data;
        fs.writeFileSync(
          `${data.title.replace(/[^a-z0-9]/gi, '_')}.json`,
          JSON.stringify(data, null, 2)
        );
        console.log('✅ Données exportées en JSON');
      }
    }
  } finally {
    await scraper.close();
  }
}
```

## ⚠️ Limitations et considérations

1. **Rate Limiting** : Crunchyroll peut limiter le nombre de requêtes. Utilisez des délais entre les requêtes.

2. **Changements de structure** : Le site peut changer sa structure HTML. Le package sera mis à jour régulièrement.

3. **Respect des CGU** : Assurez-vous de respecter les conditions d'utilisation de Crunchyroll.

4. **Performance** : Le scraping peut être lent pour les grandes séries. Utilisez le mode headless pour de meilleures performances.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Playwright](https://playwright.dev/) pour l'automatisation du navigateur
- [TypeScript](https://www.typescriptlang.org/) pour le typage statique
- La communauté anime pour le support et les retours

## 📞 Support

Pour toute question ou problème, ouvrez une issue sur GitHub.

---

**Note** : Ce package est un outil éducatif. Utilisez-le de manière responsable et respectez les droits d'auteur. 