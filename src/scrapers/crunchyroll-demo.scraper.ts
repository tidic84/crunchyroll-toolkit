import { 
  Anime, 
  Episode, 
  AnimeSeries, 
  ScraperResult, 
  ScraperOptions 
} from '../types/anime.types';
import { ParserUtils } from '../utils/parser.utils';

/**
 * Scraper de démonstration qui utilise des données d'exemple
 * pour montrer le fonctionnement du package sans dépendre de Crunchyroll
 */
export class CrunchyrollDemoScraper {
  private baseUrl = 'https://www.crunchyroll.com';

  // Données d'exemple d'animés populaires
  private demoAnimes: Anime[] = [
    {
      id: 'one-piece',
      title: 'One Piece',
      description: 'Monkey D. Luffy refuse de laisser quiconque ou quoi que ce soit se mettre entre lui et son rêve de devenir le roi des pirates !',
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/a249096c7812deb8c3c2c907173f3774.jpg',
      url: 'https://www.crunchyroll.com/fr/series/GRMG8ZQZR/one-piece',
      genres: ['Action', 'Aventure', 'Comédie', 'Drame'],
      releaseYear: 1999,
      rating: 4.8,
      episodeCount: 1000
    },
    {
      id: 'demon-slayer',
      title: 'Demon Slayer: Kimetsu no Yaiba',
      description: 'Depuis les temps anciens, il y a eu des rumeurs de démons mangeurs d\'hommes qui se cachent dans les bois.',
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/bd6ac87ba0d04e6e7e4bf914e9d5b567.jpg',
      url: 'https://www.crunchyroll.com/fr/series/GY5P48XEY/demon-slayer-kimetsu-no-yaiba',
      genres: ['Action', 'Surnaturel', 'Historique'],
      releaseYear: 2019,
      rating: 4.9,
      episodeCount: 44
    },
    {
      id: 'attack-on-titan',
      title: 'Attack on Titan',
      description: 'L\'humanité vit dans la terreur des Titans, d\'énormes créatures humanoïdes qui dévorent les humains.',
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/e9b3c18e5c3543e0a64d1a5f69e1b64a.jpg',
      url: 'https://www.crunchyroll.com/fr/series/GR751KNZY/attack-on-titan',
      genres: ['Action', 'Drame', 'Fantastique'],
      releaseYear: 2013,
      rating: 4.7,
      episodeCount: 87
    },
    {
      id: 'my-hero-academia',
      title: 'My Hero Academia',
      description: 'Dans un monde où 80% de la population possède des super-pouvoirs, Izuku Midoriya rêve de devenir un héros.',
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/7ee6b27b37eace6cc7583a6dcef1ba57.jpg',
      url: 'https://www.crunchyroll.com/fr/series/G6NQ5DWZ6/my-hero-academia',
      genres: ['Action', 'École', 'Super-héros'],
      releaseYear: 2016,
      rating: 4.6,
      episodeCount: 158
    },
    {
      id: 'jujutsu-kaisen',
      title: 'Jujutsu Kaisen',
      description: 'Yuji Itadori, un lycéen aux capacités physiques exceptionnelles, se retrouve plongé dans le monde des exorcistes.',
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=480,height=720/catalog/crunchyroll/5bb3a6b0e5b4a6b0e5b4a6b0e5b4a6b0.jpg',
      url: 'https://www.crunchyroll.com/fr/series/GRDV0019R/jujutsu-kaisen',
      genres: ['Action', 'Surnaturel', 'École'],
      releaseYear: 2020,
      rating: 4.8,
      episodeCount: 48
    }
  ];

  // Données d'exemple d'épisodes pour One Piece
  private demoEpisodes: Episode[] = [
    {
      id: 'one-piece-ep1',
      animeId: 'one-piece',
      title: 'Je suis Luffy ! L\'homme qui va devenir le Roi des Pirates !',
      episodeNumber: 1,
      seasonNumber: 1,
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=640,height=360/thumbnail/episode1.jpg',
      description: 'Luffy mange le fruit du démon et obtient des pouvoirs élastiques.',
      duration: 24,
      releaseDate: new Date('1999-10-20'),
      url: 'https://www.crunchyroll.com/fr/watch/GRMG8ZQZR/one-piece-episode-1'
    },
    {
      id: 'one-piece-ep2',
      animeId: 'one-piece',
      title: 'Le grand épéiste apparaît ! Chasseur de pirates, Roronoa Zoro',
      episodeNumber: 2,
      seasonNumber: 1,
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=640,height=360/thumbnail/episode2.jpg',
      description: 'Luffy rencontre Zoro et lui propose de rejoindre son équipage.',
      duration: 24,
      releaseDate: new Date('1999-11-03'),
      url: 'https://www.crunchyroll.com/fr/watch/GRMG8ZQZR/one-piece-episode-2'
    },
    {
      id: 'one-piece-ep3',
      animeId: 'one-piece',
      title: 'Morgan contre Luffy ! Qui est cette belle mystérieuse ?',
      episodeNumber: 3,
      seasonNumber: 1,
      thumbnail: 'https://imgsrv.crunchyroll.com/cdn-cgi/image/fit=cover,format=auto,quality=85,width=640,height=360/thumbnail/episode3.jpg',
      description: 'Luffy et Zoro affrontent le capitaine Morgan.',
      duration: 24,
      releaseDate: new Date('1999-11-10'),
      url: 'https://www.crunchyroll.com/fr/watch/GRMG8ZQZR/one-piece-episode-3'
    }
  ];

