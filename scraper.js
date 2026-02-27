/* ============================================
   DDR5 RAM Bargain Agent — Tori.fi Scraper
   ============================================
   
   Usage:  node scraper.js
   
   Fetches DDR5 RAM listings from Tori.fi,
   extracts specs, calculates bargain scores,
   and saves results to results.json
   ============================================ */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ── Configuration ──
const SEARCH_QUERY = 'DDR5 RAM';
const MAX_PAGES = 3;
const BASE_URL = 'https://www.tori.fi';
const SEARCH_PATH = '/recommerce/forsale/search';
const OUTPUT_FILE = path.join(__dirname, 'results.json');

// ── Market Reference Prices (Feb 2026, EUR) ──
const MARKET_PRICES = {
    '8-base': 60,
    '8-mid': 75,
    '8-high': 90,
    '16-base': 160,
    '16-mid': 200,
    '16-high': 240,
    '32-base': 300,
    '32-mid': 350,
    '32-high': 420,
    '48-base': 420,
    '48-mid': 500,
    '48-high': 600,
    '64-base': 550,
    '64-mid': 650,
    '64-high': 750,
    '96-base': 800,
    '96-mid': 950,
    '96-high': 1100,
    '128-base': 1100,
    '128-mid': 1300,
    '128-high': 1500,
};

const FALLBACK_PRICE_PER_GB = 11;

// ── HTTP Fetch Helper ──
function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'fi-FI,fi;q=0.9,en;q=0.8',
            }
        }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith('/')) {
                    redirectUrl = BASE_URL + redirectUrl;
                }
                console.log(`  ↳ Redirected to: ${redirectUrl}`);
                fetchPage(redirectUrl).then(resolve).catch(reject);
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error(`Timeout fetching ${url}`));
        });
    });
}

