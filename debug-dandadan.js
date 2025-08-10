const { CrunchyrollToolkitScraper } = require('./lib/scrapers/crunchyroll-toolkit.scraper.js');

async function debugDanDaDan() {
    console.log('🔍 Debug DAN DA DAN - Recherche saisons');
    
    const scraper = new CrunchyrollToolkitScraper({
        headless: false, // Mode visible pour debug
        timeout: 15000
    });

    try {
        await scraper.initialize();
        
        // Aller directement à la page DAN DA DAN
        const danDaDanUrl = 'https://www.crunchyroll.com/fr/series/GG5H5XQ0D/dan-da-dan';
        console.log('🎯 Navigation vers:', danDaDanUrl);
        
        const driver = await scraper.browserManager.getDriver();
        await driver.get(danDaDanUrl);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Debug: voir ce qui est réellement sur la page
        const pageInfo = await driver.executeScript(`
            const allLinks = document.querySelectorAll('a[href*="/watch/"]');
            const allButtons = document.querySelectorAll('button, [role="button"]');
            const allSelects = document.querySelectorAll('select, [role="listbox"], [role="option"]');
            
            console.log('=== DEBUG PAGE DAN DA DAN ===');
            console.log('Liens épisodes trouvés:', allLinks.length);
            console.log('Boutons trouvés:', allButtons.length);
            console.log('Sélecteurs/Options trouvés:', allSelects.length);
            
            // Analyser les boutons qui pourraient être des saisons
            const potentialSeasonButtons = [];
            allButtons.forEach((btn, i) => {
                const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
                if (text && (
                    text.includes('Season') || 
                    text.includes('Saison') || 
                    text.includes('S2') || 
                    text.includes('S1') ||
                    text.includes('saison') ||
                    text.includes('season') ||
                    text.toLowerCase().includes('next') ||
                    text.toLowerCase().includes('suivant')
                )) {
                    potentialSeasonButtons.push({
                        index: i,
                        text: text,
                        className: btn.className,
                        ariaLabel: btn.getAttribute('aria-label')
                    });
                }
            });
            
            console.log('Boutons potentiels de saison:', potentialSeasonButtons);
            
            // Analyser le contenu de la page pour d'autres indices
            const pageText = document.body.textContent || '';
            const hasSeason2Mention = pageText.includes('Saison 2') || 
                                    pageText.includes('Season 2') ||
                                    pageText.includes('S2') ||
                                    pageText.includes('2025') && pageText.includes('2024');
            
            console.log('Page mentionne Saison 2:', hasSeason2Mention);
            
            // Vérifier s'il y a des dropdowns
            const dropdowns = document.querySelectorAll('select, [aria-haspopup="listbox"]');
            console.log('Dropdowns trouvés:', dropdowns.length);
            
            return {
                episodeLinks: allLinks.length,
                potentialSeasonButtons: potentialSeasonButtons,
                hasSeason2Mention: hasSeason2Mention,
                dropdownCount: dropdowns.length,
                pageTitle: document.title,
                url: window.location.href
            };
        `);
        
        console.log('📊 Résultats analyse page:');
        console.log(JSON.stringify(pageInfo, null, 2));
        
        // Attendre un peu pour voir la page en mode non-headless
        if (!scraper.browserManager.options.headless) {
            console.log('⏸️ Page visible - Appuyez sur Ctrl+C pour arrêter...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
    } catch (error) {
        console.error('❌ Erreur debug:', error.message);
    } finally {
        await scraper.close();
    }
}

debugDanDaDan().catch(console.error);