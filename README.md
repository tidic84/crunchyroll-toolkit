# Crunchyroll API Toolkit 🎌

Toolkit Node.js complet pour extraire données d'animés, métadonnées et thumbnails depuis Crunchyroll avec techniques anti-détection **2024/2025**.

## 🚀 Installation

```bash
npm install crunchyroll-api-toolkit
```

ou avec Yarn :

```bash
yarn add crunchyroll-api-toolkit
```

## ⚠️ État Actuel & Protections Anti-Bot (Janvier 2025)

**🚨 IMPORTANT** : Crunchyroll a renforcé ses protections avec **Cloudflare Turnstile** en 2024/2025, rendant le scraping automatisé très difficile.

### 📊 Scrapers Disponibles & Leur Efficacité

1. **🚀 Scraper Avancé** (`createCrunchyrollScraper`) : Anti-détection 2024/2025 | Efficacité ~40-60%
2. **🌐 Scraper Réseau** (`createNetworkCrunchyrollScraper`) : Interception API | Bloqué par Cloudflare  
3. **🛡️ Scraper Robuste** (`createRobustCrunchyrollScraper`) : Anti-détection classique | Efficacité ~20-40%
4. **📜 Scraper Legacy** (`createLegacyCrunchyrollScraper`) : Version basique | Obsolète
5. **🎭 Scraper Demo** (`createDemoCrunchyrollScraper`) : Données d'exemple | 100% fiable

### ⚠️ Limitations Actuelles
- **Cloudflare Turnstile** bloque la plupart des tentatives automatisées
- Les résultats peuvent être des données génériques de la page d'accueil
- Des délais très longs sont nécessaires pour éviter la détection

### 💡 Solutions Recommandées
1. **API Officielle Crunchyroll** (Légale et fiable)
2. **Scraper Demo** pour développement et tests
3. **Cache local** avec mise à jour manuelle

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

### 🚀 Scraper Avancé (Anti-détection 2024/2025)

```javascript
const { createCrunchyrollScraper } = require('crunchyroll-api-toolkit');

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
// Scraper réseau (interception API - expérimental)
const { createNetworkCrunchyrollScraper } = require('crunchyroll-api-toolkit');
const networkScraper = await createNetworkCrunchyrollScraper();

// Scraper robuste (headless avec anti-détection)
const { createRobustCrunchyrollScraper } = require('crunchyroll-api-toolkit');
const robustScraper = await createRobustCrunchyrollScraper();

// Scraper legacy (basique)
const { createLegacyCrunchyrollScraper } = require('crunchyroll-api-toolkit');
const legacyScraper = await createLegacyCrunchyrollScraper();

// Scraper demo (données d'exemple - RECOMMANDÉ pour développement)
const { createDemoCrunchyrollScraper } = require('crunchyroll-api-toolkit');
const demoScraper = await createDemoCrunchyrollScraper();
```

### 🎭 Scraper Demo (RECOMMANDÉ pour développement)

```javascript
const { createDemoCrunchyrollScraper } = require('crunchyroll-api-toolkit');

async function exempleDemo() {
  const demoScraper = await createDemoCrunchyrollScraper();
  
  // Données d'exemple toujours disponibles
  const searchResult = await demoScraper.searchAnime('One Piece');
  console.log(`Trouvé ${searchResult.data.length} animés`);
  
  // Pas de problème de détection ou de timeout
  const episodes = await demoScraper.getEpisodes(searchResult.data[0].url);
  console.log(`${episodes.data.length} épisodes avec thumbnails`);
}
```

### Utilisation avancée avec TypeScript

