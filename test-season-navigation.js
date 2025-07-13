#!/usr/bin/env node

/**
 * Test spécifique de navigation entre saisons Fire Force
 */

async function testSeasonNavigation() {
  let scraper;
  
  try {
    console.log('🔍 Test Navigation Saisons Fire Force');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    // Naviguer vers Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();

    // Test 1: Analyser les options du dropdown
    console.log('\n=== TEST 1: ANALYSE DU DROPDOWN ===');
    const dropdownAnalysis = await driver.executeScript(`
      console.log('🔍 Ouverture du dropdown...');
      
      const dropdown = document.querySelector('[aria="Saisons"]');
      if (!dropdown) {
        return { error: 'Dropdown non trouvé' };
      }
      
      // Cliquer pour ouvrir
      dropdown.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Chercher toutes les options
      const options = document.querySelectorAll('[role="option"]');
      const result = {
        dropdownText: dropdown.textContent?.trim(),
        optionsFound: options.length,
        options: []
      };
      
      options.forEach((option, i) => {
        const text = option.textContent?.trim() || '';
        const isSelected = option.hasAttribute('aria-selected') || option.classList.contains('selected');
        result.options.push({
          index: i,
          text: text,
          selected: isSelected,
          clickable: true
        });
        console.log(\`Option \${i}: "\${text}" (selected: \${isSelected})\`);
      });
      
      // Refermer le dropdown
      dropdown.click();
      
      return result;
    `);

    console.log('Dropdown Analysis:', JSON.stringify(dropdownAnalysis, null, 2));

    if (dropdownAnalysis.options && dropdownAnalysis.options.length > 1) {
      // Test 2: Essayer de naviguer vers la saison 2
      console.log('\n=== TEST 2: NAVIGATION VERS SAISON 2 ===');
      
      const season2Option = dropdownAnalysis.options.find(opt => 
        opt.text.includes('S2') || opt.text.includes('Season 2')
      );
      
      if (season2Option) {
        console.log(`Tentative de navigation vers: "${season2Option.text}"`);
        
        const navigationResult = await driver.executeScript(`
          const dropdown = document.querySelector('[aria="Saisons"]');
          if (!dropdown) return { error: 'Dropdown non trouvé' };
          
          console.log('🔄 Ouverture dropdown pour sélection...');
          dropdown.click();
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          const options = document.querySelectorAll('[role="option"]');
          let clicked = false;
          
          for (const option of options) {
            const text = option.textContent?.trim() || '';
            if (text.includes('S2') || text.includes('Season 2')) {
              console.log('🔄 Clic sur option S2: ' + text);
              option.click();
              clicked = true;
              await new Promise(resolve => setTimeout(resolve, 3000));
              break;
            }
          }
          
          if (!clicked) {
            dropdown.click(); // Refermer si pas cliqué
            return { error: 'Option S2 non trouvée pour clic' };
          }
          
          // Vérifier le changement
          await new Promise(resolve => setTimeout(resolve, 2000));
          const newDropdownText = document.querySelector('[aria="Saisons"]')?.textContent?.trim();
          
          return {
            clicked: true,
            oldText: '${dropdownAnalysis.dropdownText}',
            newText: newDropdownText,
            changed: newDropdownText !== '${dropdownAnalysis.dropdownText}'
          };
        `);

        console.log('Navigation Result:', navigationResult);

        if (navigationResult.changed) {
          // Test 3: Vérifier les nouveaux épisodes
          console.log('\n=== TEST 3: VERIFICATION EPISODES SAISON 2 ===');
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const episodesAnalysis = await driver.executeScript(`
            // Scroll pour charger
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise(resolve => setTimeout(resolve, 2000));
            window.scrollTo(0, 0);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
            const episodes = [];
            
            episodeLinks.forEach((link, i) => {
              if (i < 10) { // Premiers 10 épisodes
                const text = link.textContent?.trim() || '';
                const href = link.href;
                episodes.push({
                  index: i,
                  text: text.substring(0, 50),
                  url: href,
                  season: text.includes('S2') ? 'S2' : (text.includes('S1') ? 'S1' : 'Unknown')
                });
              }
            });
            
            return {
              totalEpisodes: episodeLinks.length,
              firstTenEpisodes: episodes
            };
          `);

          console.log('Episodes Analysis:', JSON.stringify(episodesAnalysis, null, 2));
        } else {
          console.log('❌ Navigation vers S2 échouée - pas de changement détecté');
        }
      } else {
        console.log('❌ Option S2 non trouvée dans le dropdown');
      }
    }

    // Test 4: Essayer navigation avec boutons
    console.log('\n=== TEST 4: NAVIGATION AVEC BOUTONS ===');
    
    const buttonNavigation = await driver.executeScript(`
      const nextButton = document.querySelector('[class*="cta-wrapper"]:not(.state-disabled)');
      const nextButtonText = nextButton?.textContent?.trim() || '';
      
      if (nextButton && nextButtonText.includes('Suivante')) {
        console.log('🔄 Clic sur bouton suivant: ' + nextButtonText);
        nextButton.click();
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        const newDropdownText = document.querySelector('[aria="Saisons"]')?.textContent?.trim();
        
        return {
          clicked: true,
          buttonText: nextButtonText,
          newDropdownText: newDropdownText
        };
      } else {
        return { error: 'Bouton suivant non trouvé ou désactivé' };
      }
    `);

    console.log('Button Navigation:', buttonNavigation);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

testSeasonNavigation().catch(console.error);