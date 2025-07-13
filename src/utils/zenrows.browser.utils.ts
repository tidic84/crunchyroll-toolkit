import { WebDriver, Builder } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import { ScraperOptions } from '../types/anime.types';
import * as path from 'path';

export class ZenRowsBrowserManager {
  private driver?: WebDriver;
  private options: ScraperOptions;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      maxRetries: 3,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      ...options
    };
  }

  async initialize(): Promise<void> {
    if (!this.driver) {
      console.log('🔧 Initialisation ZenRows Method (Selenium + undetected-chromedriver)...');
      
      // Méthode ZenRows exacte
      const chromeDriverPath = path.resolve('./undetected_chromedriver_executable');
      console.log(`🎯 Chemin undetected-chromedriver: ${chromeDriverPath}`);
      
      // Configurer Chrome Options selon ZenRows
      const chromeOptions = new chrome.Options();
      
      // Chemin Chrome (adapté pour Linux)
      const chromeExePath = '/usr/bin/google-chrome-stable';
      chromeOptions.setChromeBinaryPath(chromeExePath);
      
      // User agent personnalisé
      const customUserAgent = this.options.userAgent!;
      chromeOptions.addArguments(`--user-agent=${customUserAgent}`);
      
      // Mode headless optionnel
      if (this.options.headless) {
        chromeOptions.addArguments('--headless');
        console.log('🔇 Mode headless activé');
      } else {
        console.log('🖥️ Mode visible activé');
      }
      
      // Arguments anti-détection supplémentaires
      chromeOptions.addArguments('--no-sandbox');
      chromeOptions.addArguments('--disable-dev-shm-usage');
      chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
      chromeOptions.addArguments('--exclude-switches=enable-automation');
      chromeOptions.addArguments('--window-size=1366,768');
      
      try {
        // Création du driver selon la méthode ZenRows EXACTE
        this.driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(chromeOptions)
          .setChromeService(new chrome.ServiceBuilder(chromeDriverPath))
          .build();
          
        console.log('✅ ZenRows Method: Driver initialisé avec succès');
        
        // Timeout par défaut
        await this.driver.manage().setTimeouts({ implicit: this.options.timeout });
        
      } catch (error) {
        console.error('❌ Erreur initialisation ZenRows Method:', error);
        throw error;
      }
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    
    console.log(`🌐 Navigation ZenRows vers: ${url}`);
    await this.driver.get(url);
  }

  async getDriver(): Promise<WebDriver> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return this.driver;
  }

  async getPageSource(): Promise<string> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return await this.driver.getPageSource();
  }

  async getTitle(): Promise<string> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return await this.driver.getTitle();
  }

  async getCurrentUrl(): Promise<string> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return await this.driver.getCurrentUrl();
  }

  async executeScript(script: string): Promise<any> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return await this.driver.executeScript(script);
  }

  async close(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.quit();
        this.driver = undefined;
        console.log('✅ ZenRows Driver fermé');
      } catch (error) {
        console.error('⚠️ Erreur fermeture driver:', error);
      }
    }
  }

  async retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    
    for (let i = 0; i < this.options.maxRetries!; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < this.options.maxRetries! - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    
    throw lastError;
  }
}