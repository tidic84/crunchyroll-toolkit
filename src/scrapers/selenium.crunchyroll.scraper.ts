import { WebDriver, By, until } from 'selenium-webdriver';
import { ScraperOptions, ScraperResult, Anime, Episode } from '../types/anime.types';
import { SeleniumBrowserManager } from '../utils/selenium.browser.utils';
import * as fs from 'fs';

export class SeleniumCrunchyrollScraper {
  private browserManager: SeleniumBrowserManager;
  private baseUrl = 'https://www.crunchyroll.com';

  constructor(options: ScraperOptions = {}) {
    const enhancedOptions = {
      headless: false,
      timeout: 60000,
      maxRetries: 2,
      locale: 'fr-FR',
      ...options
    };
    this.browserManager = new SeleniumBrowserManager(enhancedOptions);
  }

  async initialize(): Promise<void> {
    await this.browserManager.initialize();
    console.log('🚀 Selenium Crunchyroll Scraper initialisé');
  }

  async searchAnime(query: string): Promise<ScraperResult<Anime[]>> {
    try {
      console.log(`🔍 Recherche Selenium: "${query}"`);
      
      const driver = await this.browserManager.getDriver();
      const searchUrl = `${this.baseUrl}/fr/search?q=${encodeURIComponent(query)}`;
      
      // Navigation vers la page de recherche
      await this.browserManager.navigateTo(searchUrl);
      
      // Attendre un peu pour que la page se charge
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Vérifier le titre de la page
      const title = await this.browserManager.getTitle();
      console.log(`📄 Titre de page: "${title}"`);
      
      // Sauvegarder le contenu pour debug
      await this.savePageContentForDebug(query);
      
      // Vérifier si on a un challenge Cloudflare
      const pageSource = await this.browserManager.getPageSource();
      if (pageSource.includes('Un instant') || pageSource.includes('challenge') || title.includes('Un instant')) {
        console.log('⚠️ Challenge Cloudflare détecté');
        return {
          success: false,
          error: 'Challenge Cloudflare détecté même avec undetected-chromedriver',
          data: []
        };
      }
      
      // Chercher les résultats de recherche
      const results: Anime[] = [];
      
      try {
        // Attendre les résultats de recherche
        await driver.wait(until.elementsLocated(By.css('[data-testid="search-item-title"]')), 10000);
        
        const titleElements = await driver.findElements(By.css('[data-testid="search-item-title"]'));
        const linkElements = await driver.findElements(By.css('a[href*="/series/"]'));
        
        console.log(`📋 Trouvé ${titleElements.length} résultats potentiels`);
        
        for (let i = 0; i < Math.min(titleElements.length, linkElements.length); i++) {
          try {
            const titleElement = titleElements[i];
            const linkElement = linkElements[i];
            
            const title = await titleElement.getText();
            const href = await linkElement.getAttribute('href');
            
            if (title && href && href.includes('/series/')) {
              results.push({
                id: this.extractSeriesIdFromUrl(href),
                title: title.trim(),
                url: href,
                thumbnail: undefined,
                description: undefined,
                genres: [],
                releaseYear: undefined,
                rating: undefined,
                episodeCount: undefined
              });
            }
          } catch (error) {
            console.log(`⚠️ Erreur extraction résultat ${i}:`, error);
          }
        }
        
      } catch (error) {
        console.log('⚠️ Aucun résultat de recherche trouvé avec les sélecteurs standards');
        
        // Essayer d'autres sélecteurs
        try {
          const allLinks = await driver.findElements(By.css('a[href*="/series/"]'));
          console.log(`🔗 Trouvé ${allLinks.length} liens série`);
          
          for (const link of allLinks.slice(0, 5)) {
            try {
              const href = await link.getAttribute('href');
              const text = await link.getText();
              
              if (href && text && text.trim()) {
                results.push({
                  id: this.extractSeriesIdFromUrl(href),
                  title: text.trim(),
                  url: href,
                  thumbnail: undefined,
                  description: undefined,
                  genres: [],
                  releaseYear: undefined,
                  rating: undefined,
                  episodeCount: undefined
                });
              }
            } catch (error) {
              console.log('⚠️ Erreur extraction lien:', error);
            }
          }
        } catch (error) {
          console.log('⚠️ Aucun lien série trouvé');
        }
      }
      
      console.log(`✅ Extraction terminée: ${results.length} séries trouvées`);
      
      if (results.length === 0) {
        return {
          success: false,
          error: `Aucune série d'animation trouvée pour "${query}"`,
          data: []
        };
      }
      
      return {
        success: true,
        data: results
      };
      
    } catch (error) {
      console.error('❌ Erreur recherche:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        data: []
      };
    }
  }

  private extractSeriesIdFromUrl(url: string): string {
    const match = url.match(/\/series\/([A-Z0-9]+)/);
    return match ? match[1] : '';
  }

  private async savePageContentForDebug(query: string): Promise<void> {
    try {
      const pageSource = await this.browserManager.getPageSource();
      const title = await this.browserManager.getTitle();
      const url = await this.browserManager.getCurrentUrl();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `/tmp/selenium-crunchyroll-debug-${query.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.html`;
      
      fs.writeFileSync(filename, pageSource);
      
      console.log('💾 Debug sauvegardé:', filename);
      console.log(`📄 Titre: "${title}"`);
      console.log(`🔗 URL: ${url}`);
      console.log(`📏 Taille HTML: ${Math.round(pageSource.length / 1024)}KB`);
      
      // Analyse rapide du contenu
      const hasResults = pageSource.includes('search-item') || pageSource.includes('series');
      const hasChallenge = pageSource.includes('Un instant') || pageSource.includes('challenge');
      const hasError = pageSource.includes('error') || pageSource.includes('Error');
      
      console.log('🔍 Analyse contenu:');
      console.log(`   - Résultats potentiels: ${hasResults ? '✅' : '❌'}`);
      console.log(`   - Challenge détecté: ${hasChallenge ? '⚠️' : '✅'}`);
      console.log(`   - Erreurs détectées: ${hasError ? '⚠️' : '✅'}`);
      
    } catch (error) {
      console.error('⚠️ Erreur sauvegarde debug:', error);
    }
  }

  async getAnimeDetails(url: string): Promise<ScraperResult<Anime>> {
    // Implémentation basique pour les détails
    return {
      success: false,
      error: 'Non implémenté dans cette version de test',
      data: {} as Anime
    };
  }

  async getEpisodes(url: string): Promise<ScraperResult<Episode[]>> {
    // Implémentation basique pour les épisodes
    return {
      success: false,
      error: 'Non implémenté dans cette version de test',
      data: []
    };
  }

  async close(): Promise<void> {
    await this.browserManager.close();
  }
}