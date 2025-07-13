#!/usr/bin/env node

/**
 * Test rapide pour voir si le fix de l'extraction fonctionne
 */

async function testQuickExtraction() {
  try {
    console.log('🚀 Test rapide - extraction Fire Force saison 1 seulement');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    // Aller directement sur Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    // Tester l'extraction simple sur une seule saison
    console.log('🔍 Test extraction saison 1...');
    
    // Scroll pour charger les épisodes
    await driver.executeScript(`
      for(let i = 0; i < 3; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      window.scrollTo(0, 0);
    `);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Compter les épisodes visibles
    const episodeCount = await driver.executeScript(`
      const links = document.querySelectorAll('a[href*="/watch/"]');
      console.log('🎯 Total liens /watch/ trouvés:', links.length);
      
      // Compter par saison visible
      let s1Count = 0, s2Count = 0, s3Count = 0;
      for (const link of links) {
        const text = link.textContent?.toLowerCase() || '';
        if (text.includes('s1')) s1Count++;
        if (text.includes('s2')) s2Count++;
        if (text.includes('s3')) s3Count++;
      }
      
      console.log('📊 Episodes par saison visible - S1:', s1Count, 'S2:', s2Count, 'S3:', s3Count);
      
      return { total: links.length, s1: s1Count, s2: s2Count, s3: s3Count };
    `);
    
    console.log('📊 Résultats extraction:', episodeCount);
    
    // Tester la nouvelle extraction
    const episodes = await scraper.extractAllEpisodesSimple('GYQWNXPZY');
    
    console.log(`✅ Episodes extraits: ${episodes.length}`);
    console.log('📋 Premiers épisodes:');
    episodes.slice(0, 10).forEach((ep, i) => {
      console.log(`  ${i+1}. S${ep.seasonNumber}E${ep.episodeNumber} - "${ep.title.substring(0, 40)}"`);
    });
    
    const seasonCounts = episodes.reduce((acc, ep) => {
      acc[ep.seasonNumber] = (acc[ep.seasonNumber] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Episodes par saison extraite:', seasonCounts);
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testQuickExtraction().catch(console.error);