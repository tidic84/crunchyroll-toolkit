export { CrunchyrollToolkitScraper } from './scrapers/crunchyroll-toolkit.scraper';
export { CrunchyrollToolkitBrowserManager } from './utils/crunchyroll-toolkit.browser.utils';
export * from './types/anime.types';

// Factory function pour créer un scraper Crunchyroll Toolkit
export async function createCrunchyrollToolkitScraper(options?: any) {
  const { CrunchyrollToolkitScraper } = await import('./scrapers/crunchyroll-toolkit.scraper');
  const scraper = new CrunchyrollToolkitScraper(options);
  await scraper.initialize();
  return scraper;
}