/* Generate offers.json from results.json */
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('results.json', 'utf-8'));

const TARGET_REGIONS = ['helsinki', 'espoo', 'vantaa', 'kauniainen'];
const isInRegion = l => TARGET_REGIONS.some(r => (l.location || '').toLowerCase().includes(r));
const isEligible = l => isInRegion(l) || l.toridiili;

const eligible = data.listings.filter(l => l.price && l.price > 0 && isEligible(l) && l.bargainScore > 0);
eligible.sort((a, b) => b.bargainScore - a.bargainScore);

const template = 'Moi! Kiinnostuin ilmoituksestasi. Olisiko {price}\u20ac mahdollinen hinta? Voin noutaa p\u00e4\u00e4kaupunkiseudulta. Kiitos!';

const offers = eligible.map(l => {
    const discount = l.bargainScore >= 80 ? 10 : l.bargainScore >= 65 ? 20 : 30;
    const raw = l.price * (1 - discount / 100);
    const offerPrice = Math.round(Math.round(raw) / 5) * 5;
    const id = l.url.split('/').pop();
    return {
        id,
        title: l.title,
        url: l.url,
        location: l.location || '',
        toridiili: l.toridiili || false,
        askingPrice: l.price,
        offerPrice,
        discount,
        message: template.replace('{price}', offerPrice),
        status: 'pending'
    };
});

const out = { generatedAt: new Date().toISOString(), totalOffers: offers.length, offers };
fs.writeFileSync('offers.json', JSON.stringify(out, null, 2));
console.log('Generated ' + offers.length + ' offers');
offers.slice(0, 10).forEach((o, i) => {
    console.log(`  ${i + 1}. [${o.id}] ${o.offerPrice}e (-${o.discount}%) ${o.title.substring(0, 50)}`);
});
