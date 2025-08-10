import { WebDriver, Builder } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';
import { ScraperOptions } from '../types/anime.types';
import * as path from 'path';
const UndetectedChrome = require('undetected-chromedriver-js');

export class CrunchyrollToolkitBrowserManager {
  private driver?: WebDriver;
  private undetectedChrome?: any;
  private options: ScraperOptions;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      headless: true,
      timeout: 15000,
      maxRetries: 3,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      ...options
    };
  }

  async initialize(): Promise<void> {
    if (!this.driver) {
      console.log('🔧 Initialisation Crunchyroll Toolkit (Selenium + undetected-chromedriver-js)...');
      
      try {
        // Initialiser undetected-chromedriver-js
        this.undetectedChrome = new UndetectedChrome({
          headless: this.options.headless,
          userAgent: this.options.userAgent,
          executablePath: '/usr/bin/google-chrome-stable',
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--exclude-switches=enable-automation',
            '--window-size=1366,768'
          ],
          userDataDir: this.options.userDataDir
        });
        
        console.log('🎯 Création du driver avec undetected-chromedriver-js...');
        
        // Mode headless optionnel
        if (this.options.headless) {
          console.log('🔇 Mode headless activé');
        } else {
          console.log('🖥️ Mode visible activé');
        }
        
        // Création du driver avec anti-détection
        this.driver = await this.undetectedChrome!.build();
          
        console.log('✅ Crunchyroll Toolkit: Driver initialisé avec succès');
        
        // Timeout par défaut
        await this.driver!.manage().setTimeouts({ implicit: this.options.timeout });
        
      } catch (error) {
        console.error('❌ Erreur initialisation Crunchyroll Toolkit:', error);
        throw error;
      }
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    
    console.log(`🌐 Navigation Crunchyroll Toolkit vers: ${url}`);
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
        this.undetectedChrome = undefined;
        console.log('✅ Crunchyroll Toolkit Driver fermé');
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