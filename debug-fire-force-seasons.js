#!/usr/bin/env node

/**
 * Debug Fire Force - Analyser la structure des saisons
 */

async function debugFireForceSeasons() {
  let scraper;
  
  try {
    console.log('🔍 Debug Fire Force Saisons');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Naviguer vers Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();

    // Analyser la structure complète de la page
    const analysis = await driver.executeScript(`
      console.log('🔍 Analyse détaillée de la page Fire Force...');
      
      const result = {
        title: document.title,
        url: window.location.href,
        seasonSelectors: [],
        allInteractiveElements: [],
        suspiciousElements: []
      };
      
      // 1. Chercher tous les éléments interactifs
      const interactiveElements = document.querySelectorAll('button, select, [role="button"], [role="option"], [role="tab"], a');
      
      interactiveElements.forEach((el, index) => {
        const text = el.textContent?.trim() || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const className = el.className || '';
        const tagName = el.tagName;
        
        if (text.length < 100) {
          result.allInteractiveElements.push({
            index: index,
            tag: tagName,
            text: text,
            ariaLabel: ariaLabel,
            className: className,
            id: el.id || ''
          });
        }
        
        // Chercher spécifiquement des mentions de saisons
        if (
          text.toLowerCase().includes('season') ||
          text.toLowerCase().includes('saison') ||
          text.match(/s[1-9]/i) ||
          ariaLabel.toLowerCase().includes('season') ||
          ariaLabel.toLowerCase().includes('saison') ||
          className.toLowerCase().includes('season')
        ) {
          result.seasonSelectors.push({
            index: index,
            tag: tagName,
            text: text,
            ariaLabel: ariaLabel,
            className: className,
            type: 'season-related'
          });
        }
        
        // Éléments suspects (dropdown, navigation)
        if (
          tagName === 'SELECT' ||
          el.getAttribute('role') === 'listbox' ||
          el.getAttribute('role') === 'option' ||
          text.toLowerCase().includes('suivant') ||
          text.toLowerCase().includes('précédent') ||
          text.toLowerCase().includes('next') ||
          text.toLowerCase().includes('previous') ||
          className.toLowerCase().includes('dropdown') ||
          className.toLowerCase().includes('select')
        ) {
          result.suspiciousElements.push({
            index: index,
            tag: tagName,
            text: text,
            ariaLabel: ariaLabel,
            className: className,
            role: el.getAttribute('role'),
            type: 'navigation'
          });
        }
      });
      
      // 2. Chercher dans le DOM pour des patterns de saisons
      const bodyText = document.body.textContent || '';
      result.hasMultiSeasonIndicators = {
        season2: bodyText.includes('Season 2') || bodyText.includes('Saison 2'),
        season3: bodyText.includes('Season 3') || bodyText.includes('Saison 3'),
        s2: bodyText.includes('S2'),
        s3: bodyText.includes('S3')
      };
      
      // 3. Chercher les compteurs d'épisodes
      const episodeCounters = [];
      const potentialCounters = document.querySelectorAll('[class*="count"], [class*="total"], [aria-label*="episode"]');
      potentialCounters.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.match(/\\d+/)) {
          episodeCounters.push(text);
        }
      });
      result.episodeCounters = episodeCounters;
      
      return result;
    `);

    console.log('📊 ANALYSE COMPLETE:');
    console.log('Title:', analysis.title);
    console.log('\\n🎬 SEASON SELECTORS FOUND:', analysis.seasonSelectors.length);
    analysis.seasonSelectors.forEach((sel, i) => {
      console.log(`  ${i+1}. [${sel.tag}] "${sel.text}" (aria: "${sel.ariaLabel}") (class: "${sel.className}")`);
    });
    
    console.log('\\n🔍 SUSPICIOUS NAVIGATION ELEMENTS:', analysis.suspiciousElements.length);
    analysis.suspiciousElements.forEach((sus, i) => {
      console.log(`  ${i+1}. [${sus.tag}] "${sus.text}" (role: "${sus.role}") (class: "${sus.className}")`);
    });
    
    console.log('\\n📈 MULTI-SEASON INDICATORS:');
    console.log('  Season 2/Saison 2:', analysis.hasMultiSeasonIndicators.season2);
    console.log('  Season 3/Saison 3:', analysis.hasMultiSeasonIndicators.season3);
    console.log('  S2:', analysis.hasMultiSeasonIndicators.s2);
    console.log('  S3:', analysis.hasMultiSeasonIndicators.s3);
    
    console.log('\\n📺 EPISODE COUNTERS:', analysis.episodeCounters);
    
    console.log('\\n🔧 ALL INTERACTIVE ELEMENTS (first 20):');
    analysis.allInteractiveElements.slice(0, 20).forEach((el, i) => {
      console.log(`  ${i+1}. [${el.tag}] "${el.text}" (id: "${el.id}") (class: "${el.className}")`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

debugFireForceSeasons().catch(console.error);