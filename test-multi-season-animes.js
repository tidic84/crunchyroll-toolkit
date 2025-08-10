const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function testMultiSeasonAnimes() {
  console.log('🧪 Test général - Animés multi-saisons');
  
  const scraper = new CrunchyrollToolkitScraper({
    headless: true,
    timeout: 30000
  });

  // Liste d'animés connus pour avoir plusieurs saisons
  const testAnimes = [
    {
      name: "Attack on Titan",
      searchTerm: "Attack on Titan",
      expectedSeasons: "3+",
      expectedMinEpisodes: 70
    },
    {
      name: "My Hero Academia", 
      searchTerm: "My Hero Academia",
      expectedSeasons: "6+",
      expectedMinEpisodes: 100
    },
    {
      name: "Demon Slayer",
      searchTerm: "Demon Slayer",
      expectedSeasons: "2+", 
      expectedMinEpisodes: 30
    }
  ];

  try {
    await scraper.initialize();
    
    for (const anime of testAnimes) {
      console.log(`\n🎯 Test: ${anime.name}`);
      console.log(`Recherche: "${anime.searchTerm}"`);
      
      try {
        // Rechercher l'anime
        const searchResult = await scraper.searchAnime(anime.searchTerm);
        
        if (!searchResult.success || searchResult.data.length === 0) {
          console.log(`❌ ${anime.name}: Introuvable sur Crunchyroll`);
          continue;
        }
        
        const foundAnime = searchResult.data[0];
        console.log(`✅ Trouvé: ${foundAnime.title} (ID: ${foundAnime.id})`);
        
        // Extraire les épisodes
        console.log(`📺 Extraction des épisodes...`);
        const episodes = await scraper.extractAllEpisodesSimple(foundAnime.id);
        
        // Analyser les saisons
        const seasonStats = {};
        episodes.forEach(ep => {
          if (!seasonStats[ep.seasonNumber]) {
            seasonStats[ep.seasonNumber] = 0;
          }
          seasonStats[ep.seasonNumber]++;
        });
        
        const seasonsFound = Object.keys(seasonStats).length;
        const totalEpisodes = episodes.length;
        
        console.log(`📊 Résultats ${anime.name}:`);
        console.log(`  Total: ${totalEpisodes} épisodes`);
        console.log(`  Saisons: ${seasonsFound}`);
        
        Object.keys(seasonStats).forEach(season => {
          console.log(`    Saison ${season}: ${seasonStats[season]} épisodes`);
        });
        
        // Évaluation
        const hasMultipleSeasons = seasonsFound > 1;
        const hasEnoughEpisodes = totalEpisodes >= anime.expectedMinEpisodes;
        
        console.log(`  Plusieurs saisons détectées: ${hasMultipleSeasons ? '✅' : '❌'}`);
        console.log(`  Nombre d'épisodes suffisant: ${hasEnoughEpisodes ? '✅' : '❌'}`);
        
        if (hasMultipleSeasons && hasEnoughEpisodes) {
          console.log(`🎉 ${anime.name}: SUCCÈS complet!`);
        } else if (hasEnoughEpisodes) {
          console.log(`⚠️ ${anime.name}: Episodes OK mais saisons non détectées`);
        } else {
          console.log(`❌ ${anime.name}: Problème d'extraction`);
        }
        
      } catch (error) {
        console.log(`❌ ${anime.name}: Erreur - ${error.message}`);
      }
      
      // Pause entre les tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n📊 RÉSUMÉ DU TEST GÉNÉRAL:');
    console.log('Test terminé pour tous les animés de la liste');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
  } finally {
    await scraper.close();
  }
}

testMultiSeasonAnimes().catch(console.error);