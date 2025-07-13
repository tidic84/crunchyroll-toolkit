#!/usr/bin/env node

/**
 * Test simple: vérifier si on peut accéder à la homepage Crunchyroll
 */

async function testHomepageAccess() {
  let scraper;
  
  try {
    console.log('🚀 Test accès homepage Crunchyroll');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    console.log('🌐 Navigation vers homepage...');
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr');
    
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    const title = await scraper.browserManager.getTitle();
    const url = await scraper.browserManager.getCurrentUrl();
    
    console.log(`📄 Titre: "${title}"`);
    console.log(`🔗 URL: ${url}`);
    
    // Vérifier le contenu de la page
    const pageSource = await scraper.browserManager.getPageSource();
    const hasSeriesLinks = pageSource.includes('href="/series/') || pageSource.includes('href="/fr/series/');
    const hasChallenge = pageSource.includes('Un instant') || pageSource.includes('challenge');
    
    console.log(`🔍 Analyse page:`);
    console.log(`   - Liens série détectés: ${hasSeriesLinks ? '✅' : '❌'}`);
    console.log(`   - Challenge détecté: ${hasChallenge ? '⚠️' : '✅'}`);
    console.log(`   - Taille HTML: ${Math.round(pageSource.length / 1024)}KB`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

testHomepageAccess();