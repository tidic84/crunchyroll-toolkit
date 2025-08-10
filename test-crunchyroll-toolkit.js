#!/usr/bin/env node

/**
 * Test Crunchyroll Toolkit complet - Recherche et récupération complète d'épisodes
 * Recherche + Récupération de TOUS les épisodes de TOUTES les saisons
 */

async function testCrunchyrollToolkitEpisodes(input = 'Fire Force') {
  let scraper;
  
  try {
    console.log('Test Crunchyroll Toolkit - Épisodes complets');
    console.log(`Input: "${input}"`);
    
    // Import du scraper Crunchyroll Toolkit
    const { createCrunchyrollToolkitScraper } = require('./lib/crunchyroll-toolkit.index');
    
    // Création du scraper Crunchyroll Toolkit (optimisé pour vitesse)
    scraper = await createCrunchyrollToolkitScraper({
      headless: true,
      timeout: 30000
    });

    // Détection si input est une URL ou un titre
    const isUrl = input.startsWith('http');
    let anime, episodes;

    if (isUrl) {
      console.log('Mode URL - Récupération directe');
      
      // Extraire les informations depuis l'URL
      const urlMatch = input.match(/\/series\/([A-Z0-9]+)\/([^/?]+)/);
      if (!urlMatch) throw new Error('URL invalide');
      
      anime = {
        id: urlMatch[1],
        title: urlMatch[2].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        url: input,
        releaseYear: null,
        episodeCount: null
      };

      console.log('Récupération des épisodes...');
      const episodesResult = await scraper.getEpisodes(input);
      if (!episodesResult.success) throw new Error(`Erreur épisodes: ${episodesResult.error}`);
      episodes = episodesResult.data;
      
    } else {
      console.log('Mode recherche par titre');
      
      // Recherche par titre
      const searchResult = await scraper.searchAnime(input);
      if (!searchResult.success || searchResult.data.length === 0) {
        throw new Error(`Aucun anime trouvé pour: ${input}`);
      }
      anime = searchResult.data[0];
      console.log(`Trouvé: ${anime.title}`);

      console.log('Récupération des épisodes...');
      const episodesResult = await scraper.getEpisodes(anime.url);
      if (!episodesResult.success) throw new Error(`Erreur épisodes: ${episodesResult.error}`);
      episodes = episodesResult.data;
      
      // Enrichir l'anime avec les métadonnées extraites si disponibles
      if (episodesResult.metadata) {
        anime.releaseYear = anime.releaseYear || episodesResult.metadata.releaseYear;
      }
    }

    console.log(`Total épisodes récupérés: ${episodes.length}`);

    // Organisation des épisodes par saison (comme dans test-simple.js)
    const episodesBySeason = {};
    episodes.forEach(ep => {
      const season = ep.seasonNumber || 1;
      if (!episodesBySeason[season]) {
        episodesBySeason[season] = [];
      }
      episodesBySeason[season].push(ep);
    });

    console.log(`Saisons trouvées: ${Object.keys(episodesBySeason).length}`);

    // Affichage du résumé par saison
    Object.keys(episodesBySeason).sort((a, b) => parseInt(a) - parseInt(b)).forEach(seasonNum => {
      const seasonEpisodes = episodesBySeason[seasonNum];
      console.log(`  Saison ${seasonNum}: ${seasonEpisodes.length} épisodes`);
    });

    // Construction du JSON de sortie (structure identique à test-simple.js)
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'crunchyroll-toolkit-episodes',
      
      anime: {
        id: anime.id,
        title: anime.title,
        url: anime.url,
        releaseYear: anime.releaseYear || null,
        episodeCount: anime.episodeCount || episodes.length
      },
      
      seasons: Object.keys(episodesBySeason)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(seasonNum => ({
          seasonNumber: parseInt(seasonNum),
          episodeCount: episodesBySeason[seasonNum].length,
          episodes: episodesBySeason[seasonNum]
            .sort((a, b) => a.episodeNumber - b.episodeNumber)
            .map(ep => ({
              id: ep.id,
              title: ep.title,
              episodeNumber: ep.episodeNumber,
              seasonNumber: ep.seasonNumber || parseInt(seasonNum),
              url: ep.url,
              duration: ep.duration || null
            }))
        })),
        
      summary: {
        totalSeasons: Object.keys(episodesBySeason).length,
        totalEpisodes: episodes.length,
        scraper: 'crunchyroll-toolkit'
      }
    };

    // Sortie JSON finale
    console.log('\nRÉSULTAT FINAL:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    // JSON d'erreur
    const errorResult = {
      success: false,
      timestamp: new Date().toISOString(),
      input: input,
      method: 'crunchyroll-toolkit-episodes',
      error: error.message,
      scraper: 'crunchyroll-toolkit'
    };
    
    console.log('\nERREUR:');
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  } finally {
    if (scraper) {
      console.log('\nFermeture scraper...');
      await scraper.close();
    }
  }
}

// Utilisation CLI
const input = process.argv[2] || 'Fire Force';
testCrunchyrollToolkitEpisodes(input).catch(error => {
  console.log(JSON.stringify({
    success: false,
    timestamp: new Date().toISOString(),
    input: input,
    method: 'crunchyroll-toolkit-episodes',
    error: error.message,
    scraper: 'crunchyroll-toolkit'
  }, null, 2));
  process.exit(1);
});
