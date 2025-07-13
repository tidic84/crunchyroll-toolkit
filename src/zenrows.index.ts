export { ZenRowsCrunchyrollScraper } from './scrapers/zenrows.crunchyroll.scraper';
export { ZenRowsBrowserManager } from './utils/zenrows.browser.utils';
export * from './types/anime.types';

// Factory function pour créer un scraper ZenRows Method
export async function createZenRowsCrunchyrollScraper(options?: any) {
  const { ZenRowsCrunchyrollScraper } = await import('./scrapers/zenrows.crunchyroll.scraper');
  const scraper = new ZenRowsCrunchyrollScraper(options);
  await scraper.initialize();
  return scraper;
}