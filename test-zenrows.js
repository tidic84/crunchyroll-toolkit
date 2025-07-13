#!/usr/bin/env node

/**
 * Test avec la VRAIE méthode ZenRows
 * Selenium Node.js + undetected-chromedriver executable
 */

async function testZenRowsMethod(input = 'Fire Force') {
  let scraper;
  
  try {
    console.log('🚀 Test VRAIE méthode ZenRows');
    console.log('🎯 Selenium Node.js + undetected-chromedriver executable');
    console.log('📖 Suivant exactement le tutoriel ZenRows');
    
    // Import du scraper ZenRows
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    // Création du scraper selon ZenRows
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,  // Mode visible pour debug
      timeout: 60000,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });

    console.log(`🔍 Recherche: "${input}"`);
    
    // Test de recherche avec ZenRows Method
    const searchResult = await scraper.searchAnime(input);
    
    if (!searchResult.success) {
      throw new Error(`Erreur recherche ZenRows: ${searchResult.error}`);
    }
    
    if (searchResult.data.length === 0) {
      throw new Error(`Aucun anime trouvé pour: ${input}`);
    }
    
    const anime = searchResult.data[0];
    console.log(`✅ Trouvé avec ZenRows: ${anime.title}`);
    
    // Construction du JSON de sortie
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'zenrows-selenium-undetected-executable',
      tutorialFollowed: 'https://www.zenrows.com/blog/undetected-chromedriver-nodejs',
      anime: {
        id: anime.id,
        title: anime.title,
        url: anime.url,
        thumbnail: anime.thumbnail || null,
        description: anime.description || null,
        genres: anime.genres || [],
        releaseYear: anime.releaseYear || null,
        rating: anime.rating || null,
        episodeCount: anime.episodeCount || null
      },
      totalResults: searchResult.data.length,
      allResults: searchResult.data.map(a => ({
        id: a.id,
        title: a.title,
        url: a.url
      })),
      summary: {
        scraper: 'zenrows-method-exact',
        seleniumNodejs: true,
        undetectedExecutable: true,
        tutorialCompliant: true
      }
    };

    // Sortie JSON
    console.log('\n📋 RÉSULTAT ZENROWS:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    // JSON d'erreur
    const errorResult = {
      success: false,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'zenrows-selenium-undetected-executable',
      error: error.message,
      scraper: 'zenrows-method-exact'
    };
    
    console.log('\n❌ ERREUR ZENROWS:');
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  } finally {
    if (scraper) {
      console.log('\n🧹 Nettoyage ZenRows...');
      await scraper.close();
    }
  }
}

// Utilisation CLI
const input = process.argv[2] || 'Fire Force';
testZenRowsMethod(input).catch(error => {
  console.log(JSON.stringify({
    success: false,
    timestamp: new Date().toISOString(),
    input: input,
    method: 'zenrows-selenium-undetected-executable',
    error: error.message,
    scraper: 'zenrows-method-exact'
  }, null, 2));
  process.exit(1);
});