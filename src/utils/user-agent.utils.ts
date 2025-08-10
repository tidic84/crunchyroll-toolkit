interface UserAgentProfile {
  userAgent: string;
  platform: string;
  acceptLanguage: string;
  viewport: { width: number; height: number };
  headers: Record<string, string>;
}

export class UserAgentManager {
  private profiles: UserAgentProfile[] = [
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Win32',
      acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8',
      viewport: { width: 1920, height: 1080 },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      }
    },
    {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      acceptLanguage: 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      viewport: { width: 1440, height: 900 },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'no-cache'
      }
    },
    {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'Linux x86_64',
      acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.5',
      viewport: { width: 1920, height: 1080 },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'cross-site',
        'Pragma': 'no-cache'
      }
    },
    {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      platform: 'Win32',
      acceptLanguage: 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
      viewport: { width: 1920, height: 1080 },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'DNT': '1'
      }
    },
    {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
      platform: 'MacIntel',
      acceptLanguage: 'fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3',
      viewport: { width: 1440, height: 900 },
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
      }
    }
  ];

  private currentProfileIndex = 0;
  private profileUsageCount: Map<number, number> = new Map();
  private profileLastUsed: Map<number, number> = new Map();
  private maxUsagePerProfile = 10;
  private cooldownPeriod = 300000; // 5 minutes

  getRandomProfile(): UserAgentProfile {
    const availableProfiles = this.profiles
      .map((_, index) => index)
      .filter(index => this.isProfileAvailable(index));

    if (availableProfiles.length === 0) {
      // Reset usage if all profiles are exhausted
      this.profileUsageCount.clear();
      this.profileLastUsed.clear();
      return this.profiles[Math.floor(Math.random() * this.profiles.length)];
    }

    const selectedIndex = availableProfiles[Math.floor(Math.random() * availableProfiles.length)];
    this.markProfileUsed(selectedIndex);
    
    return this.profiles[selectedIndex];
  }

  getNextProfile(): UserAgentProfile {
    let attempts = 0;
    const maxAttempts = this.profiles.length * 2;

    while (attempts < maxAttempts) {
      const profile = this.profiles[this.currentProfileIndex];
      const isAvailable = this.isProfileAvailable(this.currentProfileIndex);

      this.currentProfileIndex = (this.currentProfileIndex + 1) % this.profiles.length;
      attempts++;

      if (isAvailable) {
        this.markProfileUsed(this.currentProfileIndex - 1 >= 0 ? this.currentProfileIndex - 1 : this.profiles.length - 1);
        return profile;
      }
    }

    // Fallback: reset and return first profile
    this.profileUsageCount.clear();
    this.profileLastUsed.clear();
    this.markProfileUsed(0);
    return this.profiles[0];
  }

  generateDynamicHeaders(baseProfile: UserAgentProfile, endpoint?: string): Record<string, string> {
    const headers = { ...baseProfile.headers };
    
    // Add random timing headers
    const timestamp = Date.now();
    if (Math.random() > 0.5) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }
    
    // Vary cache control based on endpoint
    if (endpoint?.includes('search')) {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
    } else if (endpoint?.includes('api')) {
      headers['Cache-Control'] = 'max-age=300';
    }

    // Add realistic referrer
    if (Math.random() > 0.3) {
      const referrers = [
        'https://www.crunchyroll.com/',
        'https://www.crunchyroll.com/fr',
        'https://www.google.com/',
        'https://www.bing.com/'
      ];
      headers['Referer'] = referrers[Math.floor(Math.random() * referrers.length)];
    }

    // Random ordering of headers
    const orderedHeaders: Record<string, string> = {};
    const keys = Object.keys(headers).sort(() => Math.random() - 0.5);
    
    keys.forEach(key => {
      if (headers[key] !== undefined) {
        orderedHeaders[key] = headers[key];
      }
    });

    return orderedHeaders;
  }

  private isProfileAvailable(index: number): boolean {
    const usage = this.profileUsageCount.get(index) || 0;
    const lastUsed = this.profileLastUsed.get(index) || 0;
    const now = Date.now();

    // Check usage limit
    if (usage >= this.maxUsagePerProfile) {
      // Check if cooldown period has passed
      return now - lastUsed > this.cooldownPeriod;
    }

    return true;
  }

  private markProfileUsed(index: number): void {
    const currentUsage = this.profileUsageCount.get(index) || 0;
    this.profileUsageCount.set(index, currentUsage + 1);
    this.profileLastUsed.set(index, Date.now());
  }

  getProfileStats(): { totalProfiles: number; availableProfiles: number; usageStats: Array<{index: number; usage: number; lastUsed: number}> } {
    const now = Date.now();
    const availableProfiles = this.profiles.filter((_, index) => this.isProfileAvailable(index)).length;
    
    const usageStats = this.profiles.map((_, index) => ({
      index,
      usage: this.profileUsageCount.get(index) || 0,
      lastUsed: this.profileLastUsed.get(index) || 0
    }));

    return {
      totalProfiles: this.profiles.length,
      availableProfiles,
      usageStats
    };
  }

  resetAllProfiles(): void {
    this.profileUsageCount.clear();
    this.profileLastUsed.clear();
    this.currentProfileIndex = 0;
  }
}