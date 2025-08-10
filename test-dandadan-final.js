const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function testDanDaDanFinal() {
  console.log('🎯 Test final DAN DA DAN - Vérification complète');
  
  const scraper = new CrunchyrollToolkitScraper({
    headless: true,
    timeout: 30000
  });

  try {
    await scraper.initialize();
    
    console.log('📺 Extraction des épisodes DAN DA DAN...');
    const allEpisodes = await scraper.extractAllEpisodesSimple('GG5H5XQ0D');
    
    console.log(`\n📊 RÉSULTATS FINAUX:`);
    console.log(`Total: ${allEpisodes.length} épisodes`);
    
    // Analyser les saisons
    const seasonStats = {};
    allEpisodes.forEach(ep => {
      if (!seasonStats[ep.seasonNumber]) {
        seasonStats[ep.seasonNumber] = [];
      }
      seasonStats[ep.seasonNumber].push(ep);
    });
    
    Object.keys(seasonStats).forEach(season => {
      console.log(`Saison ${season}: ${seasonStats[season].length} épisodes`);
    });
    
    console.log(`\n🔍 VÉRIFICATION FILTRAGE:`);
    
    // Vérifier qu'il n'y a plus de liens de lecture générique
    const lectureTitles = allEpisodes.filter(ep => 
      ep.title.toLowerCase().includes('lecture') ||
      ep.title.includes('Lecture Season') ||
      ep.title.match(/^lecture\s+season\s+\d+\s+episode\s+\d+/i)
    );
    
    if (lectureTitles.length === 0) {
      console.log(`✅ Aucun lien de lecture générique détecté`);
    } else {
      console.log(`❌ ${lectureTitles.length} liens de lecture générique encore présents:`);
      lectureTitles.forEach(ep => {
        console.log(`  - S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
    }
    
    // Vérifier les numéros d'épisodes
    const invalidEpisodes = allEpisodes.filter(ep => 
      ep.episodeNumber <= 0 || ep.episodeNumber >= 100
    );
    
    if (invalidEpisodes.length === 0) {
      console.log(`✅ Tous les numéros d'épisodes sont valides (1-99)`);
    } else {
      console.log(`❌ ${invalidEpisodes.length} épisodes avec numéros invalides:`);
      invalidEpisodes.forEach(ep => {
        console.log(`  - S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
    }
    
    console.log(`\n📺 APERÇU DES ÉPISODES:`);
    
    // Montrer les premiers épisodes de chaque saison
    Object.keys(seasonStats).sort().forEach(season => {
      const episodes = seasonStats[season].sort((a, b) => a.episodeNumber - b.episodeNumber);
      console.log(`\nSaison ${season} (${episodes.length} épisodes):`);
      episodes.slice(0, 3).forEach(ep => {
        console.log(`  S${ep.seasonNumber}E${ep.episodeNumber}: ${ep.title}`);
      });
      if (episodes.length > 3) {
        console.log(`  ... et ${episodes.length - 3} autres`);
      }
    });
    
    // Verdict final
    const expectedMinEpisodes = 15;
    const expectedSeasons = ['1', '2'];
    const actualSeasons = Object.keys(seasonStats);
    
    console.log(`\n🎯 VERDICT FINAL:`);
    
    const hasEnoughEpisodes = allEpisodes.length >= expectedMinEpisodes;
    const hasAllSeasons = expectedSeasons.every(s => actualSeasons.includes(s));
    const noLectureLinks = lectureTitles.length === 0;
    const validEpisodeNumbers = invalidEpisodes.length === 0;
    
    console.log(`Episodes totaux: ${allEpisodes.length} >= ${expectedMinEpisodes} ? ${hasEnoughEpisodes ? '✅' : '❌'}`);
    console.log(`Saisons présentes: ${actualSeasons.join(', ')} includes ${expectedSeasons.join(', ')} ? ${hasAllSeasons ? '✅' : '❌'}`);
    console.log(`Pas de liens génériques: ${noLectureLinks ? '✅' : '❌'}`);
    console.log(`Numéros d'épisodes valides: ${validEpisodeNumbers ? '✅' : '❌'}`);
    
    if (hasEnoughEpisodes && hasAllSeasons && noLectureLinks && validEpisodeNumbers) {
      console.log(`\n🎉 SUCCÈS COMPLET ! Le problème DAN DA DAN est résolu !`);
    } else {
      console.log(`\n⚠️ Problèmes restants détectés`);
    }
    
  } catch (error) {
    console.error('❌ Erreur test final:', error.message);
  } finally {
    await scraper.close();
  }
}

testDanDaDanFinal().catch(console.error);