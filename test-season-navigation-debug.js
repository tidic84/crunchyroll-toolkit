#!/usr/bin/env node

/**
 * Test dédié pour débugger le problème de navigation entre saisons
 */

async function testSeasonNavigationDebug() {
  try {
    console.log('🔍 Debug navigation saisons - Focus Fire Force');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 15000
    });

    // Aller directement sur Fire Force
    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 8000));

    const driver = await scraper.browserManager.getDriver();
    
    console.log('\n1️⃣ Test détection dropdown et options...');
    
    const dropdownAnalysis = await driver.executeScript(`
      console.log('🔍 Analyse du dropdown des saisons...');
      
      // Chercher le dropdown
      const seasonDropdown = document.querySelector('[aria-label="Seasons"], .seasons-select [role="button"]');
      if (!seasonDropdown) {
        return { error: 'Dropdown non trouvé' };
      }
      
      console.log('✅ Dropdown trouvé');
      
      // Cliquer pour ouvrir le dropdown
      seasonDropdown.click();
      
      return { dropdownClicked: true };
    `);
    
    if (dropdownAnalysis.error) {
      console.log('❌', dropdownAnalysis.error);
      await scraper.close();
      return;
    }
    
    // Attendre que le dropdown s'ouvre
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('2️⃣ Test extraction options du dropdown...');
    
    const optionsAnalysis = await driver.executeScript(`
      console.log('🔍 Recherche des options du dropdown...');
      
      // Chercher les options du dropdown (plusieurs sélecteurs possibles)
      let options = [];
      
      // Sélecteurs possibles pour les options
      const selectors = [
        '[role="option"]',
        '.dropdown-option',
        '.season-option',
        'li[role="option"]',
        '[aria-selected]',
        '.select-option'
      ];
      
      for (const selector of selectors) {
        const foundOptions = document.querySelectorAll(selector);
        if (foundOptions.length > 0) {
          console.log('✅ Options trouvées avec sélecteur:', selector, '(' + foundOptions.length + ')');
          
          foundOptions.forEach((option, i) => {
            const text = option.textContent?.trim() || '';
            const value = option.getAttribute('data-value') || option.getAttribute('value') || '';
            
            if (text.includes('Fire Force') || text.includes('S1') || text.includes('S2') || text.includes('S3')) {
              // Extraire le numéro de saison - plusieurs patterns possibles
              let seasonNumber = null;
              
              // Pattern 1: S1:, S2:, S3:
              const pattern1 = text.match(/S(\d+):/);
              if (pattern1) {
                seasonNumber = pattern1[1];
              }
              
              // Pattern 2: Season 2, Season 3
              const pattern2 = text.match(/Season (\d+)/);
              if (pattern2) {
                seasonNumber = pattern2[1];
              }
              
              // Pattern 3: Déduction depuis la position (S1 = premier, S2 = deuxième...)
              if (!seasonNumber) {
                if (text.includes('S1:') || (!text.includes('Season') && i === 0)) {
                  seasonNumber = '1';
                } else if (text.includes('S2:') || text.includes('Season 2')) {
                  seasonNumber = '2';
                } else if (text.includes('S3:') || text.includes('Season 3')) {
                  seasonNumber = '3';
                }
              }
              
              options.push({
                index: i,
                text: text,
                value: value,
                element: selector,
                seasonNumber: seasonNumber
              });
            }
          });
          
          if (options.length > 0) {
            break; // On a trouvé des options pertinentes
          }
        }
      }
      
      if (options.length === 0) {
        // Fallback: chercher tous les éléments qui contiennent "Fire Force"
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          if (text.includes('Fire Force') && text.includes('S') && text.length < 100) {
            const seasonMatch = text.match(/S(\d+)/);
            if (seasonMatch) {
              options.push({
                text: text,
                seasonNumber: seasonMatch[1],
                element: 'fallback'
              });
            }
          }
        }
      }
      
      return {
        optionsFound: options.length,
        options: options.slice(0, 10) // Limiter à 10 pour éviter overflow
      };
    `);
    
    console.log(`Options trouvées: ${optionsAnalysis.optionsFound}`);
    
    if (optionsAnalysis.optionsFound === 0) {
      console.log('❌ Aucune option trouvée dans le dropdown');
      await scraper.close();
      return;
    }
    
    // Afficher les options trouvées
    console.log('\n📋 Options détectées:');
    optionsAnalysis.options.forEach((option, i) => {
      console.log(`  ${i+1}. S${option.seasonNumber}: "${option.text.substring(0, 40)}" (${option.element})`);
    });
    
    // Tester la sélection de S2
    const s2Option = optionsAnalysis.options.find(opt => opt.seasonNumber === '2');
    
    if (!s2Option) {
      console.log('❌ Option S2 non trouvée');
      await scraper.close();
      return;
    }
    
    console.log('\n3️⃣ Test sélection saison 2...');
    
    const s2Selection = await driver.executeScript(`
      const options = arguments[0];
      const s2Option = options.find(opt => opt.seasonNumber === '2');
      
      console.log('🎯 Tentative sélection S2:', s2Option.text);
      
      // Chercher l'élément correspondant et cliquer dessus
      const selectors = [
        '[role="option"]',
        '.dropdown-option',
        '.season-option',
        'li[role="option"]'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim() || '';
          if (text === s2Option.text || text.includes('S2') && text.includes('Fire Force')) {
            console.log('✅ Élément S2 trouvé, click...');
            el.click();
            return { clicked: true, element: selector, text: text };
          }
        }
      }
      
      return { clicked: false, error: 'Élément S2 non cliquable' };
    `, optionsAnalysis.options);
    
    if (!s2Selection.clicked) {
      console.log('❌ Impossible de cliquer sur S2:', s2Selection.error);
      await scraper.close();
      return;
    }
    
    console.log('✅ S2 sélectionné:', s2Selection.text);
    
    // Attendre le changement de page
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n4️⃣ Vérification changement de saison...');
    
    const verificationResult = await driver.executeScript(`
      // Vérifier si on est bien sur S2
      const currentUrl = window.location.href;
      const pageText = document.body.textContent || '';
      
      // Chercher des indices qu'on est sur S2
      const hasS2Indicators = pageText.includes('S2:') || 
                             pageText.includes('Season 2') ||
                             pageText.includes('Saison 2');
      
      // Compter les épisodes visibles
      const episodeElements = document.querySelectorAll('[class*="episode"], [data-episode], .erc-content-card');
      
      return {
        url: currentUrl,
        hasS2Indicators: hasS2Indicators,
        episodeCount: episodeElements.length,
        pageChanged: !currentUrl.includes('GYQWNXPZY/fire-force') || currentUrl.includes('season')
      };
    `);
    
    console.log('\n📊 RÉSULTATS NAVIGATION:');
    console.log('URL actuelle:', verificationResult.url);
    console.log('Indicateurs S2 trouvés:', verificationResult.hasS2Indicators ? '✅' : '❌');
    console.log('Épisodes visibles:', verificationResult.episodeCount);
    console.log('Page changée:', verificationResult.pageChanged ? '✅' : '❌');
    
    // Validation finale
    if (verificationResult.hasS2Indicators && verificationResult.episodeCount > 0) {
      console.log('\n✅ SUCCESS: Navigation vers S2 réussie!');
    } else {
      console.log('\n❌ FAIL: Navigation vers S2 échouée');
      console.log('Cause probable: Le dropdown ne change pas réellement de saison');
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testSeasonNavigationDebug().catch(console.error);