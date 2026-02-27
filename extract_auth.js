const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, '.browser-data');

async function extractAuth() {
    console.log('Launching browser to extract auth data...');
    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: USER_DATA_DIR,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    console.log('Navigating to tori.fi/messages...');
    // Go to messages to ensure auth state is loaded
    await page.goto('https://www.tori.fi/messages', { waitUntil: 'networkidle2', timeout: 30000 });

    // Get all cookies from the browser context
    const client = await page.createCDPSession();
    const { cookies } = await client.send('Network.getAllCookies');

    // Get localStorage
    const ls = await page.evaluate(() => JSON.stringify(window.localStorage));

    const authData = {
        cookies: cookies,
        localStorage: JSON.parse(ls)
    };

    fs.writeFileSync('tori_auth.json', JSON.stringify(authData, null, 2));
    console.log(`Saved ${cookies.length} cookies and localStorage to tori_auth.json`);

    await browser.close();
}

extractAuth().catch(console.error);