// ── Parse Listings from HTML ──
function parseListings(html) {
    const listings = [];

    // Tori.fi renders listings as article elements or list items with structured data.
    // We'll use regex-based extraction since we don't have a DOM parser.

    // Strategy 1: Look for JSON-LD or embedded data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (jsonLdMatch) {
        for (const block of jsonLdMatch) {
            try {
                const jsonStr = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
                const data = JSON.parse(jsonStr);
                if (data['@type'] === 'ItemList' && data.itemListElement) {
                    for (const item of data.itemListElement) {
                        if (item.item || item.url) {
                            const listingData = item.item || item;
                            listings.push({
                                title: listingData.name || '',
                                price: parsePrice(listingData.offers?.price || listingData.price),
                                url: listingData.url || '',
                                location: listingData.availableAtOrFrom?.address?.addressLocality || '',
                            });
                        }
                    }
                }
                if (data['@type'] === 'Product') {
                    listings.push({
                        title: data.name || '',
                        price: parsePrice(data.offers?.price),
                        url: data.url || '',
                        location: '',
                    });
                }
            } catch (e) {
                // Skip invalid JSON
            }
        }
    }

    // Strategy 2: Parse listing links and prices from HTML structure
    // Look for listing patterns in the HTML
    if (listings.length === 0) {
        // Match listing cards — look for item URLs and nearby content
        // Tori.fi listing URLs: /recommerce/forsale/item/{id}
        const itemRegex = /href="(\/recommerce\/forsale\/item\/\d+)"[^>]*>/g;
        const seenUrls = new Set();
        let match;

        while ((match = itemRegex.exec(html)) !== null) {
            const itemUrl = BASE_URL + match[1];
            if (seenUrls.has(itemUrl)) continue;
            seenUrls.add(itemUrl);

            // Extract surrounding context (±2000 chars)
            const start = Math.max(0, match.index - 1500);
            const end = Math.min(html.length, match.index + 1500);
            const context = html.substring(start, end);

            // Extract title — look for text near the link
            let title = '';

            // Try to find title in aria-label or title attribute
            const ariaMatch = context.match(/aria-label="([^"]+)"/);
            if (ariaMatch) title = ariaMatch[1];

            if (!title) {
                // Look for heading text
                const headingMatch = context.match(/<h[23][^>]*>([^<]+)<\/h[23]>/);
                if (headingMatch) title = headingMatch[1].trim();
            }

            if (!title) {
                // Look for text content after the link
                const textMatch = context.match(new RegExp(escapeRegex(match[0]) + '\\s*([^<]+)'));
                if (textMatch) title = textMatch[1].trim();
            }

            // Extract price
            let price = null;
            const priceMatch = context.match(/(\d[\d\s]*\d?)\s*€/);
            if (priceMatch) {
                price = parsePrice(priceMatch[1]);
            }

            // Extract location
            let location = '';
            const locMatch = context.match(/(Helsinki|Espoo|Tampere|Turku|Oulu|Jyväskylä|Kuopio|Lahti|Vantaa|Porvoo|Rovaniemi|Joensuu|Vaasa|Lappeenranta|Hämeenlinna|Kotka|Pori|Kouvola|Mikkeli|Seinäjoki|Hyvinkää|Järvenpää|Rauma|Savonlinna|Kajaani|Siuntio|Kokkola|Lohja|Kerava|Riihimäki|Nokia|Raisio|Salo|Kangasala)[,\s]*([^<,"]*)/i);
            if (locMatch) {
                location = locMatch[1] + (locMatch[2] ? ', ' + locMatch[2].trim() : '');
            }

            // Extract date
            let date = '';
            const dateMatch = context.match(/(\d+\s*(?:pv|päivä|t|tunti|min|kk|viikko|vk)(?:\s*sitten)?)/i);
            if (dateMatch) {
                date = dateMatch[1];
            }

            if (title || price) {
                listings.push({
                    title: decodeHTMLEntities(title) || 'DDR5 RAM',
                    price,
                    url: itemUrl,
                    location: location.replace(/,\s*$/, ''),
                    date,
                });
            }
        }
    }

    // Strategy 3: Broader pattern matching for any listing structure
    if (listings.length === 0) {
        // Try matching a broader card pattern
        // Look for price + title combos
        const broadRegex = /<a[^>]+href="([^"]*(?:item|listing|ad)[^"]*)"[^>]*>[\s\S]*?<\/a>/gi;
        let bMatch;
        while ((bMatch = broadRegex.exec(html)) !== null) {
            const block = bMatch[0];
            const url = bMatch[1].startsWith('/') ? BASE_URL + bMatch[1] : bMatch[1];

            const titleMatch = block.match(/>([^<]{5,100})</);
            const priceMatch = block.match(/(\d[\d\s,.]*)\s*€/);

            if (titleMatch && /ddr5|ram|muisti/i.test(titleMatch[1])) {
                listings.push({
                    title: decodeHTMLEntities(titleMatch[1].trim()),
                    price: priceMatch ? parsePrice(priceMatch[1]) : null,
                    url,
                    location: '',
                    date: '',
                });
            }
        }
    }

    return listings;
}

// ── Extract RAM Specs ──
function extractRAMSpecs(title) {
    const t = title.toLowerCase();
    const specs = { capacityGB: null, speed: null, speedTier: 'base', sticks: null, type: 'desktop' };

    if (/so-?dimm|läppäri|laptop|notebook|kannettava/i.test(t)) {
        specs.type = 'laptop';
    }

    // Kit notation: 2x16, 4x8, etc.
    const kitMatch = t.match(/(\d)\s*[x×]\s*(\d{1,3})\s*(?:gb|gt)/);
    if (kitMatch) {
        specs.sticks = parseInt(kitMatch[1]);
        const perStick = parseInt(kitMatch[2]);
        specs.capacityGB = specs.sticks * perStick;
    }

    // Total capacity
    if (!specs.capacityGB) {
        const capMatch = t.match(/(\d{1,3})\s*(?:gb|gt)\b/);
        if (capMatch) {
            specs.capacityGB = parseInt(capMatch[1]);
        }
    }

    // Speed: DDR5-5600, 5600MHz, etc.
    const speedMatch = t.match(/(?:ddr5[\s-]*)?(\d{4})\s*(?:mhz|mt\/s|mt)?/);
    if (speedMatch) {
        const spd = parseInt(speedMatch[1]);
        if (spd >= 4000 && spd <= 9000) {
            specs.speed = spd;
            if (spd >= 6000) specs.speedTier = 'high';
            else if (spd >= 5400) specs.speedTier = 'mid';
            else specs.speedTier = 'base';
        }
    }

    return specs;
}

// ── Calculate Bargain Score ──
function calculateBargainScore(price, specs) {
    if (!price || price <= 0) return 0;

    let referencePrice = null;

    if (specs.capacityGB) {
        const key = `${specs.capacityGB}-${specs.speedTier}`;
        referencePrice = MARKET_PRICES[key];
        if (!referencePrice) {
            referencePrice = specs.capacityGB * FALLBACK_PRICE_PER_GB;
        }
        if (specs.type === 'laptop') {
            referencePrice *= 0.85;
        }
    }

    if (!referencePrice) return 50;

    const ratio = price / referencePrice;

    if (ratio <= 0.40) return 95;
    if (ratio <= 0.50) return 90;
    if (ratio <= 0.60) return 85;
    if (ratio <= 0.70) return 78;
    if (ratio <= 0.80) return 68;
    if (ratio <= 0.90) return 55;
    if (ratio <= 1.00) return 45;
    if (ratio <= 1.10) return 35;
    if (ratio <= 1.25) return 25;
    return 10;
}

// ── Price Parser ──
function parsePrice(priceStr) {
    if (typeof priceStr === 'number') return priceStr;
    if (!priceStr) return null;
    const cleaned = String(priceStr).replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

// ── HTML Helpers ──
function decodeHTMLEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&auml;/g, 'ä')
        .replace(/&ouml;/g, 'ö')
        .replace(/&Auml;/g, 'Ä')
        .replace(/&Ouml;/g, 'Ö');
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Main ──
async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   DDR5 RAM Bargain Agent — Tori.fi      ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    const allListings = [];
    const seenUrls = new Set();

    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${BASE_URL}${SEARCH_PATH}?q=${encodeURIComponent(SEARCH_QUERY)}&page=${page}`;
        console.log(`📡 Fetching page ${page}/${MAX_PAGES}: ${url}`);

        try {
            const html = await fetchPage(url);
            console.log(`   ✓ Received ${(html.length / 1024).toFixed(0)} KB`);

            const listings = parseListings(html);
            console.log(`   ✓ Found ${listings.length} listings on page ${page}`);

            for (const listing of listings) {
                if (!seenUrls.has(listing.url)) {
                    seenUrls.add(listing.url);
                    allListings.push(listing);
                }
            }

            // Small delay between pages
            if (page < MAX_PAGES) {
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (err) {
            console.error(`   ✗ Error on page ${page}: ${err.message}`);
        }
    }

    console.log('');
    console.log(`📊 Total unique listings: ${allListings.length}`);

    // Enrich with specs and bargain score
    for (const listing of allListings) {
        listing.specs = extractRAMSpecs(listing.title);
        listing.bargainScore = calculateBargainScore(listing.price, listing.specs);
        listing.pricePerGB = listing.specs.capacityGB && listing.price
            ? +(listing.price / listing.specs.capacityGB).toFixed(1)
            : null;
    }

    // Sort by bargain score (best deals first)
    allListings.sort((a, b) => b.bargainScore - a.bargainScore);

    // Print top bargains
    const bargains = allListings.filter(l => l.bargainScore >= 65);
    console.log(`🔥 Bargains found: ${bargains.length}`);
    console.log('');

    if (bargains.length > 0) {
        console.log('═══ TOP BARGAINS ═══');
        for (const b of bargains.slice(0, 10)) {
            const cap = b.specs.capacityGB ? `${b.specs.capacityGB}GB` : '?GB';
            const spd = b.specs.speed ? ` DDR5-${b.specs.speed}` : '';
            const ppgb = b.pricePerGB ? ` (${b.pricePerGB}€/GB)` : '';
            console.log(`  🟢 [Score: ${b.bargainScore}] ${b.price}€ — ${cap}${spd}${ppgb}`);
            console.log(`     ${b.title}`);
            console.log(`     ${b.url}`);
            console.log('');
        }
    }

    // Print all listings summary
    console.log('═══ ALL LISTINGS ═══');
    for (const l of allListings) {
        const cap = l.specs.capacityGB ? `${l.specs.capacityGB}GB` : '?GB';
        const spd = l.specs.speed ? ` DDR5-${l.specs.speed}` : '';
        const scoreIcon = l.bargainScore >= 75 ? '🟢' : l.bargainScore >= 60 ? '🔵' : l.bargainScore >= 40 ? '🟡' : '🔴';
        console.log(`  ${scoreIcon} [${l.bargainScore}] ${l.price != null ? l.price + '€' : 'no price'} — ${cap}${spd} — ${l.title.substring(0, 60)}`);
    }

    // Save results
    const output = {
        scannedAt: new Date().toISOString(),
        query: SEARCH_QUERY,
        totalListings: allListings.length,
        bargainsFound: bargains.length,
        listings: allListings,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
    console.log('');
    console.log(`💾 Results saved to ${OUTPUT_FILE}`);
    console.log('   Open index.html in a browser to view the dashboard!');
    console.log('');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
