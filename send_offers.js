/* ============================================
   DDR5 RAM Bargain Agent — Send Offers
   ============================================

   This file serves as the REFERENCE for browser
   automation to send messages on Tori.fi.

   The actual sending is done via the Antigravity
   browser subagent, using the offer queue from
   offers.json (downloaded from the dashboard).

   PREREQUISITES:
   1. You must be logged into Tori.fi in the browser
   2. Generate and download offers.json from the dashboard
   3. Ask the agent: "Send the offers from offers.json"

   MESSAGING FLOW (per listing):
   1. Navigate to the listing URL
   2. Find the message textarea (visible when logged in)
   3. Type the offer message
   4. Click the "Lähetä" (Send) button
   5. Wait 15 seconds before next message

   ============================================ */

const fs = require('fs');
const path = require('path');

// Load offers
const OFFERS_FILE = path.join(__dirname, 'offers.json');

function loadOffers() {
    if (!fs.existsSync(OFFERS_FILE)) {
        console.error('❌ offers.json not found!');
        console.error('   Generate it from the dashboard first.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf-8'));
    return data.offers || [];
}

function printOfferSummary(offers) {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║   DDR5 RAM Auto-Offer Agent              ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
    console.log(`📬 ${offers.length} offers to send`);
    console.log(`📍 Regions: Helsinki, Espoo, Vantaa, Kauniainen`);
    console.log('');

    console.log('═══ OFFER QUEUE ═══');
    offers.forEach((offer, i) => {
        console.log(`  ${i + 1}. ${offer.title.substring(0, 50)}`);
        console.log(`     Asking: ${offer.askingPrice}€ → Offer: ${offer.offerPrice}€ (-${offer.discount}%)`);
        console.log(`     ${offer.location}`);
        console.log(`     ${offer.url}`);
        console.log('');
    });

    console.log('');
    console.log('═══ BROWSER AUTOMATION INSTRUCTIONS ═══');
    console.log('');
    console.log('For each offer, the browser agent should:');
    console.log('  1. Navigate to the listing URL');
    console.log('  2. Wait for page to load');
    console.log('  3. Find the message input area');
    console.log('     - If logged in: textarea should be visible');
    console.log('     - If NOT logged in: "Kirjaudu sisään" button shows');
    console.log('  4. Type the message into the textarea');
    console.log('  5. Click "Lähetä viesti" / "Lähetä" button');
    console.log('  6. Wait 15 seconds before next listing');
    console.log('');
    console.log('Ask the Antigravity agent to execute this by saying:');
    console.log('  "Send the offers from offers.json to Tori.fi sellers"');
    console.log('');
}

// Main
const offers = loadOffers();
if (offers.length === 0) {
    console.log('No offers to send.');
    process.exit(0);
}

printOfferSummary(offers);
