import { Browser, Page, chromium } from 'playwright';
import { ScraperOptions } from '../types/anime.types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
      console.log('🔧 Initialisation UNDETECTED-CHROME pour Playwright...');
      
      // === UNDETECTED-CHROME TECHNIQUE ===
      // 1. Créer un profil utilisateur temporaire réaliste
      const userDataDir = await this.createRealUserProfile();
      
      // 2. Arguments ultra-furtifs basés sur undetected-chromedriver
      const stealthArgs = [
        // Core anti-détection (basé sur UC) - ARGUMENTS CRITIQUES
        '--disable-blink-features=AutomationControlled',
        '--exclude-switches=enable-automation',
        '--disable-extensions',
        '--no-sandbox',
        '--disable-plugins-discovery',
        '--disable-features=VizDisplayCompositor',
        
        // Navigation réaliste
        '--no-first-run',
        '--no-service-autorun',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-component-update',
        
        // Extensions et services
        '--disable-extensions-file-access-check',
        '--disable-extensions-http-throttling',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-extensions',
        
        // Sécurité adaptée
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        
        // Performance réaliste
        '--memory-pressure-off',
        '--disable-back-forward-cache',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        
        // Media/GPU
        '--disable-gpu-sandbox', 
        '--disable-software-rasterizer',
        '--disable-dev-shm-usage',
        
        // Fenêtre réaliste
        '--window-size=1366,768',
        '--disable-infobars',
        '--disable-notifications',
        
        // Réseau optimisé
        '--aggressive-cache-discard',
        '--disable-domain-reliability',
        '--disable-background-networking',
        
        // Arguments UNDETECTED-CHROMEDRIVER critiques
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor,ScriptStreaming',
        '--disable-automation',
        '--disable-save-password-bubble',
        '--disable-single-click-autofill',
        '--disable-autofill-keyboard-accessory-view[8]',
        '--disable-full-form-autofill-ios',
        '--disable-password-generation',
        '--disable-password-manager-reauthentication',
        
        // Profil utilisateur
        `--user-data-dir=${userDataDir}`
      ];

      // 3. Configuration Playwright avec profil réel
      const launchOptions: any = {
        headless: this.options.headless,
        args: stealthArgs,
        // Utiliser le canal Chrome officiel (plus furtif)
        channel: 'chrome',
        // Timeout plus long pour éviter détection
        timeout: 60000,
        // Désactiver les DEV tools
        devtools: false
      };

      console.log(`🚀 Lancement Chrome ${this.options.headless ? 'headless' : 'visible'} avec profil: ${userDataDir}`);
      
      // 4. Context ultra-réaliste avec rotation d'identité et profil persistant
      const identity = this.generateRealisticIdentity();
      
      // Retirer user-data-dir des args pour utiliser launchPersistentContext
      const finalArgs = stealthArgs.filter(arg => !arg.startsWith('--user-data-dir'));
      
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: this.options.headless,
        args: finalArgs,
        channel: 'chrome',
        timeout: 60000,
        devtools: false,
        // Arguments UNDETECTED spécifiques à Playwright
        ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection'],
        userAgent: identity.userAgent,
        locale: identity.locale,
        viewport: identity.viewport,
        
        // Headers ultra-réalistes avec variation
        extraHTTPHeaders: {
          'Accept': identity.headers.accept,
          'Accept-Language': identity.headers.acceptLanguage,
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua': identity.headers.secChUa,
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': identity.headers.secChUaPlatform,
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': identity.userAgent
        },
        
        // Géolocalisation cohérente avec l'identité
        geolocation: identity.geolocation,
        permissions: ['geolocation'],
        timezoneId: identity.timezone,
        
        // Simulation réseau réaliste
        offline: false,
        
        // Bypass CSP pour injection de scripts
        bypassCSP: true
      });
      
      // Récupérer la première page du context persistant
      const pages = context.pages();
      this.page = pages.length > 0 ? pages[0] : await context.newPage();
      this.page.setDefaultTimeout(this.options.timeout!);
      
      // Stocker le browser (même si c'est un context persistant)
      this.browser = context as any;

      // 5. Injection de scripts anti-détection ultra-avancés
      await this.injectUndetectedScripts();
      
      console.log('✅ Browser UNDETECTED initialisé avec succès');
    }
  }

  private async setupHeadlessAntiDetection(): Promise<void> {
    if (!this.page) return;

    // Script anti-détection ultime niveau militaire
    await this.page.addInitScript(() => {
      // === NIVEAU 1: MASQUAGE DES TRACES AUTOMATION ===
      
      // Suppression complète webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
      
      // Nettoyage des traces automation
      delete (window as any).__playwright;
      delete (window as any).__pw_manual;
      delete (window as any).__pw_script;
      delete (window as any).__puppeteer;
      delete (window as any)._phantom;
      delete (window as any).__nightmare;
      delete (window as any).__selenium;
      delete (window as any).callPhantom;
      delete (window as any)._selenium;
      delete (window as any).__webdriver_script_fn;
      delete (window as any).__driver_evaluate;
      delete (window as any).__webdriver_evaluate;
      delete (window as any).__selenium_evaluate;
      delete (window as any).__fxdriver_evaluate;
      delete (window as any).__driver_unwrapped;
      delete (window as any).__webdriver_unwrapped;
      delete (window as any).__selenium_unwrapped;
      delete (window as any).__fxdriver_unwrapped;
      delete (window as any).__webdriver_script_func;
      
      // Suppression attributs automation Chrome
      if ((navigator as any).webdriver !== undefined) {
        delete (navigator as any).webdriver;
      }
      
      // === NIVEAU 2: OVERRIDE PROPRIÉTÉS CRITIQUES ===
      
      // Chrome Runtime masking
      if ('runtime' in window && 'onConnect' in (window as any).runtime) {
        delete (window as any).runtime.onConnect;
      }
      
      // User Agent ultra-réaliste avec rotation
      const realUserAgents = [
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ];
      const selectedUA = realUserAgents[Math.floor(Math.random() * realUserAgents.length)];
      
      Object.defineProperty(navigator, 'userAgent', {
        get: () => selectedUA,
        configurable: true
      });
      
      // Platform cohérent avec l'UA
      const platform = selectedUA.includes('Windows') ? 'Win32' : 
                     selectedUA.includes('Mac') ? 'MacIntel' : 'Linux x86_64';
      Object.defineProperty(navigator, 'platform', {
        get: () => platform,
        configurable: true
      });

      // 4. Plugins réalistes
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            name: 'Chrome PDF Plugin',
            filename: 'internal-pdf-viewer',
            description: 'Portable Document Format'
          },
          {
            name: 'Chromium PDF Plugin', 
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            description: 'Portable Document Format'
          }
        ],
        configurable: true
      });

      // 5. Languages réalistes
      Object.defineProperty(navigator, 'languages', {
        get: () => ['fr-FR', 'fr', 'en-US', 'en'],
        configurable: true
      });

      // 6. Hardware concurrency réaliste
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 4,
        configurable: true
      });

      // 7. Memory info réaliste
      if ((navigator as any).deviceMemory !== undefined) {
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
          configurable: true
        });
      }

      // 8. Screen properties réalistes
      Object.defineProperty(screen, 'width', {
        get: () => 1366,
        configurable: true
      });
      Object.defineProperty(screen, 'height', {
        get: () => 768,
        configurable: true
      });
      Object.defineProperty(screen, 'availWidth', {
        get: () => 1366,
        configurable: true
      });
      Object.defineProperty(screen, 'availHeight', {
        get: () => 728,
        configurable: true
      });
      Object.defineProperty(screen, 'colorDepth', {
        get: () => 24,
        configurable: true
      });
      Object.defineProperty(screen, 'pixelDepth', {
        get: () => 24,
        configurable: true
      });

      // 9. Timezone cohérent
      Object.defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
        value: function() {
          return {
            locale: 'fr-FR',
            timeZone: 'Europe/Paris',
            calendar: 'gregory',
            numberingSystem: 'latn'
          };
        }
      });

      // 10. WebGL vendor réaliste
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel(R) HD Graphics 620';
        }
        return getParameter.call(this, parameter);
      };

      // 11. Canvas fingerprint randomization
      const getImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(...args) {
        const imageData = getImageData.apply(this, args);
        for (let i = 0; i < imageData.data.length; i += 4) {
          imageData.data[i] += Math.floor(Math.random() * 3) - 1;
          imageData.data[i + 1] += Math.floor(Math.random() * 3) - 1;
          imageData.data[i + 2] += Math.floor(Math.random() * 3) - 1;
        }
        return imageData;
      };

      // 12. Permissions API réaliste
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(parameters) {
        return originalQuery.call(this, parameters).then(result => {
          if (parameters.name === 'notifications') {
            Object.defineProperty(result, 'state', { value: 'default' });
          }
          return result;
        });
      };

      // 13. Masquer les propriétés spécifiques au headless
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
        configurable: true
      });

      // 14. Connection info réaliste
      Object.defineProperty(navigator, 'connection', {
        get: () => ({
          effectiveType: '4g',
          rtt: 50,
          downlink: 10,
          saveData: false
        }),
        configurable: true
      });

      // 15. Battery API
      if ((navigator as any).getBattery) {
        (navigator as any).getBattery = () => Promise.resolve({
          charging: true,
          chargingTime: 0,
          dischargingTime: Infinity,
          level: 1
        });
      }
    });

    // Configuration viewport adaptative
    await this.page.setViewportSize({ 
      width: 1366 + Math.floor(Math.random() * 100), 
      height: 768 + Math.floor(Math.random() * 100) 
    });
  }

  /**
   * Crée un profil utilisateur temporaire réaliste
   */
  private async createRealUserProfile(): Promise<string> {
    const tempDir = os.tmpdir();
    const profileName = `chrome-undetected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userDataDir = path.join(tempDir, profileName);
    
    // Créer la structure de dossier Chrome réaliste
    const dirs = [
      'Default',
      'Default/Extensions',
      'Default/Local Storage',
      'Default/Session Storage',
      'Default/IndexedDB',
      'ShaderCache',
      'Default/GPUCache'
    ];
    
    for (const dir of dirs) {
      const fullPath = path.join(userDataDir, dir);
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    // Créer des fichiers de configuration réalistes
    const prefsContent = {
      "profile": {
        "default_content_setting_values": {
          "notifications": 2
        },
        "default_content_settings": {
          "popups": 0
        },
        "managed_user_id": "",
        "name": "Utilisateur",
        "avatar_icon": "chrome://theme/IDR_PROFILE_AVATAR_0"
      },
      "browser": {
        "check_default_browser": false
      },
      "distribution": {
        "make_chrome_default_for_user": false,
        "system_level": false
      }
    };
    
    fs.writeFileSync(
      path.join(userDataDir, 'Default', 'Preferences'),
      JSON.stringify(prefsContent, null, 2)
    );
    
    console.log(`📁 Profil utilisateur créé: ${userDataDir}`);
    return userDataDir;
  }

  /**
   * Génère une identité réaliste avec rotation
   */
  private generateRealisticIdentity(): any {
    const identities = [
      {
        platform: 'Windows',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        geolocation: { latitude: 48.8566, longitude: 2.3522 },
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          acceptLanguage: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          secChUa: '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          secChUaPlatform: '"Windows"'
        }
      },
      {
        platform: 'MacOS',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 900 },
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        geolocation: { latitude: 48.8566, longitude: 2.3522 },
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          acceptLanguage: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          secChUa: '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          secChUaPlatform: '"macOS"'
        }
      },
      {
        platform: 'Linux',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'fr-FR',
        timezone: 'Europe/Paris',
        geolocation: { latitude: 48.8566, longitude: 2.3522 },
        headers: {
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          acceptLanguage: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          secChUa: '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
          secChUaPlatform: '"Linux"'
        }
      }
    ];
    
    const selectedIdentity = identities[Math.floor(Math.random() * identities.length)];
    console.log(`🎭 Identité générée: ${selectedIdentity.platform}`);
    return selectedIdentity;
  }

  /**
   * Injection de scripts anti-détection ultra-avancés (basés sur UC)
   */
  private async injectUndetectedScripts(): Promise<void> {
    if (!this.page) return;
    
    console.log('💉 Injection scripts UNDETECTED...');
    
    await this.page.addInitScript(() => {
      // === TECHNIQUE UNDETECTED-CHROMEDRIVER ===
      
      // 1. Patch complet navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
      
      // 2. Supprimer TOUS les indicateurs automation
      const toDelete = [
        '__playwright', '__pw_manual', '__pw_script',
        '__puppeteer', '_phantom', '__nightmare',
        '__selenium', '__webdriver_evaluate', '__driver_evaluate',
        '__webdriver_script_func', '__webdriver_script_fn',
        '__fxdriver_evaluate', '__driver_unwrapped',
        '__webdriver_unwrapped', '__selenium_unwrapped',
        '__fxdriver_unwrapped', 'callSelenium', '_Selenium_IDE_Recorder',
        'calledSelenium', '$cdc_asdjflasutopfhvcZLmcfl_', '$chrome_asyncScriptInfo',
        '__$webdriverAsyncExecutor', 'webdriver', '_selenium', 'callPhantom'
      ];
      
      toDelete.forEach(prop => {
        if (prop in window) {
          delete (window as any)[prop];
        }
      });
      
      // 3. Patch navigator properties (technique UC)
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: null },
            description: "Portable Document Format",
            filename: "internal-pdf-viewer",
            length: 1,
            name: "Chrome PDF Plugin"
          },
          {
            0: { type: "application/pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: null },
            description: "Portable Document Format", 
            filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
            length: 1,
            name: "Chrome PDF Viewer"
          }
        ],
        configurable: true
      });
      
      // 4. Patch window.chrome (UC technique)
      (window as any).chrome = {
        app: {
          isInstalled: false,
          InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed', 
            NOT_INSTALLED: 'not_installed'
          },
          RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running'
          }
        },
        runtime: {
          onConnect: null,
          onMessage: null
        },
        loadTimes: function() {
          return {
            commitLoadTime: performance.timeOrigin / 1000,
            connectionInfo: 'http/1.1',
            finishDocumentLoadTime: (performance.timeOrigin + performance.now()) / 1000,
            finishLoadTime: (performance.timeOrigin + performance.now()) / 1000,
            firstPaintAfterLoadTime: 0,
            firstPaintTime: (performance.timeOrigin + performance.now()) / 1000,
            navigationType: 'Other',
            npnNegotiatedProtocol: 'unknown',
            requestTime: performance.timeOrigin / 1000,
            startLoadTime: performance.timeOrigin / 1000,
            wasAlternateProtocolAvailable: false,
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: false
          };
        },
        csi: function() {
          return {
            onloadT: performance.timeOrigin + performance.now(),
            pageT: performance.now(),
            startE: performance.timeOrigin,
            tran: 15
          };
        }
      };
      
      // 5. Patch permissions API (UC)
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(parameters: any) {
        return originalQuery.call(this, parameters).then(result => {
          if (parameters.name === 'notifications') {
            Object.defineProperty(result, 'state', { value: 'default' });
          }
          return result;
        });
      };
      
      // 6. Patch Language et Timezone cohérents
      Object.defineProperty(navigator, 'languages', {
        get: () => ['fr-FR', 'fr', 'en-US', 'en'],
        configurable: true
      });
      
      // 7. Mock realistic hardware (UC technique)
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 4 + Math.floor(Math.random() * 4),
        configurable: true
      });
      
      // 8. Patch Date/Timezone
      const originalDate = Date;
      Date.prototype.getTimezoneOffset = function() {
        return -60; // Paris timezone
      };
      
      console.log('✅ Scripts UNDETECTED injectés');
    });
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