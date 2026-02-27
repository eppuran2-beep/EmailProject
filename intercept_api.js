const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const USER_DATA_DIR = path.join(__dirname, '.browser-data');

async function interceptHeaders() {
    console.log('Launching browser to intercept API request...');
    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: USER_DATA_DIR,
        args: ['--window-size=1200,800', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    let capturedPayload = null;
    let capturedUrl = null;
    let capturedHeaders = null;

    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('/messages/api/conversations/users/') && request.method() === 'POST') {
            capturedUrl = request.url();
            capturedHeaders = request.headers();
            capturedPayload = request.postData();
            console.log("CATCH:", capturedUrl);
        }
        request.continue();
    });

    console.log('Navigating to tori.fi/messages...');
    await page.goto('https://www.tori.fi/messages', { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('Waiting for conversations to load...');
    // Click first conversation in the list
    await page.waitForSelector('a[href^="/messages/id/"]', { timeout: 15000 });
    await page.click('a[href^="/messages/id/"]');

    console.log('Waiting for textarea...');
    await page.waitForSelector('textarea', { timeout: 15000 });

    console.log('Sending test message to trigger API...');
    await page.evaluate(() => {
        const ta = document.querySelector('textarea');
        if (ta) {
            ta.focus();
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
            nativeSetter.call(ta, 'Testi - API interception');
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    await new Promise(r => setTimeout(r, 1000));
    await page.keyboard.press('Enter');

    await new Promise(r => setTimeout(r, 4000));

    if (capturedUrl) {
        fs.writeFileSync('tori_api_payload.json', JSON.stringify({
            url: capturedUrl,
            headers: capturedHeaders,
            payload: capturedPayload
        }, null, 2));
        console.log('Successfully captured API headers, URL, and payload.');
    } else {
        console.log('Failed to capture API request. Taking screenshot...');
        await page.screenshot({ path: 'intercept_error.png' });
    }

    await browser.close();
}

interceptHeaders().catch(console.error);
