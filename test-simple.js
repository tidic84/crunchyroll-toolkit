#!/usr/bin/env node

/**
 * Test simple universel pour scraper Crunchyroll
 * Retourne uniquement un JSON avec les données récupérées
 */

const { createCrunchyrollScraper } = require('./lib/index');

async function testSimple(input = 'Fire Force') {
  let scraper;
  
  try {
    // Création du scraper avec configuration minimale
    scraper = await createCrunchyrollScraper({
      headless: false,
      timeout: 60000
    });

    // Détection si input est une URL ou un titre
    const isUrl = input.startsWith('http');
    let anime, episodes;

    if (isUrl) {
      // Récupération directe depuis l'URL
      const detailsResult = await scraper.getAnimeDetails(input);
      if (!detailsResult.success) throw new Error(`Erreur détails: ${detailsResult.error}`);
      anime = detailsResult.data;

      const episodesResult = await scraper.getEpisodes(input);
      if (!episodesResult.success) throw new Error(`Erreur épisodes: ${episodesResult.error}`);
      episodes = episodesResult.data;
    } else {
      // Recherche par titre
      const searchResult = await scraper.searchAnime(input);
      if (!searchResult.success || searchResult.data.length === 0) {
        throw new Error(`Aucun anime trouvé pour: ${input}`);
      }
      anime = searchResult.data[0];

      const episodesResult = await scraper.getEpisodes(anime.url);
      if (!episodesResult.success) throw new Error(`Erreur épisodes: ${episodesResult.error}`);
      episodes = episodesResult.data;
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

    // Construction du JSON de sortie
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
        scraper: 'crunchyroll-toolkit'
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
      scraper: 'crunchyroll-advanced'
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
testSimple(input).catch(error => {
  console.log(JSON.stringify({
    success: false,
    timestamp: new Date().toISOString(),
    input: input,
    error: error.message,
    scraper: 'crunchyroll-advanced'
  }, null, 2));
  process.exit(1);
});
