import { Browser, Page, chromium } from 'playwright';
import { ScraperOptions } from '../types/anime.types';

export class BrowserManager {
  private browser?: Browser;
  private page?: Page;
  private options: ScraperOptions;

  constructor(options: ScraperOptions = {}) {
    this.options = {
      headless: true,
      timeout: 30000,
      maxRetries: 3,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      ...options
    };
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.options.headless
      });
      
      const context = await this.browser.newContext({
        userAgent: this.options.userAgent,
        locale: this.options.locale,
        viewport: { width: 1920, height: 1080 }
      });
      
      this.page = await context.newPage();
      this.page.setDefaultTimeout(this.options.timeout!);
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return this.page;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
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