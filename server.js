/* ============================================
   DDR5 RAM Bargain Agent — Server
   ============================================
   
   Usage:  node server.js
   
   Serves the dashboard AND handles automated
   message sending via API calls & Puppeteer.
   
   Endpoints:
   - GET /                   → Dashboard (index.html)
   - GET /results.json       → Listing data
   - GET /offers.json        → Current offer queue
   - GET /api/search         → Proxy Tori.fi search
   - POST /api/send-offers   → Send offers via Puppeteer (SSE stream)
   - POST /api/send-offers-api → Send offers via HTTP API (SSE stream)
   - POST /api/update-cookies  → Update session cookies/user ID
   ============================================ */

const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { randomUUID } = require('crypto');

const app = express();
const PORT = 3000;

// ── API Config (from cli.py) ──
const SEARCH_URL = 'https://www.tori.fi/recommerce/forsale/search/api/semantic-search/';
const MESSAGES_URL_TEMPLATE = 'https://www.tori.fi/messages/api/conversations/users/{user_id}/conversations';

const CONFIG_FILE = path.join(__dirname, '.api-config.json');

function loadApiConfig() {
    const defaults = {
        userId: '2051506126',
        cookie: '',
        headers: {
            'accept': '*/*',
            'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
            'content-type': 'application/json',
            'origin': 'https://www.tori.fi',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        }
    };
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
            return { ...defaults, ...saved, headers: { ...defaults.headers, ...saved.headers } };
        }
    } catch (e) { /* use defaults */ }
    return defaults;
}

function saveApiConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let apiConfig = loadApiConfig();

// ── Static files ──
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// ── Puppeteer browser state ──
let browser = null;
let browserPage = null;
const USER_DATA_DIR = path.join(__dirname, '.browser-data');

async function getBrowser() {
    if (!browser || !browser.isConnected()) {
        browser = await puppeteer.launch({
            headless: false,
            userDataDir: USER_DATA_DIR,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            defaultViewport: { width: 1200, height: 800 },
        });
    }
    return browser;
}

// ── Check login status ──
app.get('/api/login-status', async (req, res) => {
    try {
        const b = await getBrowser();
        const page = await b.newPage();
        await page.goto('https://www.tori.fi/messages', { waitUntil: 'networkidle2', timeout: 15000 });
        const url = page.url();
        const isLoggedIn = !url.includes('login') && !url.includes('auth');
        await page.close();
        res.json({ loggedIn: isLoggedIn, url });
    } catch (err) {
        res.json({ loggedIn: false, error: err.message });
    }
});

