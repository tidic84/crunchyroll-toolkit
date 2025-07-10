// Exports principaux
export { CrunchyrollScraper } from './scrapers/crunchyroll.scraper';

// Types
export type { 
  Anime, 
  Episode, 
  AnimeSeries, 
  ScraperResult, 
  ScraperOptions 
} from './types/anime.types';

// Utilitaires
export { BrowserManager } from './utils/browser.utils';
export { ParserUtils } from './utils/parser.utils';

// Factory function pour faciliter l'utilisation
import type { ScraperOptions as ScraperOptionsType } from './types/anime.types';

/**
 * Créer le scraper Crunchyroll principal (2025)
 * Utilise une approche hybride API + DOM pour contourner Cloudflare et récupérer les données d'animés
 */
export async function createCrunchyrollScraper(options: ScraperOptionsType = {}) {
  const { CrunchyrollScraper } = await import('./scrapers/crunchyroll.scraper');
  const scraper = new CrunchyrollScraper(options);
  await scraper.initialize();
  return scraper;
} 