#!/usr/bin/env node

/**
 * Test simple du nettoyage des titres
 */

async function testTitleCleaning() {
  try {
    console.log('🧪 Test Nettoyage des Titres');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    // Test du nettoyage des titres
    const titleTest = await driver.executeScript(`
      console.log('🧪 Test de nettoyage des titres...');
      
      const testTitles = [
        'S1 E1 - Shinra Kusakabe s\\'engage dans la FIRE FORCE',
        'S2 E2 - Le Cœur d\\'un membre de la Fire Force',
        'Episode 3 - Le Tournoi des nouvelles recrues',
        'Ep 4 - Le Héros et la Princesse',
        'Début des hostilités'  // Sans préfixe
      ];
      
      const cleanedTitles = [];
      
      testTitles.forEach(originalTitle => {
        let title = originalTitle;
        
        // Code de nettoyage exact du scraper
        if (title) {
          const beforeClean = title;
          
          // Supprimer les préfixes de saison/épisode car ils sont dans des champs séparés
          title = title.replace(/^S\\d+\\s*E\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Episode\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Ep\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          
          if (beforeClean !== title) {
            console.log('🧹 Titre nettoyé: "' + beforeClean + '" -> "' + title + '"');
          }
          
          cleanedTitles.push({
            original: originalTitle,
            cleaned: title,
            changed: beforeClean !== title
          });
        }
      });
      
      return cleanedTitles;
    `);
    
    console.log('\\n📊 RÉSULTATS DU TEST:');
    titleTest.forEach((test, i) => {
      console.log(`${i+1}. "${test.original}"`);
      console.log(`   -> "${test.cleaned}" ${test.changed ? '✅ Nettoyé' : '❌ Pas de changement'}`);
    });
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testTitleCleaning().catch(console.error);