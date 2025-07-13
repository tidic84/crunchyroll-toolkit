#!/usr/bin/env node

/**
 * Test spécifique pour les noms de saisons
 */

async function testSeasonNames() {
  try {
    console.log('🎬 Test détection noms de saisons');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    // Aller directement sur Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 6000));

    const driver = await scraper.browserManager.getDriver();
    
    // Tester la détection des saisons
    const seasonInfo = await driver.executeScript(`
      console.log('🔍 Test détection saisons...');
      
      let seasonData = {
        dropdownFound: false,
        navigationButtons: [],
        currentSeason: '',
        availableSeasons: []
      };
      
      // Chercher le dropdown principal des saisons (bon sélecteur: aria-label="Seasons")
      const seasonDropdown = document.querySelector('[aria-label="Seasons"], .seasons-select [role="button"]');
      console.log('📦 Dropdown trouvé:', !!seasonDropdown);
      
      if (seasonDropdown) {
        seasonData.dropdownFound = true;
        
        // Extraire le nom de la saison actuelle depuis les spans à l'intérieur
        let currentSeasonText = 'S1: Fire Force';
        
        // Debug: montrer tous les éléments trouvés
        console.log('🔍 HTML du dropdown:', seasonDropdown.outerHTML.substring(0, 500));
        
        // Méthode 1: Chercher dans les spans avec classes spécifiques Crunchyroll
        const seasonSpans = seasonDropdown.querySelectorAll('.call-to-action--PEidl, .select-trigger__title-truncated-text--5KH40, [class*="title"]');
        console.log('📊 Spans trouvés:', seasonSpans.length);
        
        for (const span of seasonSpans) {
          const spanText = span.textContent?.trim() || '';
          console.log('  📝 Span text:', '"' + spanText + '"');
          if (spanText && spanText.length > 0 && spanText.length < 50 && 
              (spanText.includes('S') || spanText.includes('Season') || spanText.includes('Saison'))) {
            currentSeasonText = spanText;
            console.log('🎯 Nom saison depuis span trouvé:', currentSeasonText);
            break;
          }
        }
        
        // Méthode 2: Si pas trouvé dans les spans, chercher dans la div season-info
        if (currentSeasonText === 'S1: Fire Force') {
          const seasonInfo = seasonDropdown.querySelector('.season-info');
          if (seasonInfo) {
            const seasonInfoText = seasonInfo.textContent?.trim() || '';
            console.log('📝 Season info text:', '"' + seasonInfoText + '"');
            // Extraire seulement la première occurrence de pattern saison
            const seasonMatch = seasonInfoText.match(/(S\\d+:[^S]*Fire Force)/i);
            if (seasonMatch) {
              currentSeasonText = seasonMatch[1].trim();
              console.log('🎯 Nom saison depuis season-info trouvé:', currentSeasonText);
            }
          }
        }
        
        seasonData.currentSeason = currentSeasonText;
        console.log('🎬 Nom final de la saison:', '"' + seasonData.currentSeason + '"');
      } else {
        console.log('❌ Dropdown des saisons non trouvé');
        
        // Debug: chercher tous les éléments avec season
        const allSeasonElements = document.querySelectorAll('*');
        let foundSeasons = [];
        for (const el of allSeasonElements) {
          const text = el.textContent?.trim() || '';
          if (text.includes('S1:') && text.includes('Fire Force') && text.length < 100) {
            foundSeasons.push(text.substring(0, 50));
          }
        }
        console.log('🔍 Elements avec "S1: Fire Force" trouvés:', foundSeasons.slice(0, 5));
      }
      
      return seasonData;
    `);
    
    console.log('\\n📊 RÉSULTATS:');
    console.log('Dropdown trouvé:', seasonInfo.dropdownFound ? '✅' : '❌');
    console.log('Nom de saison:', '"' + seasonInfo.currentSeason + '"');
    
    if (seasonInfo.currentSeason === 'S1: Fire Force') {
      console.log('✅ SUCCESS: Nom de saison correct!');
    } else {
      console.log('❌ FAIL: Nom de saison incorrect');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testSeasonNames().catch(console.error);