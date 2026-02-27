const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, '.browser-data');

async function extractCookies() {
    console.log('Launching browser to extract cookies...');
    const browser = await puppeteer.launch({
        headless: true, // we can do this headlessly
        userDataDir: USER_DATA_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('Navigating to tori.fi...');
    await page.goto('https://www.tori.fi/', { waitUntil: 'networkidle2', timeout: 30000 });

    const cookies = await page.cookies();
    const toriCookies = cookies.filter(c => c.domain.includes('tori.fi'));

    fs.writeFileSync('tori_cookies.json', JSON.stringify(toriCookies, null, 2));
    console.log(`Saved ${toriCookies.length} Tori.fi cookies to tori_cookies.json`);

    await browser.close();
}

extractCookies().catch(console.error);
