// Export principal du scraper
export { CrunchyrollScraper } from './scrapers/crunchyroll.scraper';
export { CrunchyrollRobustScraper } from './scrapers/crunchyroll-robust.scraper';
export { CrunchyrollDemoScraper } from './scrapers/crunchyroll-demo.scraper';

// Export des types
export { 
  Anime, 
  Episode, 
  AnimeSeries, 
  ScraperOptions, 
  ScraperResult 
} from './types/anime.types';

// Export des utilitaires
export { BrowserManager } from './utils/browser.utils';
export { ParserUtils } from './utils/parser.utils';

// Fonction helper pour créer une instance rapidement
import type { ScraperOptions as ScraperOptionsType } from './types/anime.types';

export async function createCrunchyrollScraper(options?: ScraperOptionsType) {
  const { CrunchyrollAdvancedScraper } = await import('./scrapers/crunchyroll-advanced.scraper');
  const scraper = new CrunchyrollAdvancedScraper(options);
  await scraper.initialize();
  return scraper;
}

export async function createLegacyCrunchyrollScraper(options?: ScraperOptionsType) {
  const { CrunchyrollScraper } = await import('./scrapers/crunchyroll.scraper');
  const scraper = new CrunchyrollScraper(options);
  await scraper.initialize();
  return scraper;
}

export async function createRobustCrunchyrollScraper(options?: ScraperOptionsType) {
  const { CrunchyrollRobustScraper } = await import('./scrapers/crunchyroll-robust.scraper');
  const scraper = new CrunchyrollRobustScraper(options);
  await scraper.initialize();
  return scraper;
}

export async function createDemoCrunchyrollScraper(options?: ScraperOptionsType) {
  const { CrunchyrollDemoScraper } = await import('./scrapers/crunchyroll-demo.scraper');
  const scraper = new CrunchyrollDemoScraper(options);
  await scraper.initialize();
  return scraper;
}

export async function createNetworkCrunchyrollScraper(options?: ScraperOptionsType) {
  const { CrunchyrollNetworkScraper } = await import('./scrapers/crunchyroll-network.scraper');
  const scraper = new CrunchyrollNetworkScraper(options);
  await scraper.initialize();
  return scraper;
} 