```typescript
import { CrunchyrollScraper, AnimeSeries } from 'crunchyroll-api-toolkit';

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

## ⚠️ Limitations Actuelles (2025)

### 🚫 Problèmes Identifiés

1. **Cloudflare Turnstile** : Crunchyroll utilise des challenges anti-bot avancés qui bloquent la plupart des tentatives automatisées
2. **Contenu Dynamique** : Les vrais résultats de recherche sont chargés par JavaScript après validation
3. **Détection Comportementale** : Cloudflare analyse les patterns de navigation pour détecter les bots
4. **Timeouts Fréquents** : Les scrapers peuvent rester bloqués sur les challenges de sécurité

### 📊 Taux de Réussite par Scraper

| Scraper | Efficacité | Cas d'usage recommandé |
|---------|------------|------------------------|
| **Demo** | 100% | Développement, tests, prototypage |
| **Avancé** | 40-60% | Production avec patience et délais |
| **Réseau** | 0% | Bloqué par Cloudflare (expérimental) |
| **Robuste** | 20-40% | Tests avec protections moyennes |
| **Legacy** | 0-10% | Obsolète |

### 💡 Alternatives Recommandées

1. **🎭 Scraper Demo** : Données d'exemple fiables pour développement
2. **🔑 API Officielle** : Solution légale et stable (si disponible)  
3. **💾 Cache Local** : Base de données manuelle d'animés populaires
4. **⏰ Scraping Lent** : Intervalles de plusieurs minutes entre requêtes

### 🛡️ Considérations Supplémentaires

- **Rate Limiting** : Délais obligatoires de 2-5 minutes entre requêtes
- **Mode Non-Headless** : Nécessaire pour éviter certaines détections
- **Proxies** : Recommandés pour éviter les blocages IP
- **Respect CGU** : Le scraping peut violer les conditions d'utilisation

## 📖 Documentation Avancée

- **[SITUATION-ACTUELLE-2025.md](SITUATION-ACTUELLE-2025.md)** : Analyse détaillée des protections Cloudflare
- **[TECHNIQUES-ANTI-DETECTION.md](TECHNIQUES-ANTI-DETECTION.md)** : Guide des méthodes 2024/2025
- **[SOLUTIONS.md](SOLUTIONS.md)** : Comparatif des différents scrapers
- **[SUCCES-2025.md](SUCCES-2025.md)** : Résumé des réussites techniques
- **[GUIDE-NOMMAGE.md](GUIDE-NOMMAGE.md)** : Guide de nommage du projet

## 🚀 Scripts d'Exemple

```bash
# Test du scraper avancé
node examples/test-advanced.js

# Test du scraper réseau
node examples/test-network-scraper.js

# Test de recherche avec diagnostic
node examples/test-search-fixed.js

# Utilisation complète
node examples/test-complet.js
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. Fork le projet sur [GitHub](https://github.com/tidic84/crunchyroll-toolkit)
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push sur la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### 🎯 Contributions Prioritaires

- Amélioration des techniques anti-détection
- Support d'autres sites d'anime
- Optimisation des performances
- Tests avec différents environnements

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Playwright](https://playwright.dev/) pour l'automatisation du navigateur
- [TypeScript](https://www.typescriptlang.org/) pour le typage statique
- La communauté anime pour le support et les retours

## 📞 Support

Pour toute question ou problème :
- 🐛 **Issues** : [GitHub Issues](https://github.com/tidic84/crunchyroll-toolkit/issues)
- 📧 **Email** : Contactez le maintainer du projet
- 📖 **Documentation** : Consultez les fichiers MD dans le dépôt

## 🎯 Roadmap 2025

- [ ] Amélioration contournement Cloudflare Turnstile
- [ ] Support API officielle Crunchyroll  
- [ ] Extension vers Funimation/autres plateformes
- [ ] Interface web pour utilisation simplifiée
- [ ] Cache intelligent avec auto-refresh
- [ ] Support mobile et responsive

---

## ⚖️ Avertissement Légal

**Ce toolkit est destiné à un usage éducatif et de recherche uniquement.**

- ✅ Respectez les conditions d'utilisation de Crunchyroll
- ✅ N'utilisez pas à des fins commerciales sans autorisation  
- ✅ Respectez les droits d'auteur et la propriété intellectuelle
- ⚠️ Le scraping peut violer les ToS - utilisez à vos risques

**Utilisez de manière responsable et éthique.** 