#!/usr/bin/env node

/**
 * Debug pour voir les URLs trouvées dans la recherche
 */

async function debugSearchUrls(input = 'Fire Force') {
  let scraper;
  
  try {
    console.log('🚀 Debug URLs recherche');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 20000
    });

    console.log('🔍 Recherche...');
    const searchResult = await scraper.searchAnime(input);
    
    if (!searchResult.success || searchResult.data.length === 0) {
      throw new Error(`Aucun anime trouvé pour: ${input}`);
    }
    
    console.log(`✅ ${searchResult.data.length} résultats trouvés:`);
    searchResult.data.forEach((anime, index) => {
      console.log(`${index + 1}. ${anime.title}`);
      console.log(`   URL: ${anime.url}`);
      console.log(`   ID: ${anime.id}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

const input = process.argv[2] || 'Fire Force';
debugSearchUrls(input);