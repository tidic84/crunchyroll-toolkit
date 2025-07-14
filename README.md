# Crunchyroll Toolkit

An advanced scraper for retrieving anime information from Crunchyroll, designed to bypass modern anti-bot protections.

## 🚀 Features

- **Anime Search**: Search by title with relevant results via intercepted API
- **Complete Details**: Retrieve metadata (title, description, thumbnail)
- **Multi-Season**: Automatic detection and extraction of episodes from all seasons
- **HD Thumbnails**: High-quality thumbnail retrieval for all episodes
- **Anti-Detection**: Intelligent bypass of Cloudflare and anti-bot protections
- **Hybrid API**: Uses intercepted Crunchyroll APIs for precise and complete data

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

### Get anime details

```javascript
const animeUrl = 'https://www.crunchyroll.com/series/...';
const details = await scraper.getAnimeDetails(animeUrl);
console.log(details.data); // Complete anime details
```

### Get episodes

```javascript
const episodes = await scraper.getEpisodes(animeUrl);
console.log(episodes.data); // Array of episodes with thumbnails
```

## 🧪 Testing

A complete test is provided for the anime "Apocalypse Bringer Mynoghra":

```bash
node test-crunchyroll-toolkit.js "Mynoghra"
```

You can also test with other anime:

```bash
node test-crunchyroll-toolkit.js "Fire Force"
node test-crunchyroll-toolkit.js "One Piece"
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

- ✅ **Fire Force**: Search, details, and multi-season extraction (3 seasons detected automatically)
- ✅ **Mynoghra**: "Apocalypse Bringer Mynoghra" found via specific search
- ✅ **Multiple Seasons**: Automatic detection and navigation between seasons
- ✅ **HD Thumbnails**: 100% of episodes with high-quality thumbnails
- ✅ **Intercepted APIs**: Complete extraction via real-time Crunchyroll APIs
- ✅ **Cloudflare Bypass**: Intelligent navigation and anti-detection

## 🔧 Technical Details

### Anti-Detection Features

- **Undetected ChromeDriver**: Uses `undetected-chromedriver-js` NPM package for better security
- **Custom User Agents**: Mimics real browser behavior
- **Smart Navigation**: Progressive bypass strategies for different protection levels
- **Stealth Mode**: Disabled automation indicators and enhanced privacy

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