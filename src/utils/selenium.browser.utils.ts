import { WebDriver, Builder, By, until } from 'selenium-webdriver';
import { ScraperOptions } from '../types/anime.types';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export class SeleniumBrowserManager {
  private driver?: WebDriver;
  private options: ScraperOptions;
  private pythonProcess?: child_process.ChildProcess;

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
    if (!this.driver) {
      console.log('🔧 Initialisation Selenium + undetected-chromedriver...');
      
      // 1. Démarrer le script Python undetected-chromedriver
      await this.startUndetectedDriver();
      
      // 2. Attendre que le driver soit prêt
      await this.waitForDriverReady();
      
      // 3. Se connecter au driver via Selenium
      await this.connectToDriver();
      
      console.log('✅ Selenium + undetected-chromedriver initialisé avec succès');
    }
  }

  private async startUndetectedDriver(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🐍 Démarrage du script Python undetected-chromedriver...');
      
      const pythonArgs = ['undetected_driver.py'];
      if (this.options.headless) {
        pythonArgs.push('--headless');
      }
      
      // Utiliser l'environnement virtuel
      const pythonPath = path.join(process.cwd(), 'venv', 'bin', 'python');
      
      this.pythonProcess = child_process.spawn(pythonPath, pythonArgs, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.pythonProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`🐍 Python: ${output.trim()}`);
        
        if (output.includes('Driver prêt !')) {
          resolve();
        }
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        console.error(`🐍 Python Error: ${data.toString()}`);
      });

      this.pythonProcess.on('error', (error) => {
        console.error('❌ Erreur Python process:', error);
        reject(error);
      });

      this.pythonProcess.on('exit', (code) => {
        console.log(`🐍 Python process terminé avec le code: ${code}`);
      });

      // Timeout de sécurité
      setTimeout(() => {
        if (!this.driver) {
          reject(new Error('Timeout: Python driver non démarré après 30s'));
        }
      }, 30000);
    });
  }

  private async waitForDriverReady(): Promise<void> {
    console.log('⏳ Attente du driver connection info...');
    
    // Attendre que le fichier driver_connection.json soit créé
    for (let i = 0; i < 30; i++) {
      if (fs.existsSync('driver_connection.json')) {
        console.log('📁 Fichier de connexion trouvé');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Timeout: fichier driver_connection.json non trouvé');
  }

  private async connectToDriver(): Promise<void> {
    // Lire les infos de connexion
    const connectionInfo = JSON.parse(fs.readFileSync('driver_connection.json', 'utf8'));
    
    console.log('🔗 Connexion au driver undetected...');
    console.log(`📡 URL: ${connectionInfo.command_executor_url}`);
    console.log(`🆔 Session: ${connectionInfo.session_id}`);

    try {
      // Se connecter au driver existant
      this.driver = await new Builder()
        .usingServer(connectionInfo.command_executor_url)
        .build();

      // Valider la connexion
      await this.driver.getTitle();
      console.log('✅ Connexion Selenium établie');

    } catch (error) {
      console.error('❌ Erreur connexion Selenium:', error);
      throw error;
    }
  }

  async navigateTo(url: string): Promise<void> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    
    console.log(`🌐 Navigation vers: ${url}`);
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

  async waitForElement(selector: string, timeout: number = 10000): Promise<any> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    
    try {
      return await this.driver.wait(until.elementLocated(By.css(selector)), timeout);
    } catch (error) {
      console.log(`⚠️ Élément non trouvé: ${selector}`);
      return null;
    }
  }

  async executeScript(script: string): Promise<any> {
    if (!this.driver) {
      throw new Error('Driver not initialized');
    }
    return await this.driver.executeScript(script);
  }

  async close(): Promise<void> {
    console.log('🛑 Fermeture du browser manager...');
    
    if (this.driver) {
      try {
        await this.driver.quit();
        this.driver = undefined;
        console.log('✅ Driver Selenium fermé');
      } catch (error) {
        console.error('⚠️ Erreur fermeture driver:', error);
      }
    }

    if (this.pythonProcess && !this.pythonProcess.killed) {
      try {
        this.pythonProcess.kill('SIGTERM');
        console.log('✅ Process Python arrêté');
      } catch (error) {
        console.error('⚠️ Erreur arrêt Python process:', error);
      }
    }

    // Nettoyer le fichier de connexion
    if (fs.existsSync('driver_connection.json')) {
      fs.unlinkSync('driver_connection.json');
      console.log('🧹 Fichier de connexion nettoyé');
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