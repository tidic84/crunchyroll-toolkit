#!/usr/bin/env node

/**
 * Test avec Selenium + undetected-chromedriver Python
 * Suit la vraie méthode ZenRows
 */

async function testSelenium(input = 'Fire Force') {
  let scraper;
  
  try {
    console.log('🚀 Test Selenium + undetected-chromedriver');
    console.log('📖 Suivant la méthode ZenRows officielle');
    
    // Import dynamique du scraper Selenium
    const { createSeleniumCrunchyrollScraper } = require('./lib/selenium.index');
    
    // Création du scraper Selenium
    scraper = await createSeleniumCrunchyrollScraper({
      headless: false,  // On commence en mode visible pour debug
      timeout: 60000
    });

    console.log(`🔍 Recherche: "${input}"`);
    
    // Test de recherche
    const searchResult = await scraper.searchAnime(input);
    
    if (!searchResult.success) {
      throw new Error(`Erreur recherche: ${searchResult.error}`);
    }
    
    if (searchResult.data.length === 0) {
      throw new Error(`Aucun anime trouvé pour: ${input}`);
    }
    
    const anime = searchResult.data[0];
    console.log(`✅ Trouvé: ${anime.title}`);
    
    // Construction du JSON de sortie
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'selenium-undetected-chromedriver',
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
        scraper: 'selenium-undetected-chromedriver',
        zenrowsMethod: true,
        pythonDriver: true
      }
    };

    // Sortie JSON
    console.log('\n📋 RÉSULTAT:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    // JSON d'erreur
    const errorResult = {
      success: false,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'selenium-undetected-chromedriver',
      error: error.message,
      scraper: 'selenium-undetected-chromedriver'
    };
    
    console.log('\n❌ ERREUR:');
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  } finally {
    if (scraper) {
      console.log('\n🧹 Nettoyage...');
      await scraper.close();
    }
  }
}

// Utilisation CLI
const input = process.argv[2] || 'Fire Force';
testSelenium(input).catch(error => {
  console.log(JSON.stringify({
    success: false,
    timestamp: new Date().toISOString(),
    input: input,
    method: 'selenium-undetected-chromedriver',
    error: error.message,
    scraper: 'selenium-undetected-chromedriver'
  }, null, 2));
  process.exit(1);
});