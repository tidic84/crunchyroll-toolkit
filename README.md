# Crunchyroll Toolkit

Scraper avancé pour récupérer des animés (saisons, épisodes, métadonnées) depuis Crunchyroll, avec gestion anti‑détection et recherche robuste (FR/EN).

## Caractéristiques

- Recherche améliorée (fallback multi‑locale, tri par pertinence/slug/position)
- Métadonnées complètes (titre, description, thumbnail, année, genres)
- Extraction multi‑saisons (navigation boutons/dropdown + déduplication)
- Thumbnails HD (épisodes et série)
- Anti‑détection (undetected-chromedriver-js, user‑agent, navigation intelligente)
- Mode debug activable pour diagnostics détaillés

## Installation

Depuis le dépôt (développement local):
```bash
npm install
npm run build
```

Via NPM (API principale exportée):
```bash
npm install crunchyroll-toolkit
```

## Utilisation rapide

### API publiée (NPM) – scraper "classique"
```javascript
// ESM
import { createCrunchyrollScraper } from 'crunchyroll-toolkit';

const scraper = await createCrunchyrollScraper({
  headless: true,
  timeout: 30000,
  locale: 'fr-FR'
});

const search = await scraper.searchAnime('Lycoris Recoil');
const anime = search.data?.[0];
const episodes = await scraper.getEpisodes(anime.url);
await scraper.close();
```

### API Toolkit (dans ce repo) – scraper renforcé
```javascript
// Utilisation locale (lib déjà buildée)
const { createCrunchyrollToolkitScraper } = require('./lib/crunchyroll-toolkit.index');

(async () => {
  const scraper = await createCrunchyrollToolkitScraper({
    headless: true,
    timeout: 30000,
    locale: 'fr-FR',
    debug: false // ou CR_TOOLKIT_DEBUG=1 dans l'environnement
  });

  const search = await scraper.searchAnime('A Couple of Cuckoos');
  const anime = search.data?.[0];
  const episodes = await scraper.getEpisodes(anime.url);
  console.log(`Saisons: ${episodes.metadata?.totalSeasons}, Épisodes: ${episodes.metadata?.totalEpisodes}`);
  await scraper.close();
})();
```

## Configuration

Options communes (`ScraperOptions`):
- `headless` (boolean): exécuter le navigateur sans UI. Par défaut: true côté production.
- `timeout` (number): timeout global des opérations.
- `maxRetries` (number): nombre de ré‑essais.
- `locale` (string): ex. `fr-FR`.
- `userAgent` (string): UA personnalisé.
- `debug` (boolean): active les logs détaillés (Toolkit).

Variables d’environnement utiles (Toolkit):
- `CR_TOOLKIT_DEBUG=1` active le mode debug (équivalent à `options.debug=true`).

## API principale

- `searchAnime(query: string): Promise<ScraperResult<Anime[]>>`
- `getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>>`
- `close(): Promise<void>`

Types disponibles: `Anime`, `Episode`, `AnimeSeries`, `ScraperResult`, `ScraperOptions`.

## Tests rapides (local)

```bash
node test-crunchyroll-toolkit.js "Lycoris Recoil"
node test-crunchyroll-toolkit.js "https://www.crunchyroll.com/fr/series/GQWH0M98E/combatants-will-be-dispatched"
```

## Structure du projet

```
crunchyroll-toolkit/
├── src/
│   ├── scrapers/
│   │   ├── crunchyroll.scraper.ts              # Scraper historique (export NPM)
│   │   └── crunchyroll-toolkit.scraper.ts      # Scraper Toolkit (repo)
│   ├── types/
│   │   └── anime.types.ts                      # Types TypeScript
│   ├── utils/
│   │   ├── browser.utils.ts                    # Gestion navigateur
│   │   ├── selenium.browser.utils.ts           # Utilitaires Selenium
│   │   ├── crunchyroll-toolkit.browser.utils.ts# Utilitaires Toolkit
│   │   └── parser.utils.ts                     # Parsing
│   ├── index.ts                                # Entrée NPM (scraper historique)
│   └── crunchyroll-toolkit.index.ts            # Entrée Toolkit (repo)
├── lib/                                        # Code compilé
├── test-crunchyroll-toolkit.js                 # Script de test principal
├── package.json
└── tsconfig.json
```

## Notes techniques

- Recherche: détection des résultats par liens `/series/`, fallback multi‑locale (FR → EN), tri par pertinence + match slug + position visuelle.
- Multi‑saisons: navigation via dropdown/boutons, regroupement et tri par saison/épisode, suppression des doublons.
- Anti‑détection: `undetected-chromedriver-js`, UA réaliste, déplacements/scrolls, gestion cookie banner.
- Logs: très compacts par défaut; détaillés avec `debug` ou `CR_TOOLKIT_DEBUG=1`.

## Licence

MIT — voir [LICENSE](LICENSE).

## Contribution

Les contributions sont bienvenues. Ouvrez une PR avec une description claire (contexte, changements, tests). 

## Avertissement

Projet à but éducatif. Respectez les CGU de Crunchyroll et la législation en vigueur.