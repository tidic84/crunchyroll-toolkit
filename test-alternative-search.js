#!/usr/bin/env node

/**
 * Test de la méthode alternative de recherche
 */

async function testAlternativeSearch(query = 'Fire Force') {
  let scraper;
  
  try {
    console.log('🚀 Test méthode alternative');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    console.log(`🔍 Recherche alternative: "${query}"`);
    
    // Appeler directement la méthode alternative
    const result = await scraper.searchAnimeAlternative(query);
    
    if (result.success && result.data.length > 0) {
      console.log(`✅ ${result.data.length} résultats trouvés:`);
      result.data.forEach((anime, index) => {
        console.log(`${index + 1}. ${anime.title}`);
        console.log(`   URL: ${anime.url}`);
        console.log(`   ID: ${anime.id}`);
        console.log('');
      });
    } else {
      console.log(`❌ Échec: ${result.error}`);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

const query = process.argv[2] || 'Fire Force';
testAlternativeSearch(query);