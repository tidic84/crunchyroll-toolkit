import { Page, BrowserContext } from 'playwright';

interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  sessionId?: string;
}

interface AuthSession {
  cookies: any[];
  userAgent: string;
  timestamp: number;
  isValid: boolean;
}

export class CrunchyrollAuth {
  private tokens: Map<string, AuthToken> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private maxTokenAge = 3600000; // 1 heure
  private maxSessionAge = 86400000; // 24 heures
  private tokenRotationIndex = 0;

  constructor() {
    this.startTokenCleanup();
  }

  async getValidToken(page: Page): Promise<string | null> {
    const userAgent = await page.evaluate(() => navigator.userAgent);
    const sessionKey = this.generateSessionKey(userAgent);
    
    // Vérifier si on a un token valide pour cette session
    const cachedToken = this.tokens.get(sessionKey);
    if (cachedToken && this.isTokenValid(cachedToken)) {
      return cachedToken.accessToken;
    }

    // Essayer de récupérer un nouveau token
    const newToken = await this.extractTokenFromPage(page);
    if (newToken) {
      this.tokens.set(sessionKey, {
        accessToken: newToken,
        expiresAt: Date.now() + this.maxTokenAge,
        sessionId: sessionKey
      });
      return newToken;
    }

    // Essayer la rotation de sessions
    return await this.rotateAndGetToken(page);
  }

  private async extractTokenFromPage(page: Page): Promise<string | null> {
    try {
      // Méthode 1: Extraction depuis localStorage
      const localStorageToken = await page.evaluate(() => {
        try {
          const authData = localStorage.getItem('auth') || 
                          localStorage.getItem('crunchyroll-auth') ||
                          localStorage.getItem('access_token');
          if (authData) {
            const parsed = JSON.parse(authData);
            return parsed.access_token || parsed.accessToken || parsed.token;
          }
        } catch (e) {}
        return null;
      });

      if (localStorageToken) return localStorageToken;

      // Méthode 2: Extraction depuis sessionStorage
      const sessionStorageToken = await page.evaluate(() => {
        try {
          const authData = sessionStorage.getItem('auth') ||
                          sessionStorage.getItem('crunchyroll-auth') ||
                          sessionStorage.getItem('access_token');
          if (authData) {
            const parsed = JSON.parse(authData);
            return parsed.access_token || parsed.accessToken || parsed.token;
          }
        } catch (e) {}
        return null;
      });

      if (sessionStorageToken) return sessionStorageToken;

      // Méthode 3: Extraction depuis cookies
      const cookies = await page.context().cookies();
      const authCookie = cookies.find(cookie => 
        cookie.name.includes('auth') || 
        cookie.name.includes('token') ||
        cookie.name.includes('session')
      );

      if (authCookie && authCookie.value) {
        try {
          const decoded = JSON.parse(decodeURIComponent(authCookie.value));
          return decoded.access_token || decoded.accessToken || decoded.token;
        } catch (e) {
          return authCookie.value;
        }
      }

      return null;
    } catch (error) {
      console.warn('Erreur extraction token:', error);
      return null;
    }
  }

  private async rotateAndGetToken(page: Page): Promise<string | null> {
    // Utiliser une session différente si disponible
    const availableSessions = Array.from(this.sessions.values())
      .filter(session => session.isValid && Date.now() - session.timestamp < this.maxSessionAge);

    if (availableSessions.length > 0) {
      const rotatedSession = availableSessions[this.tokenRotationIndex % availableSessions.length];
      this.tokenRotationIndex++;

      try {
        // Restaurer les cookies de la session
        await page.context().addCookies(rotatedSession.cookies);
        
        // Mettre à jour le user agent
        await page.setExtraHTTPHeaders({
          'User-Agent': rotatedSession.userAgent
        });

        // Réessayer l'extraction
        return await this.extractTokenFromPage(page);
      } catch (error) {
        console.warn('Erreur rotation session:', error);
      }
    }

    return null;
  }

  async saveCurrentSession(page: Page): Promise<void> {
    try {
      const userAgent = await page.evaluate(() => navigator.userAgent);
      const sessionKey = this.generateSessionKey(userAgent);
      const cookies = await page.context().cookies();

      this.sessions.set(sessionKey, {
        cookies,
        userAgent,
        timestamp: Date.now(),
        isValid: true
      });

      console.log(`💾 Session sauvegardée: ${sessionKey}`);
    } catch (error) {
      console.warn('Erreur sauvegarde session:', error);
    }
  }

  async invalidateSession(userAgent: string): Promise<void> {
    const sessionKey = this.generateSessionKey(userAgent);
    this.tokens.delete(sessionKey);
    
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.isValid = false;
      this.sessions.set(sessionKey, session);
    }
  }

  private isTokenValid(token: AuthToken): boolean {
    return Date.now() < token.expiresAt;
  }

  private generateSessionKey(userAgent: string): string {
    // Créer une clé unique basée sur le user agent et l'heure
    const hash = this.simpleHash(userAgent + Date.now().toString().slice(0, -6)); // Précision à la minute
    return `session_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir en 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private startTokenCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Nettoyer les tokens expirés
      for (const [key, token] of this.tokens.entries()) {
        if (!this.isTokenValid(token)) {
          this.tokens.delete(key);
        }
      }

      // Nettoyer les sessions anciennes
      for (const [key, session] of this.sessions.entries()) {
        if (now - session.timestamp > this.maxSessionAge) {
          this.sessions.delete(key);
        }
      }
    }, 300000); // Nettoyage toutes les 5 minutes
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getValidTokenCount(): number {
    return Array.from(this.tokens.values()).filter(token => this.isTokenValid(token)).length;
  }
}