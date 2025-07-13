#!/usr/bin/env node

/**
 * Test rapide des titres nettoyés - seulement quelques épisodes
 */

async function testQuickTitles() {
  try {
    console.log('🧪 Test Rapide - Titres Nettoyés');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    const quickTest = await driver.executeScript(`
      const episodes = [];
      const episodeLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('🔍 ' + episodeLinks.length + ' liens trouvés');
      
      // Prendre seulement les 5 premiers épisodes pour test rapide
      for (let i = 0; i < Math.min(5, episodeLinks.length); i++) {
        const linkEl = episodeLinks[i];
        const href = linkEl.href;
        const originalText = linkEl.textContent?.trim() || '';
        
        // Extraction de titre (logique simplifiée)
        let title = originalText;
        
        // Nettoyage immédiat
        if (title) {
          const beforeClean = title;
          title = title.replace(/^S\\d+\\s*E\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Episode\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          title = title.replace(/^Ep\\s*\\d+\\s*[-–]\\s*/i, '').trim();
          
          episodes.push({
            original: originalText,
            cleaned: title,
            wasModified: beforeClean !== title,
            href: href.substring(href.lastIndexOf('/') + 1)
          });
          
          if (beforeClean !== title) {
            console.log('🧹 Episode ' + (i+1) + ': "' + beforeClean + '" -> "' + title + '"');
          }
        }
      }
      
      return episodes;
    `);
    
    console.log('\\n📊 RÉSULTATS:');
    quickTest.forEach((ep, i) => {
      console.log(`${i+1}. Original: "${ep.original}"`);
      console.log(`   Nettoyé:   "${ep.cleaned}" ${ep.wasModified ? '✅' : '❌'}`);
      console.log(`   URL:       ${ep.href}`);
    });
    
    const modified = quickTest.filter(ep => ep.wasModified).length;
    console.log(`\\n📈 ${modified}/${quickTest.length} titres nettoyés`);
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testQuickTitles().catch(console.error);