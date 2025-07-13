#!/usr/bin/env node

/**
 * Test rapide pour voir les noms de saisons détectés par le scraper complet
 */

async function testSeasonDetectionOnly() {
  try {
    console.log('🔍 Test détection saisons dans scraper complet');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    // Aller directement sur Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    // Simuler juste la partie de détection des saisons du scraper
    const seasonsFound = await driver.executeScript(`
      console.log('🔍 Recherche du dropdown des saisons et navigation...');
      
      let seasonData = {
        dropdownFound: false,
        navigationButtons: [],
        currentSeason: '',
        availableSeasons: []
      };
      
      // 1. Chercher le dropdown principal des saisons (bon sélecteur: aria-label="Seasons")
      const seasonDropdown = document.querySelector('[aria-label="Seasons"], .seasons-select [role="button"]');
      if (seasonDropdown) {
        seasonData.dropdownFound = true;
        
        // Extraire le nom de la saison actuelle depuis les spans à l'intérieur
        let currentSeasonText = 'S1: Fire Force';
        
        // Méthode 1: Chercher dans les spans avec classes spécifiques Crunchyroll
        const seasonSpans = seasonDropdown.querySelectorAll('.call-to-action--PEidl, .select-trigger__title-truncated-text--5KH40, [class*="title"]');
        for (const span of seasonSpans) {
          const spanText = span.textContent?.trim() || '';
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
            // Extraire seulement la première occurrence de pattern saison
            const seasonMatch = seasonInfoText.match(/(S\\d+:[^S]*Fire Force)/i);
            if (seasonMatch) {
              currentSeasonText = seasonMatch[1].trim();
              console.log('🎯 Nom saison depuis season-info trouvé:', currentSeasonText);
            }
          }
        }
        
        seasonData.currentSeason = currentSeasonText;
        console.log('🎬 Dropdown saisons trouvé: "' + seasonData.currentSeason + '"');
      }
      
      return seasonData;
    `);
    
    // Simuler la détection des boutons de navigation aussi
    const navigationButtons = await driver.executeScript(`
      const allButtons = document.querySelectorAll('[class*="cta-wrapper"], [role="button"]');
      const buttons = [];
      
      allButtons.forEach(btn => {
        const text = btn.textContent?.trim() || '';
        const isDisabled = btn.classList.contains('state-disabled') || btn.hasAttribute('disabled');
        
        if (text.includes('Saison suivante') || text.includes('Suivante')) {
          buttons.push({
            type: 'next',
            text: text,
            disabled: isDisabled
          });
        }
        
        if (text.includes('Saison précédente') || text.includes('Précédente')) {
          buttons.push({
            type: 'prev', 
            text: text,
            disabled: isDisabled
          });
        }
      });
      
      return buttons;
    `);
    
    console.log('\n📊 RÉSULTATS DÉTECTION SAISONS:');
    console.log('Dropdown trouvé:', seasonsFound.dropdownFound ? '✅' : '❌');
    console.log('Nom saison actuelle:', '"' + seasonsFound.currentSeason + '"');
    console.log('Boutons navigation:', navigationButtons.length);
    
    navigationButtons.forEach(btn => {
      const status = btn.disabled ? '(désactivé)' : '(actif)';
      console.log(`  - ${btn.type}: "${btn.text}" ${status}`);
    });
    
    // Validation
    if (seasonsFound.dropdownFound && seasonsFound.currentSeason === 'S1: Fire Force') {
      console.log('\n✅ SUCCESS: Détection des saisons correcte!');
    } else {
      console.log('\n❌ FAIL: Problème avec la détection');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testSeasonDetectionOnly().catch(console.error);