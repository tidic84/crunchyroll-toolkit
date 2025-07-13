export { SeleniumCrunchyrollScraper } from './scrapers/selenium.crunchyroll.scraper';
export { SeleniumBrowserManager } from './utils/selenium.browser.utils';
export * from './types/anime.types';

// Factory function pour créer un scraper Selenium
export async function createSeleniumCrunchyrollScraper(options?: any) {
  const { SeleniumCrunchyrollScraper } = await import('./scrapers/selenium.crunchyroll.scraper');
  const scraper = new SeleniumCrunchyrollScraper(options);
  await scraper.initialize();
  return scraper;
}