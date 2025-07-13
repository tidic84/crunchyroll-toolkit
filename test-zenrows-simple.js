#!/usr/bin/env node

/**
 * Test ZenRows SIMPLE - Réplique exacte de test-simple.js
 * Version optimisée sans extraction détaillée
 */

async function testZenRowsSimple(input = 'Fire Force') {
  let scraper;
  
  try {
    console.log('🚀 Test ZenRows Simple');
    
    // Import du scraper ZenRows
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    // Création du scraper (timeout court)
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 20000
    });

    // Détection si input est une URL ou un titre
    const isUrl = input.startsWith('http');
    let anime, episodes = [];

    if (isUrl) {
      console.log('🔗 Mode URL');
      const detailsResult = await scraper.getAnimeDetails(input);
      if (!detailsResult.success) throw new Error(`Erreur détails: ${detailsResult.error}`);
      anime = detailsResult.data;

      // Simuler quelques épisodes pour test
      episodes = [
        {
          id: 'EP1',
          title: 'Épisode 1',
          episodeNumber: 1,
          seasonNumber: 1,
          url: input + '/episode-1',
          thumbnail: null,
          description: null,
          duration: null,
          releaseDate: null
        }
      ];
    } else {
      console.log('🔍 Mode recherche');
      const searchResult = await scraper.searchAnime(input);
      if (!searchResult.success || searchResult.data.length === 0) {
        throw new Error(`Aucun anime trouvé pour: ${input}`);
      }
      anime = searchResult.data[0];
      
      // Essayer de récupérer quelques épisodes (timeout court)
      console.log('📺 Tentative récupération épisodes (mode rapide)...');
      try {
        const episodesResult = await scraper.getEpisodes(anime.url);
        if (episodesResult.success) {
          episodes = episodesResult.data;
        } else {
          console.log('⚠️ Pas d\'épisodes récupérés, continuons avec anime seul');
        }
      } catch (error) {
        console.log('⚠️ Timeout épisodes, continuons avec anime seul');
      }
    }

    // Organisation des épisodes par saison
    const episodesBySeason = {};
    episodes.forEach(ep => {
      const season = ep.seasonNumber || 1;
      if (!episodesBySeason[season]) {
        episodesBySeason[season] = [];
      }
      episodesBySeason[season].push(ep);
    });

    // Construction du JSON de sortie (identique à test-simple.js)
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      input: input,
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
        scraper: 'zenrows-simple',
        zenrowsMethod: true,
        cloudflareBypass: true
      }
    };

    // Sortie JSON
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    // JSON d'erreur
    const errorResult = {
      success: false,
      timestamp: new Date().toISOString(),
      input: input,
      error: error.message,
      scraper: 'zenrows-simple'
    };
    
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

// Utilisation CLI
const input = process.argv[2] || 'Fire Force';
testZenRowsSimple(input).catch(error => {
  console.log(JSON.stringify({
    success: false,
    timestamp: new Date().toISOString(),
    input: input,
    error: error.message,
    scraper: 'zenrows-simple'
  }, null, 2));
  process.exit(1);
});