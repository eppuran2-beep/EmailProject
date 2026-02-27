/* Merge location + ToriDiili data into results.json */
const fs = require('fs');

const locationMap = {
    "36984745": "Siuntio", "37301556": "Tampere", "37290824": "Porvoo, Kulloonkylä", "37287607": "Helsinki, Jakomäki", "37276120": "Jyväskylä", "36566613": "Helsinki, Pohjois-Haaga", "37252447": "Turku", "37255701": "Helsinki, Puotila", "37230974": "Tampere", "37206223": "Helsinki, Kaitalahti", "37135093": "Turku", "37124489": "Tampere, Hervanta", "25854670": "Joensuu", "34652359": "Joensuu", "37091944": "Helsinki, Kannelmäki", "34441942": "Turku", "34493719": "Vantaa, Ylästö", "36900819": "Tampere", "36865387": "Vantaa, Koivukylä", "36856613": "Tampere", "36856427": "Tampere", "36780539": "Espoo, Laajalahti", "36740816": "Salo", "34264219": "Tampere", "36703020": "Turku", "34105431": "Espoo, Pohjois-Leppävaara", "34105260": "Espoo, Pohjois-Leppävaara", "36527086": "Kangasala", "36604368": "Oulu", "36587204": "Kangasala", "36159466": "Helsinki, Pohjois-Haaga", "36540570": "Helsinki, Keskusta", "36440020": "Tampere", "36396812": "Turku", "36369382": "Espoo, Otaniemi", "36352500": "Tuusula", "36163375": "Tampere", "36128480": "Tampere", "35987213": "Helsinki, Viikki", "35862899": "Espoo, Laajalahti", "35826793": "Espoo, Etelä-Leppävaara", "35748737": "Vantaa, Kivistö", "35674037": "Turku", "35662332": "Tampere", "35547326": "Lappeenranta", "35418137": "Lahti", "35389322": "Vantaa, Jokiniemi", "34915302": "Oulu", "34890887": "Turku", "37371693": "Espoo, Saunalahti", "37359314": "Hyvinkää", "37349294": "Rauma", "37319473": "Helsinki, Keskusta", "37318589": "Oulu", "37312212": "Tampere", "37299806": "Vantaa, Mikkola", "37194058": "Hämeenlinna", "37278314": "Helsinki, Puotila", "37270785": "Espoo, Kauklahti", "37263251": "Helsinki, Kallio", "37251874": "Järvenpää", "37248953": "Lohja", "37246232": "Tampere", "37234173": "Lohja", "32993516": "Vantaa, Jokiniemi", "37230838": "Espoo, Henttaa", "37229086": "Vantaa, Seutula", "35851990": "Lahti", "37203429": "Vantaa, Martinlaakso", "34545357": "Lahti", "37191915": "Espoo, Matinkylä", "37190618": "Lohja", "34718217": "Vantaa, Tikkurila", "37188155": "Nurmijärvi", "37186471": "Vantaa, Kaivoksela", "34716360": "Helsinki, Länsi-Pasila", "37156274": "Kotka", "34650771": "Joensuu", "37150304": "Espoo, Saunalahti", "37135180": "Oulu", "36939797": "Helsinki, Viikki", "36926858": "Kuopio", "36884733": "Helsinki, Kamppi", "36835870": "Tampere", "36780101": "Turku", "36771673": "Helsinki, Lauttasaari", "34208850": "Espoo, Tuomarila", "34105485": "Vantaa, Jokiniemi", "36666341": "Tampere", "36653386": "Jyväskylä", "34039908": "Porvoo", "36637885": "Helsinki, Kannelmäki", "36587190": "Helsinki, Roihupelto", "36568855": "Helsinki, Kallio", "34015617": "Tampere", "36419599": "Espoo, Saunalahti", "36417531": "Oulu", "36395582": "Helsinki, Laajasalo", "36368193": "Turku", "36343194": "Espoo, Latokaski", "36267914": "Turku", "36230337": "Espoo, Etelä-Leppävaara", "36128093": "Lohja", "36104084": "Helsinki, Kulosaari", "36040797": "Helsinki, Käpylä", "36023959": "Espoo, Kalajärvi", "35959575": "Helsinki, Siltamäki", "35887952": "Lahti", "35775343": "Vantaa, Vantaanpuisto", "35508773": "Helsinki, Länsi-Pasila", "35472976": "Espoo, Espoonlahti", "35468510": "Vantaa, Päiväkumpu", "35462455": "Tuusula", "37275313": "Helsinki, Toukola", "35296044": "Jyväskylä", "35180401": "Lahti", "37110104": "Espoo, Saunalahti", "34167688": "Salo", "37071726": "Hämeenlinna", "37066107": "Tampere", "37030704": "Turku", "34575919": "Nurmijärvi", "34575495": "Nurmijärvi", "36955446": "Vantaa, Hämevaara", "35819096": "Rovaniemi", "35778812": "Hyvinkää", "35768194": "Hyvinkää", "35093876": "Rauma", "35657905": "Oulu", "35630126": "Riihimäki", "35585052": "Nurmijärvi", "35569447": "Oulu", "35537231": "Jyväskylä", "37345955": "Tampere", "37253245": "Oulu"
};

const data = JSON.parse(fs.readFileSync('results.json', 'utf-8'));
let updated = 0;
data.listings.forEach(l => {
    const id = l.url.split('/').pop();
    if (locationMap[id]) {
        l.location = locationMap[id];
        updated++;
    }
});

const hki = data.listings.filter(l => /helsinki|espoo|vantaa|kauniainen/i.test(l.location || ''));
console.log(`Updated ${updated} listings with location data`);
console.log(`Helsinki metro area: ${hki.length} listings`);
hki.forEach(l => console.log(`  ${l.location} - ${l.price}€ - ${l.title.substring(0, 50)}`));

fs.writeFileSync('results.json', JSON.stringify(data, null, 2));
console.log('Saved updated results.json');