// ── Open login page ──
app.get('/api/login', async (req, res) => {
    try {
        const b = await getBrowser();
        const page = await b.newPage();
        await page.goto('https://www.tori.fi/recommerce/forsale/search?q=DDR5+RAM', { waitUntil: 'networkidle2', timeout: 20000 });
        res.json({ ok: true, message: 'Browser opened — please log in via the Puppeteer browser window' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Send offers (SSE stream for real-time progress) ──
app.post('/api/send-offers', async (req, res) => {
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    try {
        // Load offers
        let offers;
        if (req.body && req.body.offers && req.body.offers.length > 0) {
            offers = req.body.offers;
        } else {
            const offersPath = path.join(__dirname, 'offers.json');
            if (!fs.existsSync(offersPath)) {
                sendEvent('error', { message: 'No offers.json found. Generate offers first.' });
                res.end();
                return;
            }
            const data = JSON.parse(fs.readFileSync(offersPath, 'utf-8'));
            offers = data.offers || [];
        }

        const pending = offers.filter(o => o.status === 'pending');
        sendEvent('start', { total: pending.length });

        const b = await getBrowser();

        for (let i = 0; i < pending.length; i++) {
            const offer = pending[i];
            const msgUrl = `https://www.tori.fi/messages/new/${offer.id}`;

            sendEvent('progress', {
                index: i,
                total: pending.length,
                id: offer.id,
                title: offer.title,
                offerPrice: offer.offerPrice,
                status: 'sending',
            });

            try {
                const page = await b.newPage();
                await page.goto(msgUrl, { waitUntil: 'networkidle2', timeout: 20000 });

                // Wait for textarea to appear
                await page.waitForSelector('textarea', { timeout: 10000 });

                // Set message via native JS setter (handles Finnish characters)
                await page.evaluate((msg) => {
                    const ta = document.querySelector('textarea');
                    if (ta) {
                        ta.focus();
                        const nativeSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLTextAreaElement.prototype, 'value'
                        ).set;
                        nativeSetter.call(ta, msg);
                        ta.dispatchEvent(new Event('input', { bubbles: true }));
                        ta.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }, offer.message);

                // Small delay to let React process
                await new Promise(r => setTimeout(r, 500));

                // Press Enter to send
                await page.keyboard.press('Enter');

                // Wait for message to be sent
                await new Promise(r => setTimeout(r, 2000));

                await page.close();

                offer.status = 'sent';
                sendEvent('progress', {
                    index: i,
                    total: pending.length,
                    id: offer.id,
                    title: offer.title,
                    offerPrice: offer.offerPrice,
                    status: 'sent',
                });

            } catch (err) {
                offer.status = 'error';
                sendEvent('progress', {
                    index: i,
                    total: pending.length,
                    id: offer.id,
                    title: offer.title,
                    status: 'error',
                    error: err.message,
                });
            }

            // Rate limit: 15s between messages (except last)
            if (i < pending.length - 1) {
                sendEvent('waiting', { seconds: 15 });
                await new Promise(r => setTimeout(r, 15000));
            }
        }

        // Save updated statuses
        const offersPath = path.join(__dirname, 'offers.json');
        if (fs.existsSync(offersPath)) {
            const data = JSON.parse(fs.readFileSync(offersPath, 'utf-8'));
            data.offers = offers;
            fs.writeFileSync(offersPath, JSON.stringify(data, null, 2));
        }

        sendEvent('done', {
            sent: offers.filter(o => o.status === 'sent').length,
            errors: offers.filter(o => o.status === 'error').length,
        });

    } catch (err) {
        sendEvent('error', { message: err.message });
    }

    res.end();
});

// ── Save offers ──
app.post('/api/save-offers', (req, res) => {
    try {
        fs.writeFileSync(path.join(__dirname, 'offers.json'), JSON.stringify(req.body, null, 2));
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API-Based Endpoints (from cli.py logic)
// ============================================

// Helper: make HTTPS request using Node built-ins
function httpsRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
        };
        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
        });
        req.on('error', reject);
        if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
        req.end();
    });
}

// ── Search Proxy ──
app.get('/api/search', async (req, res) => {
    const { q, location, limit } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query parameter "q"' });

    const maxResults = parseInt(limit) || 50;
    const results = [];

    try {
        for (let page = 1; page <= 9; page++) {
            if (results.length >= maxResults) break;

            const params = new URLSearchParams({
                q: q,
                sort: 'PUBLISHED_DESC',
                context: 'items',
                page: String(page),
            });

            if (location && (location.toLowerCase() === 'uusimaa' || location.toLowerCase() === 'helsinki')) {
                params.set('locations', '18');
            }

            const searchUrl = SEARCH_URL + '?' + params.toString();
            const headers = { ...apiConfig.headers };
            if (apiConfig.cookie) headers['cookie'] = apiConfig.cookie;

            const resp = await httpsRequest(searchUrl, { method: 'GET', headers });

            if (resp.status !== 200) {
                console.error(`Search page ${page} returned status ${resp.status}`);
                break;
            }

            let data;
            try { data = JSON.parse(resp.data); } catch (e) { break; }

            let docs = [];
            if (Array.isArray(data)) docs = data;
            else if (data.items) docs = data.items;
            else if (data.docs) docs = data.docs;

            if (!docs.length) break;

            for (const doc of docs) {
                const adId = doc.id || doc.ad_id;
                const title = doc.heading || doc.title || 'Unknown';

                let price = 0;
                if (doc.price && typeof doc.price === 'object' && doc.price.amount != null) {
                    price = doc.price.amount;
                } else if (typeof doc.price === 'number') {
                    price = doc.price;
                }

                let loc = 'Unknown';
                if (doc.location) {
                    if (typeof doc.location === 'object') {
                        const pathArr = doc.location.path || [{}];
                        loc = pathArr[pathArr.length - 1]?.name || 'Unknown';
                    } else if (typeof doc.location === 'string') {
                        loc = doc.location;
                    }
                }

                let published = doc.published || '';
                if (published) published = published.split('T').pop().substring(0, 5);

                if (adId && !results.some(r => r.id === String(adId))) {
                    results.push({
                        id: String(adId),
                        title,
                        price,
                        location: loc,
                        time: published,
                    });
                }

                if (results.length >= maxResults) break;
            }
        }

        res.json({ results, total: results.length });
    } catch (err) {
        console.error('Search error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Send offers via API (like cli.py) — SSE stream ──
app.post('/api/send-offers-api', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    try {
        if (!apiConfig.cookie) {
            sendEvent('error', { message: 'No session cookies configured. Paste your cookies in the Settings panel first.' });
            res.end();
            return;
        }

        const offers = req.body?.offers || [];
        if (!offers.length) {
            sendEvent('error', { message: 'No offers provided.' });
            res.end();
            return;
        }

        const pending = offers.filter(o => o.status === 'pending');
        sendEvent('start', { total: pending.length });

        const messagesUrl = MESSAGES_URL_TEMPLATE.replace('{user_id}', apiConfig.userId);

        for (let i = 0; i < pending.length; i++) {
            const offer = pending[i];

            sendEvent('progress', {
                index: i,
                total: pending.length,
                id: offer.id,
                title: offer.title || '',
                offerPrice: offer.offerPrice || '',
                status: 'sending',
            });

            try {
                const payload = {
                    item: {
                        id: offer.id,
                        type: 'recommerce',
                    },
                    message: {
                        clientMessageId: randomUUID(),
                        body: offer.message,
                        messageType: 'textMessage',
                        attachments: [],
                    },
                };

                const reqHeaders = { ...apiConfig.headers };
                reqHeaders['cookie'] = apiConfig.cookie;
                reqHeaders['referer'] = `https://www.tori.fi/messages/new/${offer.id}`;

                const resp = await httpsRequest(messagesUrl, {
                    method: 'POST',
                    headers: reqHeaders,
                }, payload);

                if (resp.status >= 200 && resp.status < 300) {
                    offer.status = 'sent';
                    sendEvent('progress', {
                        index: i, total: pending.length,
                        id: offer.id, title: offer.title,
                        offerPrice: offer.offerPrice,
                        status: 'sent',
                    });
                } else {
                    let errMsg = `HTTP ${resp.status}`;
                    try {
                        const errData = JSON.parse(resp.data);
                        errMsg = errData.error || errMsg;
                    } catch (e) { /* keep generic */ }
                    offer.status = 'error';
                    sendEvent('progress', {
                        index: i, total: pending.length,
                        id: offer.id, title: offer.title,
                        status: 'error', error: errMsg,
                    });
                }

            } catch (err) {
                offer.status = 'error';
                sendEvent('progress', {
                    index: i, total: pending.length,
                    id: offer.id, title: offer.title,
                    status: 'error', error: err.message,
                });
            }

            // Rate limit: 3s between messages (except last)
            if (i < pending.length - 1) {
                sendEvent('waiting', { seconds: 3 });
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        sendEvent('done', {
            sent: pending.filter(o => o.status === 'sent').length,
            errors: pending.filter(o => o.status === 'error').length,
        });

    } catch (err) {
        sendEvent('error', { message: err.message });
    }

    res.end();
});

// ── Update API Cookies/Config ──
app.post('/api/update-cookies', (req, res) => {
    try {
        const { cookie, userId } = req.body;
        if (cookie !== undefined) apiConfig.cookie = cookie;
        if (userId !== undefined) apiConfig.userId = userId;
        saveApiConfig(apiConfig);
        res.json({ ok: true, userId: apiConfig.userId, hasCookie: !!apiConfig.cookie });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Get API Config (no sensitive data) ──
app.get('/api/config', (req, res) => {
    res.json({
        userId: apiConfig.userId,
        hasCookie: !!apiConfig.cookie,
        cookiePreview: apiConfig.cookie ? apiConfig.cookie.substring(0, 60) + '...' : '',
    });
});

// ── Start ──
app.listen(PORT, () => {
    console.log('');
    console.log('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
    console.log('\u2551   DDR5 RAM Bargain Agent        \u2551');
    console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');
    console.log('');
    console.log(`  Dashboard:     http://localhost:${PORT}`);
    console.log(`  Offers API:    http://localhost:${PORT}/api/send-offers`);
    console.log(`  Search API:    http://localhost:${PORT}/api/search?q=...`);
    console.log(`  API Sending:   http://localhost:${PORT}/api/send-offers-api`);
    console.log('');
    console.log('  First time? The browser will open for you to log in to Tori.fi.');
    console.log('  Your session is saved in .browser-data/');
    console.log(`  API cookies:   ${apiConfig.cookie ? 'loaded ✅' : 'not set ⚠️  — paste in dashboard'}`);
    console.log('');
});
