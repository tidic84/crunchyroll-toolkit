#!/usr/bin/env node

/**
 * Test du fix du bug de déduplication des thumbnails
 * Vérifier que chaque épisode a son thumbnail unique
 */

async function testThumbnailFix() {
  try {
    console.log('🔧 Test du fix de thumbnail - Vérification des thumbnails uniques');
    
    const { createZenRowsCrunchyrollScraper } = require('./lib/zenrows.index');
    
    const scraper = await createZenRowsCrunchyrollScraper({
      headless: false,
      timeout: 30000
    });

    await scraper.browserManager.navigateTo('https://www.crunchyroll.com/fr/series/GYQWNXPZY/fire-force');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const driver = await scraper.browserManager.getDriver();
    
    // Test des premiers épisodes pour vérifier les thumbnails uniques
    const thumbnailTest = await driver.executeScript(`
      console.log('🔍 Test des thumbnails uniques...');
      
      const allLinks = document.querySelectorAll('a[href*="/watch/"]');
      console.log('Total liens trouvés:', allLinks.length);
      
      // Simuler la nouvelle logique d'extraction
      const episodeMap = new Map();
      const thumbnailResults = [];
      
      allLinks.forEach((linkEl, index) => {
        if (!(linkEl instanceof HTMLAnchorElement)) return;
        if (index >= 10) return; // Tester seulement les 10 premiers
        
        const href = linkEl.href;
        if (!href || !href.includes('/watch/')) return;
        
        // Éviter musicvideos, movies, etc.
        if (href.includes('/musicvideo/') || href.includes('/movie/') || href.includes('/concert/')) {
          return;
        }
        
        const text = linkEl.textContent?.trim() || '';
        
        // Déduplication simple pour ce test
        const hasGoodTitle = text.length > 10 && 
                           (text.includes('E') || text.includes('-') || text.includes('Ep')) && 
                           !text.match(/^\\d+m$/) && 
                           !text.match(/^\\d+$/) &&
                           !text.toLowerCase().includes('lecture') &&
                           text !== 'NO_TEXT';
        
        if (!episodeMap.has(href)) {
          episodeMap.set(href, {
            linkEl: linkEl,
            text: text,
            href: href,
            index: index,
            hasGoodTitle: hasGoodTitle
          });
        }
      });
      
      console.log('Episodes uniques à tester:', episodeMap.size);
      
      // Nouvelle logique d'extraction pour chaque épisode
      episodeMap.forEach((episode, url) => {
        const linkEl = episode.linkEl;
        let thumbnail = '';
        
        // NOUVELLE LOGIQUE: Conteneur spécifique le plus proche
        const specificContainer = linkEl.closest('[class*="episode"], [class*="card"], [role="listitem"], [class*="item"]');
        
        const containersToSearch = specificContainer ? [specificContainer] : [
          linkEl.parentElement,
          linkEl.parentElement?.parentElement
        ].filter(Boolean);
        
        console.log('Episode ' + (thumbnailResults.length + 1) + ' - Recherche dans ' + containersToSearch.length + ' conteneur(s)');
        
        // PRIORITÉ 1: 2ème picture
        for (const episodeContainer of containersToSearch) {
          if (thumbnail) break;
          
          const pictureElements = episodeContainer.querySelectorAll('picture');
          console.log('  Container:', episodeContainer.className || 'NO_CLASS', 'Pictures:', pictureElements.length);
          
          if (pictureElements.length >= 2) {
            const normalPicture = pictureElements[1];
            const normalImg = normalPicture.querySelector('img');
            if (normalImg) {
              const normalSrc = normalImg.src || normalImg.getAttribute('data-src') || normalImg.getAttribute('data-lazy');
              if (normalSrc && normalSrc.includes('crunchyroll') && !normalSrc.includes('blur=')) {
                thumbnail = normalSrc.trim();
                const thumbId = thumbnail.split('/').pop().split('.')[0];
                console.log('  ✅ 2ème picture:', thumbId + '.jpg');
                break;
              }
            }
          }
        }
        
        // PRIORITÉ 2: Toute image dans le conteneur spécifique
        if (!thumbnail) {
          for (const episodeContainer of containersToSearch) {
            if (thumbnail) break;
            
            const allImages = episodeContainer.querySelectorAll('img');
            for (const img of allImages) {
              const srcSources = [
                img.src,
                img.getAttribute('data-src'),
                img.getAttribute('data-lazy'),
                img.getAttribute('data-original'),
                img.getAttribute('srcset')?.split(' ')[0]
              ].filter(Boolean);
              
              for (const src of srcSources) {
                if (src && 
                    (src.includes('crunchyroll') || src.includes('imgsrv')) && 
                    !src.includes('blur=') && 
                    !src.includes('placeholder') &&
                    !src.includes('icon') &&
                    !src.includes('logo') &&
                    src.match(/\\.(jpg|jpeg|png|webp)/i)) {
                  thumbnail = src.trim();
                  const thumbId = thumbnail.split('/').pop().split('.')[0];
                  console.log('  ✅ Image directe:', thumbId + '.jpg');
                  break;
                }
              }
              if (thumbnail) break;
            }
          }
        }
        
        thumbnailResults.push({
          index: thumbnailResults.length + 1,
          url: url.substring(url.lastIndexOf('/') + 1),
          text: episode.text.substring(0, 40),
          thumbnail: thumbnail,
          thumbnailId: thumbnail ? thumbnail.split('/').pop().split('.')[0] : 'NONE'
        });
      });
      
      return thumbnailResults;
    `);
    
    console.log('\\n📊 RÉSULTATS THUMBNAILS:');
    const uniqueThumbnails = new Set();
    
    thumbnailTest.forEach((result, i) => {
      console.log(`${i+1}. "${result.text}"`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Thumbnail: ${result.thumbnailId} ${result.thumbnail ? '✅' : '❌'}`);
      
      if (result.thumbnail) {
        uniqueThumbnails.add(result.thumbnailId);
      }
    });
    
    const withThumbnails = thumbnailTest.filter(r => r.thumbnail).length;
    const totalTested = thumbnailTest.length;
    
    console.log(`\\n📈 STATISTIQUES:`);
    console.log(`Épisodes testés: ${totalTested}`);
    console.log(`Avec thumbnails: ${withThumbnails}/${totalTested} (${((withThumbnails/totalTested)*100).toFixed(1)}%)`);
    console.log(`Thumbnails uniques: ${uniqueThumbnails.size}`);
    
    if (uniqueThumbnails.size === withThumbnails && withThumbnails > 1) {
      console.log('\\n✅ SUCCÈS: Chaque épisode a un thumbnail unique!');
      console.log('✅ Bug de déduplication corrigé');
    } else if (uniqueThumbnails.size === 1 && withThumbnails > 1) {
      console.log('\\n❌ ÉCHEC: Tous les épisodes ont le même thumbnail');
      console.log('❌ Bug de déduplication persiste');
    } else if (withThumbnails === 0) {
      console.log('\\n⚠️ PROBLÈME: Aucun thumbnail trouvé');
    } else {
      console.log(`\\n🔍 STATUT: ${uniqueThumbnails.size} thumbnails uniques sur ${withThumbnails} épisodes`);
    }
    
    console.log('\\n🎭 THUMBNAILS UNIQUES TROUVÉS:');
    Array.from(uniqueThumbnails).forEach((id, i) => {
      console.log(`  ${i+1}. ${id}.jpg`);
    });
    
    await scraper.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testThumbnailFix().catch(console.error);