  constructor(options: ScraperOptions = {}) {
    console.log('🎭 Scraper de démonstration initialisé');
    console.log('💡 Ce scraper utilise des données d\'exemple pour démontrer les fonctionnalités');
  }

  async initialize(): Promise<void> {
    console.log('✅ Scraper de démonstration prêt');
  }

  async close(): Promise<void> {
    console.log('👋 Scraper de démonstration fermé');
  }

  async searchAnime(query: string): Promise<ScraperResult<Anime[]>> {
    console.log(`🔍 Recherche de "${query}" dans les données de démonstration...`);
    
    // Simuler un délai de recherche
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const lowerQuery = query.toLowerCase();
      
      // Filtrer les animés qui correspondent à la recherche
             const results = this.demoAnimes.filter(anime => 
         anime.title.toLowerCase().includes(lowerQuery) ||
         (anime.description && anime.description.toLowerCase().includes(lowerQuery)) ||
         anime.genres?.some(genre => genre.toLowerCase().includes(lowerQuery))
       );

      console.log(`✅ ${results.length} résultat(s) trouvé(s) pour "${query}"`);

      return {
        success: true,
        data: results
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la recherche: ${(error as Error).message}`
      };
    }
  }

  async getAnimeDetails(animeUrl: string): Promise<ScraperResult<Anime>> {
    console.log(`📋 Récupération des détails pour: ${animeUrl}`);
    
    // Simuler un délai de chargement
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const animeId = ParserUtils.extractIdFromUrl(animeUrl);
      const anime = this.demoAnimes.find(a => a.id === animeId || a.url === animeUrl);

      if (!anime) {
        return {
          success: false,
          error: 'Animé non trouvé dans les données de démonstration'
        };
      }

      console.log(`✅ Détails récupérés pour: ${anime.title}`);

      return {
        success: true,
        data: anime
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la récupération des détails: ${(error as Error).message}`
      };
    }
  }

  async getEpisodes(animeUrl: string): Promise<ScraperResult<Episode[]>> {
    console.log(`📺 Récupération des épisodes pour: ${animeUrl}`);
    
    // Simuler un délai de chargement
    await new Promise(resolve => setTimeout(resolve, 1200));

    try {
      const animeId = ParserUtils.extractIdFromUrl(animeUrl);
      
      // Pour la démo, on retourne les épisodes de One Piece si c'est One Piece,
      // sinon on génère des épisodes d'exemple
      let episodes: Episode[];
      
      if (animeId === 'one-piece' || animeUrl.includes('one-piece')) {
        episodes = this.demoEpisodes;
      } else {
        // Générer des épisodes d'exemple pour d'autres animés
        const anime = this.demoAnimes.find(a => a.id === animeId || a.url === animeUrl);
        const episodeCount = Math.min(anime?.episodeCount || 12, 5); // Limiter à 5 pour la démo
        
        episodes = Array.from({ length: episodeCount }, (_, index) => ({
          id: `${animeId}-ep${index + 1}`,
          animeId,
          title: `Episode ${index + 1} - ${anime?.title || 'Titre de l\'épisode'}`,
          episodeNumber: index + 1,
          seasonNumber: 1,
          thumbnail: `https://example.com/thumbnail-${animeId}-ep${index + 1}.jpg`,
          description: `Description de l'épisode ${index + 1}`,
          duration: 24,
          releaseDate: new Date(2023, 0, index + 1),
          url: `${animeUrl}/episode-${index + 1}`
        }));
      }

      console.log(`✅ ${episodes.length} épisode(s) récupéré(s)`);

      return {
        success: true,
        data: episodes
      };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la récupération des épisodes: ${(error as Error).message}`
      };
    }
  }

  async getAnimeSeries(animeUrl: string): Promise<ScraperResult<AnimeSeries>> {
    console.log(`🎬 Récupération de la série complète pour: ${animeUrl}`);

    try {
      const animeResult = await this.getAnimeDetails(animeUrl);
      if (!animeResult.success || !animeResult.data) {
        return { success: false, error: animeResult.error };
      }

      const episodesResult = await this.getEpisodes(animeUrl);
      if (!episodesResult.success || !episodesResult.data) {
        return { success: false, error: episodesResult.error };
      }

      const animeSeries: AnimeSeries = {
        ...animeResult.data,
        episodes: episodesResult.data,
        episodeCount: episodesResult.data.length
      };

      console.log(`✅ Série complète récupérée: ${animeSeries.title} (${animeSeries.episodeCount} épisodes)`);

      return { success: true, data: animeSeries };
    } catch (error) {
      return {
        success: false,
        error: `Erreur lors de la récupération de la série: ${(error as Error).message}`
      };
    }
  }

  // Méthode bonus pour lister tous les animés disponibles
  async getAllAnimes(): Promise<ScraperResult<Anime[]>> {
    console.log('📚 Récupération de tous les animés de démonstration...');
    
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      data: this.demoAnimes
    };
  }
} 