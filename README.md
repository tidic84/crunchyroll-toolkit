# Crunchyroll Toolkit

An advanced scraper for retrieving anime information from Crunchyroll, designed to bypass modern anti-bot protections.

## 🚀 Features

- **Enhanced Search**: Search by title with improved fallback strategies for hard-to-find anime
- **Complete Details**: Retrieve metadata (title, description, thumbnail, release year)
- **Advanced Multi-Season**: Interactive navigation between seasons using Crunchyroll's native controls
- **Season 2 Support**: Automatic detection of newly released seasons (2025 releases supported)
- **HD Thumbnails**: High-quality thumbnail retrieval for all episodes
- **Anti-Detection**: Intelligent bypass of Cloudflare and anti-bot protections
- **Smart Navigation**: Multiple strategies including dropdown selectors and navigation buttons

## 📦 Installation

```bash
npm install
npm run build
```

## 🎯 Usage

### Import and initialization

```javascript
const { createCrunchyrollToolkitScraper } = require('./lib/crunchyroll-toolkit.index');

const scraper = await createCrunchyrollToolkitScraper({
  headless: false,
  timeout: 30000,
  locale: 'fr-FR'
});
```

### Search for an anime

```javascript
const result = await scraper.searchAnime('Apocalypse Bringer Mynoghra');
console.log(result.data); // Array of found anime
```

### Get episodes directly

```javascript
const animeUrl = 'https://www.crunchyroll.com/series/GXJHM39MP/a-couple-of-cuckoos';
const episodes = await scraper.getEpisodes(animeUrl);
console.log(episodes.data); // Array of episodes from all seasons
```

### Complete workflow example

```javascript
// Search for an anime
const searchResult = await scraper.searchAnime('A Couple of Cuckoos');
const anime = searchResult.data[0];

// Get all episodes from all seasons
const episodes = await scraper.getEpisodes(anime.url);
console.log(`Found ${episodes.data.length} episodes across multiple seasons`);

// Close the scraper
await scraper.close();
```

## 🧪 Testing

A complete test is provided for various anime:

```bash
node test-crunchyroll-toolkit.js "A Couple of Cuckoos"
node test-crunchyroll-toolkit.js "Fire Force"
node test-crunchyroll-toolkit.js "One Piece"
```

You can also test with direct URLs:

```bash
node test-crunchyroll-toolkit.js "https://www.crunchyroll.com/fr/series/GXJHM39MP/a-couple-of-cuckoos"
```

## 📁 Project Structure

```
crunchyroll-toolkit/
├── src/
│   ├── scrapers/
│   │   ├── crunchyroll.scraper.ts              # Original scraper
│   │   ├── selenium.crunchyroll.scraper.ts     # Selenium-based scraper
│   │   └── crunchyroll-toolkit.scraper.ts      # Crunchyroll Toolkit scraper
│   ├── types/
│   │   └── anime.types.ts                      # TypeScript types
│   ├── utils/
│   │   ├── browser.utils.ts                    # Browser management
│   │   ├── selenium.browser.utils.ts           # Selenium browser utils
│   │   ├── crunchyroll-toolkit.browser.utils.ts # Crunchyroll Toolkit browser utils
│   │   └── parser.utils.ts                     # Parsing utilities
│   ├── index.ts                                # Main entry point
│   ├── selenium.index.ts                       # Selenium entry point
│   └── crunchyroll-toolkit.index.ts            # Crunchyroll Toolkit entry point
├── lib/                                        # Compiled code (generated)
├── test-crunchyroll-toolkit.js                 # Main test file
├── package.json
└── tsconfig.json
```

## 🛠️ Technologies Used

- **TypeScript**: Static typing and robust development
- **Selenium WebDriver**: Automated browser navigation and interaction
- **undetected-chromedriver-js**: NPM package for anti-detection capabilities
- **Advanced Anti-Detection**: Techniques to bypass protections

## ⚡ Performance

The scraper uses a hybrid approach that:
- Intercepts Crunchyroll APIs in real-time
- Navigates intelligently to bypass Cloudflare
- Generates consistent data in case of partial APIs
- Minimizes detection through stealth techniques

## 🎯 Tested Use Cases

- ✅ **A Couple of Cuckoos**: Complete 2-season extraction (Season 1: 24 episodes, Season 2: 2+ episodes)
- ✅ **Fire Force**: Search, details, and multi-season extraction (3 seasons detected automatically)
- ✅ **Multiple Seasons**: Advanced navigation between seasons using interactive buttons
- ✅ **Season 2 Detection**: Automatic detection of newly released seasons (July 2025)
- ✅ **HD Thumbnails**: 100% of episodes with high-quality thumbnails
- ✅ **Smart Search**: Enhanced search with fallback strategies for hard-to-find anime
- ✅ **Cloudflare Bypass**: Intelligent navigation and anti-detection

## 🔧 Technical Details

### Anti-Detection Features

- **Undetected ChromeDriver**: Uses `undetected-chromedriver-js` NPM package for better security
- **Custom User Agents**: Mimics real browser behavior
- **Smart Navigation**: Progressive bypass strategies for different protection levels
- **Stealth Mode**: Disabled automation indicators and enhanced privacy

### Multi-Season Navigation

- **Interactive Buttons**: Uses Crunchyroll's native "Next Season" / "Previous Season" buttons
- **Dropdown Detection**: Automatic detection of season selector dropdowns
- **URL Strategies**: Multiple fallback URL patterns for different anime structures
- **Duplicate Filtering**: Advanced deduplication across seasons and episodes

### Browser Management

- **Selenium WebDriver**: Robust browser automation
- **Custom Chrome Options**: Optimized for anti-detection
- **Session Management**: Proper initialization and cleanup
- **Error Handling**: Comprehensive error recovery mechanisms

## 📝 License

MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the project
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## ⚠️ Disclaimer

This project is for educational and research purposes. Please respect Crunchyroll's terms of service and applicable laws.

## 🔒 Security

This toolkit now uses the `undetected-chromedriver-js` NPM package instead of a local executable for improved security and maintainability. The anti-detection capabilities are fully preserved while providing better dependency management.