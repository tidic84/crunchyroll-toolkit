#!/usr/bin/env node

/**
 * Test complet ZenRows - Toutes les fonctionnalités
 * Recherche + Détails + Épisodes avec ZenRows Method
 */

async function testZenRowsComplete(input = 'Fire Force') {
  let scraper;
  
  try {
    console.log('🚀 Test COMPLET ZenRows Method');
    console.log('🎯 Recherche + Détails + Épisodes');
    console.log('📖 Selenium Node.js + undetected-chromedriver executable');
    
    // Import du scraper ZenRows
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    // Création du scraper selon ZenRows
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,  // Mode visible pour debug
      timeout: 60000,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });

    console.log(`\n🔍 ÉTAPE 1: Recherche "${input}"`);
    console.log('='.repeat(50));
    
    // Test de recherche avec ZenRows Method
    const searchResult = await scraper.searchAnime(input);
    
    if (!searchResult.success) {
      throw new Error(`Erreur recherche ZenRows: ${searchResult.error}`);
    }
    
    if (searchResult.data.length === 0) {
      throw new Error(`Aucun anime trouvé pour: ${input}`);
    }
    
    const anime = searchResult.data[0];
    console.log(`✅ Anime trouvé: ${anime.title}`);
    console.log(`🔗 URL: ${anime.url}`);
    
    console.log(`\n📋 ÉTAPE 2: Récupération des détails`);
    console.log('='.repeat(50));
    
    // Récupération des détails complets
    const detailsResult = await scraper.getAnimeDetails(anime.url);
    
    if (!detailsResult.success) {
      console.log(`⚠️ Erreur détails: ${detailsResult.error}`);
    } else {
      const details = detailsResult.data;
      console.log(`✅ Détails récupérés pour: ${details.title}`);
      
      // Fusionner les données
      Object.assign(anime, details);
    }
    
    console.log(`\n📺 ÉTAPE 3: Récupération des épisodes`);
    console.log('='.repeat(50));
    
    // Récupération des épisodes
    const episodesResult = await scraper.getEpisodes(anime.url);
    
    if (!episodesResult.success) {
      console.log(`⚠️ Erreur épisodes: ${episodesResult.error}`);
    }
    
    const episodes = episodesResult.success ? episodesResult.data : [];
    
    // Organisation des épisodes par saison
    const episodesBySeason = {};
    episodes.forEach(ep => {
      const season = ep.seasonNumber || 1;
      if (!episodesBySeason[season]) {
        episodesBySeason[season] = [];
      }
      episodesBySeason[season].push(ep);
    });
    
    console.log(`\n🎉 RÉSULTAT FINAL`);
    console.log('='.repeat(50));
    
    // Construction du JSON de sortie complet
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'zenrows-complete-scraping',
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
        episodeCount: anime.episodeCount || episodes.length
      },
      
      seasons: Object.keys(episodesBySeason)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(seasonNum => ({
          seasonNumber: parseInt(seasonNum),
          episodeCount: episodesBySeason[seasonNum].length,
          episodes: episodesBySeason[seasonNum].map(ep => ({
            id: ep.id,
            title: ep.title,
            episodeNumber: ep.episodeNumber,
            url: ep.url,
            thumbnail: ep.thumbnail || null,
            description: ep.description || null,
            duration: ep.duration || null,
            releaseDate: ep.releaseDate ? ep.releaseDate.toISOString() : null
          }))
        })),
        
      summary: {
        totalSeasons: Object.keys(episodesBySeason).length,
        totalEpisodes: episodes.length,
        episodesWithThumbnails: episodes.filter(ep => ep.thumbnail).length,
        episodesWithDescriptions: episodes.filter(ep => ep.description).length,
        scraper: 'zenrows-method-complete',
        seleniumNodejs: true,
        undetectedExecutable: true,
        functionsImplemented: [
          'searchAnime',
          'getAnimeDetails', 
          'getEpisodes'
        ]
      },
      
      searchResults: searchResult.data.map(a => ({
        id: a.id,
        title: a.title,
        url: a.url,
        thumbnail: a.thumbnail || null,
        genres: a.genres || []
      }))
    };

    // Sortie JSON finale
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    // JSON d'erreur
    const errorResult = {
      success: false,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'zenrows-complete-scraping',
      error: error.message,
      scraper: 'zenrows-method-complete'
    };
    
    console.log('\n❌ ERREUR COMPLÈTE:');
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  } finally {
    if (scraper) {
      console.log('\n🧹 Nettoyage ZenRows complet...');
      await scraper.close();
    }
  }
}

// Utilisation CLI
const input = process.argv[2] || 'Fire Force';
testZenRowsComplete(input).catch(error => {
  console.log(JSON.stringify({
    success: false,
    timestamp: new Date().toISOString(),
    input: input,
    method: 'zenrows-complete-scraping',
    error: error.message,
    scraper: 'zenrows-method-complete'
  }, null, 2));
  process.exit(1);
});