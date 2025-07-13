#!/usr/bin/env node

/**
 * Test manuel de navigation pour débugger précisément le problème
 */

async function testManualNavigation() {
  let scraper;
  
  try {
    console.log('🔍 Test Manuel Navigation Fire Force');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Naviguer vers Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();

    // Test 1: État initial de la page
    console.log('\n=== ÉTAT INITIAL ===');
    const initialState = await driver.executeScript(`
      const dropdown = document.querySelector('div[aria="Saisons"]');
      const buttons = document.querySelectorAll('div.cta-wrapper');
      const episodes = document.querySelectorAll('a[href*="/watch/"]');
      
      return {
        dropdownText: dropdown ? dropdown.textContent?.trim() : 'DROPDOWN_NOT_FOUND',
        buttonCount: buttons.length,
        episodeCount: episodes.length,
        url: window.location.href,
        buttonTexts: Array.from(buttons).map(btn => ({
          text: btn.textContent?.trim(),
          disabled: btn.classList.contains('state-disabled'),
          classes: btn.className
        }))
      };
    `);
    
    console.log('État initial:', JSON.stringify(initialState, null, 2));

    // Test 2: Cliquer sur le bouton suivant et observer IMMÉDIATEMENT
    console.log('\n=== CLIC BOUTON SUIVANT ===');
    const clickResult = await driver.executeScript(`
      const buttons = document.querySelectorAll('div.cta-wrapper');
      let clickedButton = null;
      
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        if (text.includes('Saison suivante') || text.includes('Suivante')) {
          if (!btn.classList.contains('state-disabled')) {
            clickedButton = {
              text: text,
              classes: btn.className,
              position: btn.getBoundingClientRect()
            };
            
            console.log('🔄 Clic sur bouton:', text);
            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Attendre un peu puis cliquer
            await new Promise(resolve => setTimeout(resolve, 500));
            btn.click();
            
            break;
          }
        }
      }
      
      return clickedButton;
    `);
    
    console.log('Bouton cliqué:', clickResult);

    // Test 3: Attendre et vérifier les changements PLUSIEURS FOIS
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const state = await driver.executeScript(`
        const dropdown = document.querySelector('div[aria="Saisons"]');
        const episodes = document.querySelectorAll('a[href*="/watch/"]');
        const buttons = document.querySelectorAll('div.cta-wrapper');
        
        return {
          iteration: ${i},
          dropdownText: dropdown ? dropdown.textContent?.trim() : 'NOT_FOUND',
          episodeCount: episodes.length,
          url: window.location.href,
          firstEpisodeTitle: episodes[0] ? episodes[0].textContent?.trim() : 'NO_EPISODES',
          buttonStates: Array.from(buttons).map(btn => ({
            text: btn.textContent?.trim(),
            disabled: btn.classList.contains('state-disabled')
          }))
        };
      `);
      
      console.log(`État après ${i}s:`, JSON.stringify(state, null, 2));
    }

    // Test 4: Essayer de forcer une navigation différente (au cas où)
    console.log('\n=== TEST NAVIGATION ALTERNATIVE ===');
    const alternativeResult = await driver.executeScript(`
      // Essayer de trouver des liens directs vers d'autres saisons
      const links = document.querySelectorAll('a[href*="/series/"], a[href*="/watch/"]');
      const seasonLinks = [];
      
      for (const link of links) {
        const href = link.href;
        const text = link.textContent?.trim() || '';
        
        if (text.includes('Season 2') || text.includes('Saison 2') || text.includes('S2') ||
            href.includes('season-2') || href.includes('s2')) {
          seasonLinks.push({
            href: href,
            text: text
          });
        }
      }
      
      return {
        foundSeasonLinks: seasonLinks.length,
        seasonLinks: seasonLinks.slice(0, 5)
      };
    `);
    
    console.log('Liens saisons trouvés:', alternativeResult);
    
    console.log('\n=== FIN DU TEST ===');
    
    // Laisser la fenêtre ouverte quelques secondes pour inspection manuelle
    console.log('Laissant la fenêtre ouverte 10 secondes pour inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

testManualNavigation().catch(console.error);