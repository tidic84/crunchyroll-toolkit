#!/usr/bin/env node

/**
 * Debug détaillé des épisodes pour comprendre la structure réelle
 */

async function debugEpisodeStructure() {
  let scraper;
  
  try {
    console.log('🔍 Debug Structure Épisodes Détaillée');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 8000));

    const driver = await scraper.browserManager.getDriver();

    const detailedAnalysis = await driver.executeScript(`
      console.log('🔍 Analyse détaillée des épisodes...');
      
      // Scroll pour charger tous les épisodes
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const episodes = [];
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('🎯 Total liens trouvés:', allLinks.length);
      
      // Analyser les 10 premiers liens
      for (let i = 0; i < Math.min(10, allLinks.length); i++) {
        const link = allLinks[i];
        const href = link.href;
        
        // Analyser tous les éléments de texte dans et autour du lien
        const textsInLink = [];
        const allTextNodes = link.querySelectorAll('*');
        allTextNodes.forEach(node => {
          const text = node.textContent?.trim();
          if (text && text.length > 0 && text.length < 200) {
            textsInLink.push({
              tag: node.tagName,
              class: node.className,
              text: text
            });
          }
        });
        
        // Analyser le conteneur parent pour les métadonnées
        const containers = [
          link.closest('[class*="playable-card"]'),
          link.closest('[class*="episode"]'),
          link.closest('[class*="content-card"]'),
          link.closest('[role="listitem"]'),
          link.parentElement,
          link.parentElement?.parentElement
        ].filter(Boolean);
        
        let bestTitle = '';
        let thumbnail = '';
        let duration = '';
        let episodeInfo = '';
        
        // Chercher le meilleur titre dans les conteneurs
        containers.forEach(container => {
          if (!container) return;
          
          // Chercher spécifiquement les titres d'épisodes
          const titleSelectors = [
            '[class*="title"]:not([class*="series"])',
            '[class*="episode-title"]',
            'h3', 'h4', 'h5',
            '[data-t*="title"]',
            '[aria-label]'
          ];
          
          titleSelectors.forEach(selector => {
            const titleEl = container.querySelector(selector);
            if (titleEl && titleEl.textContent?.trim()) {
              const titleText = titleEl.textContent.trim();
              // Vérifier que c'est un vrai titre d'épisode
              if (titleText.length > 10 && 
                  !titleText.match(/^\\d+m$/) && 
                  !titleText.toLowerCase().includes('lecture') &&
                  (titleText.includes('-') || titleText.includes('E') || titleText.length > 15)) {
                bestTitle = titleText;
              }
            }
          });
          
          // Chercher thumbnail
          const pictures = container.querySelectorAll('picture');
          if (pictures.length >= 2) {
            const normalImg = pictures[1].querySelector('img');
            if (normalImg) {
              const src = normalImg.src || normalImg.getAttribute('data-src');
              if (src && src.includes('crunchyroll') && !src.includes('blur=')) {
                thumbnail = src;
              }
            }
          }
          
          // Chercher durée
          const durationEl = container.querySelector('[class*="duration"], [data-t*="duration"]');
          if (durationEl) {
            duration = durationEl.textContent?.trim() || '';
          }
        });
        
        // Si pas de bon titre, essayer de l'extraire de aria-label ou title
        if (!bestTitle) {
          const ariaLabel = link.getAttribute('aria-label');
          const titleAttr = link.getAttribute('title');
          if (ariaLabel && ariaLabel.length > 10) bestTitle = ariaLabel;
          else if (titleAttr && titleAttr.length > 10) bestTitle = titleAttr;
        }
        
        episodes.push({
          index: i + 1,
          href: href,
          linkText: link.textContent?.trim() || '',
          bestTitle: bestTitle,
          thumbnail: thumbnail,
          duration: duration,
          hasGoodTitle: bestTitle.length > 10,
          hasThumbnail: !!thumbnail,
          textsFound: textsInLink.length,
          containerCount: containers.length
        });
        
        console.log(\`Episode \${i+1}:\`);
        console.log(\`  Link text: "\${link.textContent?.trim()}"\`);
        console.log(\`  Best title: "\${bestTitle}"\`);
        console.log(\`  Thumbnail: \${thumbnail ? 'OUI' : 'NON'}\`);
        console.log(\`  Duration: "\${duration}"\`);
      }
      
      return episodes;
    `);
    
    console.log('\n📊 ANALYSE DÉTAILLÉE:');
    detailedAnalysis.forEach(ep => {
      console.log(`\n${ep.index}. ${ep.linkText || 'NO_TEXT'}`);
      console.log(`   Meilleur titre: "${ep.bestTitle}"`);
      console.log(`   Thumbnail: ${ep.hasThumbnail ? '✅' : '❌'}`);
      console.log(`   Durée: "${ep.duration}"`);
      console.log(`   Conteneurs: ${ep.containerCount}`);
      
      if (ep.hasThumbnail) {
        console.log(`   URL thumbnail: ${ep.thumbnail.substring(0, 80)}...`);
      }
    });
    
    const stats = {
      total: detailedAnalysis.length,
      withThumbnails: detailedAnalysis.filter(ep => ep.hasThumbnail).length,
      withGoodTitles: detailedAnalysis.filter(ep => ep.hasGoodTitle).length,
      bothGood: detailedAnalysis.filter(ep => ep.hasThumbnail && ep.hasGoodTitle).length
    };
    
    console.log('\n📈 STATISTIQUES:');
    console.log(`Total analysés: ${stats.total}`);
    console.log(`Avec thumbnails: ${stats.withThumbnails}/${stats.total}`);
    console.log(`Avec bons titres: ${stats.withGoodTitles}/${stats.total}`);
    console.log(`Avec les deux: ${stats.bothGood}/${stats.total}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
}

debugEpisodeStructure().catch(console.error);