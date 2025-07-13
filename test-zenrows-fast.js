#!/usr/bin/env node

/**
 * Test rapide ZenRows - Fonctionnalités essentielles
 * Recherche seulement avec détails enrichis
 */

async function testZenRowsFast(input = 'Fire Force') {
  let scraper;
  
  try {
    console.log('🚀 Test RAPIDE ZenRows Method');
    console.log('🎯 Recherche avec détails enrichis');
    
    // Import du scraper ZenRows
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    // Création du scraper selon ZenRows
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,  // Mode visible pour debug
      timeout: 30000,   // Timeout réduit
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });

    console.log(`\n🔍 Recherche: "${input}"`);
    
    // Test de recherche avec détails enrichis
    const searchResult = await scraper.searchAnime(input);
    
    if (!searchResult.success) {
      throw new Error(`Erreur recherche ZenRows: ${searchResult.error}`);
    }
    
    if (searchResult.data.length === 0) {
      throw new Error(`Aucun anime trouvé pour: ${input}`);
    }
    
    console.log(`✅ ${searchResult.data.length} anime(s) trouvé(s)`);
    
    // Prendre le premier résultat
    const anime = searchResult.data[0];
    
    // Construction du JSON de sortie
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'zenrows-fast-search',
      
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
      
      searchResults: searchResult.data.map(a => ({
        id: a.id,
        title: a.title,
        url: a.url,
        thumbnail: a.thumbnail || null,
        description: a.description || null,
        genres: a.genres || [],
        releaseYear: a.releaseYear || null
      })),
      
      summary: {
        totalResults: searchResult.data.length,
        resultsWithThumbnails: searchResult.data.filter(a => a.thumbnail).length,
        resultsWithDescriptions: searchResult.data.filter(a => a.description).length,
        resultsWithGenres: searchResult.data.filter(a => a.genres && a.genres.length > 0).length,
        scraper: 'zenrows-method-fast',
        seleniumNodejs: true,
        undetectedExecutable: true,
        cloudflareBypass: true
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
      method: 'zenrows-fast-search',
      error: error.message,
      scraper: 'zenrows-method-fast'
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
testZenRowsFast(input).catch(error => {
  console.log(JSON.stringify({
    success: false,
    timestamp: new Date().toISOString(),
    input: input,
    method: 'zenrows-fast-search',
    error: error.message,
    scraper: 'zenrows-method-fast'
  }, null, 2));
  process.exit(1);
});