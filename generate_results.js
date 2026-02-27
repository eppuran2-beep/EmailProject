/* Generates results.json from browser-scraped data */

const fs = require('fs');
const path = require('path');

// ── Market Reference Prices (Feb 2026, EUR) ──
const MARKET_PRICES = {
    '8-base': 60, '8-mid': 75, '8-high': 90,
    '16-base': 160, '16-mid': 200, '16-high': 240,
    '32-base': 300, '32-mid': 350, '32-high': 420,
    '48-base': 420, '48-mid': 500, '48-high': 600,
    '64-base': 550, '64-mid': 650, '64-high': 750,
    '96-base': 800, '96-mid': 950, '96-high': 1100,
    '128-base': 1100, '128-mid': 1300, '128-high': 1500,
};
const FALLBACK_PPG = 11;

function extractRAMSpecs(title) {
    const t = title.toLowerCase();
    const specs = { capacityGB: null, speed: null, speedTier: 'base', sticks: null, type: 'desktop' };
    if (/so-?dimm|läppäri|laptop|notebook|kannettava|sodimm/i.test(t)) specs.type = 'laptop';
    const kitMatch = t.match(/(\d)\s*[x×]\s*(\d{1,3})\s*(?:gb|gt)/);
    if (kitMatch) { specs.sticks = parseInt(kitMatch[1]); specs.capacityGB = specs.sticks * parseInt(kitMatch[2]); }
    if (!specs.capacityGB) { const m = t.match(/(\d{1,3})\s*(?:gb|gt)\b/); if (m) specs.capacityGB = parseInt(m[1]); }
    const sm = t.match(/(\d{4})\s*(?:mhz|mt\/s|mt)?/);
    if (sm) { const s = parseInt(sm[1]); if (s >= 4000 && s <= 9000) { specs.speed = s; specs.speedTier = s >= 6000 ? 'high' : s >= 5400 ? 'mid' : 'base'; } }
    return specs;
}

function calcScore(price, specs) {
    if (!price || price <= 0) return 0;
    let ref = null;
    if (specs.capacityGB) {
        ref = MARKET_PRICES[`${specs.capacityGB}-${specs.speedTier}`] || specs.capacityGB * FALLBACK_PPG;
        if (specs.type === 'laptop') ref *= 0.85;
    }
    if (!ref) return 50;
    const r = price / ref;
    if (r <= 0.40) return 95; if (r <= 0.50) return 90; if (r <= 0.60) return 85;
    if (r <= 0.70) return 78; if (r <= 0.80) return 68; if (r <= 0.90) return 55;
    if (r <= 1.00) return 45; if (r <= 1.10) return 35; if (r <= 1.25) return 25;
    return 10;
}

// Raw scraped listings from browser
const raw = [
    { "title": "Uusi näyttävä custom kone aihio ALE!", "price": 1390, "url": "https://www.tori.fi/recommerce/forsale/item/36984745" },
    { "title": "Kingston Fury RAM-muisti KF556S40IB-16 DDR5 5600MT/s CL40-40-40 1.1v PnP 16 GB", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/37301556" },
    { "title": "Kingston Fury Beast DDR5 32gb RAM kit", "price": 399, "url": "https://www.tori.fi/recommerce/forsale/item/37290824" },
    { "title": "Kingston FURY Impact DDR5 5600 MHz CL40 SO-DIMM 32 Gt RAM muisti", "price": 300, "url": "https://www.tori.fi/recommerce/forsale/item/37287607" },
    { "title": "Ddr5 ram 2x8gb(16gb) läppärille", "price": 115, "url": "https://www.tori.fi/recommerce/forsale/item/37276120" },
    { "title": "Crucial Pro DDR5 RAM-muisti 32GB 6000MT/s", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/36566613" },
    { "title": "Predator 16GB DDR5 5600 CL46 RAM-muisti", "price": 150, "url": "https://www.tori.fi/recommerce/forsale/item/37252447" },
    { "title": "Lenovo LOQ Ryzen 7 7435HS RTX 4050 24G DDR5 RAM 512G SSD", "price": 540, "url": "https://www.tori.fi/recommerce/forsale/item/37255701" },
    { "title": "DDR5 RAM-muistit 16 Gt", "price": 170, "url": "https://www.tori.fi/recommerce/forsale/item/37230974" },
    { "title": "Kingston Fury 16Gt DDR5 Ram", "price": 200, "url": "https://www.tori.fi/recommerce/forsale/item/37206223" },
    { "title": "Crucial RAM DDR5 SODIMM 1x32GB 5600MHz CL46", "price": 300, "url": "https://www.tori.fi/recommerce/forsale/item/37135093" },
    { "title": "Acer Predator RAM-muisti DDR5 16gb", "price": 160, "url": "https://www.tori.fi/recommerce/forsale/item/37124489" },
    { "title": "DDR5 RAM 16GB 4800MHz Micron Notebook SO DIMM 262pin for Laptop", "price": 180, "url": "https://www.tori.fi/recommerce/forsale/item/25854670" },
    { "title": "Kingston FURY Impact 32 GB DDR5 RAM muisti 5600 MT/s CL40 (musta)", "price": 380, "url": "https://www.tori.fi/recommerce/forsale/item/34652359" },
    { "title": "Kingston ValueRAM DDR5 RAM-muisti 32 Gt 5600 MHz", "price": 175, "url": "https://www.tori.fi/recommerce/forsale/item/37091944" },
    { "title": "Corsair Vengeance DDR5 32GB RAM 6000MHz", "price": 425, "url": "https://www.tori.fi/recommerce/forsale/item/34441942" },
    { "title": "Kingston Fury Beast 16gb DDR5 RAM-muisti KF560C36BBEK2-32", "price": 210, "url": "https://www.tori.fi/recommerce/forsale/item/34493719" },
    { "title": "Acer Predator DDR5 RAM-muisti 16GB 5600MHz", "price": 150, "url": "https://www.tori.fi/recommerce/forsale/item/36900819" },
    { "title": "Corsair Vengeance DDR5 32 GB RAM", "price": 420, "url": "https://www.tori.fi/recommerce/forsale/item/36865387" },
    { "title": "Dell 32Gt DDR5 5600 MHz SO-DIMM RAM-muisti", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/36856613" },
    { "title": "Dell 32Gt DDR5 5600 MHz SO-DIMM RAM-muisti", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/36856427" },
    { "title": "DDR5 Ram-muisti 32Gt 6000Mhz RGB", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/36780539" },
    { "title": "Corsair Vengeance DDR5 RAM-muisti 32GB 6400MHz AMD, CL36", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/36740816" },
    { "title": "Samsung RAM-muisti 16 GB (2 x 8gb DDR5, 4800 MHz, SODIMM)", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/34264219" },
    { "title": "DDR5 16 GB (2X8) Laptop RAM 5600mhz", "price": 240, "url": "https://www.tori.fi/recommerce/forsale/item/36703020" },
    { "title": "Corsair Vengeance RGB DDR5 RAM 96GB 6000MHz", "price": 850, "url": "https://www.tori.fi/recommerce/forsale/item/34105431" },
    { "title": "Crucial DDR5 RAM 64GB 6400 MT/s (unopened)", "price": 579, "url": "https://www.tori.fi/recommerce/forsale/item/34105260" },
    { "title": "Samsung 16GB DDR5 RAM-muistit / 2 x 8GB / 4800MHz", "price": 150, "url": "https://www.tori.fi/recommerce/forsale/item/36527086" },
    { "title": "G.Skill Trident Z5 RGB DDR5 RAM-muistit 48 Gt (2x24 Gt) valkoinen", "price": 550, "url": "https://www.tori.fi/recommerce/forsale/item/36604368" },
    { "title": "Käyttämätön samsung 16GB DDR5 Ram vain nouto", "price": 80, "url": "https://www.tori.fi/recommerce/forsale/item/36587204" },
    { "title": "DDR5 RAM MEMORY 32GB CRUCIAL 6000 MTS", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/36159466" },
    { "title": "Corsair Vengeance DDR5 32GB RAM-muistit", "price": 400, "url": "https://www.tori.fi/recommerce/forsale/item/36540570" },
    { "title": "DDR5 RAM-muisti 8GB", "price": 60, "url": "https://www.tori.fi/recommerce/forsale/item/36518167" },
    { "title": "DDR5 2x8 GB 16 GB RAM 6000 MHz", "price": 280, "url": "https://www.tori.fi/recommerce/forsale/item/36440020" },
    { "title": "Crucial DDR5 Pro oc RAM-muistit 32GB", "price": 550, "url": "https://www.tori.fi/recommerce/forsale/item/36396812" },
    { "title": "Corsair Vengeance DDR5 32 GB 36 CL 1.35V RAM", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/36369382" },
    { "title": "Tehokas pelitietokone – i5-13600K + RTX 5070 Ti + 32GB ddr5 ram + 3TB ssd", "price": 1785, "url": "https://www.tori.fi/recommerce/forsale/item/36352500" },
    { "title": "RAM-muistit 16GB DDR5 sodimm", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/36163375" },
    { "title": "64GB DDR5 Corsair Dominator Platinum RGB RAM-muistit", "price": 725, "url": "https://www.tori.fi/recommerce/forsale/item/36128480" },
    { "title": "Corsair RGB 32gb ddr5 ram-muisti", "price": 385, "url": "https://www.tori.fi/recommerce/forsale/item/36004091" },
    { "title": "Corsair Vengeance SODIMM DDR5 RAM-muisti 32GB (2x 16GB) 4800MHz", "price": 369, "url": "https://www.tori.fi/recommerce/forsale/item/35987213" },
    { "title": "Corsair Vengeance DDR5 RAM-muistit 48GB 7000 CL40 (2x 24GB)", "price": 450, "url": "https://www.tori.fi/recommerce/forsale/item/35862899" },
    { "title": "DDR5 SODIMM RAM 16GB (2×8GB) 5600 MHz CL46 - SK hynix", "price": 85, "url": "https://www.tori.fi/recommerce/forsale/item/35826793" },
    { "title": "Corsair Vengeance RGB 48Gb RAM DDR5-6400 CL36 dual", "price": 750, "url": "https://www.tori.fi/recommerce/forsale/item/35748737" },
    { "title": "G.Skill Trident Z5 Neo DDR5 (16GBx2) 6000MHz CL 30 RAM-muisti", "price": 400, "url": "https://www.tori.fi/recommerce/forsale/item/35674037" },
    { "title": "Kingston Fury Beast DDR5 RAM -muistimoduulit 2 x 16 GB", "price": 320, "url": "https://www.tori.fi/recommerce/forsale/item/35662332" },
    { "title": "Kingston FURY DDR5 16GB (2x8GB) 5600MHz RAM muisti", "price": 200, "url": "https://www.tori.fi/recommerce/forsale/item/35547326" },
    { "title": "Kingston Fury RAM-muistit (SO-DIMM DDR5 LÄPPÄREIHIN, 32gb ja 64gb)", "price": 1100, "url": "https://www.tori.fi/recommerce/forsale/item/35418137" },
    { "title": "Kingston DDR5 32GB ECC Server Premier RAM", "price": 550, "url": "https://www.tori.fi/recommerce/forsale/item/35389322" },
    { "title": "Crucial DDR5 32gb (16GBx2) RAM (5600Mhz) kannettavaan tietokoneeseen", "price": 220, "url": "https://www.tori.fi/recommerce/forsale/item/34915302" },
    { "title": "Corsair DDR5 16GB RGB 6000Mhz CL30 1.4V RAM", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/34890887" },
    { "title": "Kingston Fury DDR5 6000Mhz 2x16gb CL30 RGB", "price": 430, "url": "https://www.tori.fi/recommerce/forsale/item/37371693" },
    { "title": "Corsair 64GB (2 x 32GB) Dominator Platinum RGB, DDR5 6600MHz, CL32, 1.40V, musta", "price": 900, "url": "https://www.tori.fi/recommerce/forsale/item/37359314" },
    { "title": "Corsair 32GB (2 x 16GB) Vengeance RGB, DDR5 6000MHz, CL30, 1.40V", "price": 400, "url": "https://www.tori.fi/recommerce/forsale/item/37349294" },
    { "title": "2x8 DDR5 5200Mhz Kingston Fury", "price": 175, "url": "https://www.tori.fi/recommerce/forsale/item/37319473" },
    { "title": "DDR5 64GB (2 x 32GB) Kingston, 5600MHz, CL40", "price": 490, "url": "https://www.tori.fi/recommerce/forsale/item/37318589" },
    { "title": "Corsair Vengeance RGB DDR5 32GB (2x16GB) 6000MHz valkoinen", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/37312212" },
    { "title": "16GB DDR5 5600Mhz", "price": 111, "url": "https://www.tori.fi/recommerce/forsale/item/37305904" },
    { "title": "Kingston FURY Beast DDR5 6000 MHz CL36 32GB – 2v TAKKU", "price": 389, "url": "https://www.tori.fi/recommerce/forsale/item/37299806" },
    { "title": "Kingston 32GB (2 x 16GB) Fury Beast DDR5, 6000MHz, CL36, 1,35V", "price": 290, "url": "https://www.tori.fi/recommerce/forsale/item/37194058" },
    { "title": "Kingston FURY Beast DDR5-5600 - 16GB - CL36", "price": 240, "url": "https://www.tori.fi/recommerce/forsale/item/37278314" },
    { "title": "Corsair Vengeance 32GB RGB DDR5 6000MHz", "price": 410, "url": "https://www.tori.fi/recommerce/forsale/item/37270785" },
    { "title": "Läppärin muisti Samsung DDR5 16gb", "price": 120, "url": "https://www.tori.fi/recommerce/forsale/item/37263251" },
    { "title": "2x SO-DIMM —-> DIMM DDR5 Adapteri", "price": 45, "url": "https://www.tori.fi/recommerce/forsale/item/37251874" },
    { "title": "8Gt DDR5 4800MHz So-Dimm muistikampa", "price": 65, "url": "https://www.tori.fi/recommerce/forsale/item/37248953" },
    { "title": "Avaamaton IRDM DDR5 32GB (2x16GB) 6000MHz CL30 – Uusi!", "price": 440, "url": "https://www.tori.fi/recommerce/forsale/item/37246232" },
    { "title": "16Gt DDR5 5600MHz So-Dimm muistikampa -SK Hynix", "price": 140, "url": "https://www.tori.fi/recommerce/forsale/item/37234173" },
    { "title": "2x 96gb hynix ECC DDR5 2Rx4 5600MHz PC5-44800 RDIMM", "price": 3000, "url": "https://www.tori.fi/recommerce/forsale/item/32993516" },
    { "title": "Kingston Fury Beast 32GB DDR5 6000Mhz CL36", "price": 300, "url": "https://www.tori.fi/recommerce/forsale/item/37230838" },
    { "title": "Corsair Vengeance 96GB 96Gt (2x48GB 2x48Gt) DDR5 RGB 6000MHz", "price": 838, "url": "https://www.tori.fi/recommerce/forsale/item/37229086" },
    { "title": "32GB DDR5 6000MHz CL30 / Corsair Vengeance RGB / Takuu", "price": 399, "url": "https://www.tori.fi/recommerce/forsale/item/35851990" },
    { "title": "Crucial 16GB (2 x 8GB) DDR5 5600MHz, CL46", "price": 170, "url": "https://www.tori.fi/recommerce/forsale/item/37217535" },
    { "title": "corsair vengeance 32gb ddr5 6000mhz cl36", "price": 380, "url": "https://www.tori.fi/recommerce/forsale/item/37203429" },
    { "title": "32GB DDR5 6000MHz CL36 / Kingston FURY Beast RGB / Elinikäinen takuu", "price": 369, "url": "https://www.tori.fi/recommerce/forsale/item/34545357" },
    { "title": "Corsair 64GB (2 x 32GB) Vengeance, DDR5 5600MHz, CL40", "price": 600, "url": "https://www.tori.fi/recommerce/forsale/item/37191915" },
    { "title": "16Gt DDR5 5600MHz So-Dimm muistikampa -Samsung", "price": 140, "url": "https://www.tori.fi/recommerce/forsale/item/37190618" },
    { "title": "96GB Corsair Vengeance RGB, DDR5", "price": 1200, "url": "https://www.tori.fi/recommerce/forsale/item/34718217" },
    { "title": "Corsair Dominator Platinum 32GB (16x2) DDR5 keskusmuistit", "price": 425, "url": "https://www.tori.fi/recommerce/forsale/item/37188155" },
    { "title": "Micron DDR5-muisti 32GB (2 x 16GB) DDR5 5600MHz, SO-DIMM, CL46", "price": 200, "url": "https://www.tori.fi/recommerce/forsale/item/37186471" },
    { "title": "Corsair VENGEANCE® 192GB (4x48GB) DDR5 DRAM 5200MT/s CL38", "price": 1600, "url": "https://www.tori.fi/recommerce/forsale/item/34716360" },
    { "title": "Kingston Fury Impact 64GB (2x32GB) 5600MHz DDR5 SODIMM", "price": 450, "url": "https://www.tori.fi/recommerce/forsale/item/37156274" },
    { "title": "Kingston FURY Beast 2x16GB DDR5 5600 CL36", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/34650771" },
    { "title": "DDR5 32Gb CL30 6000Mhz Corsair Vengeance", "price": 410, "url": "https://www.tori.fi/recommerce/forsale/item/37150304" },
    { "title": "Corsair Vengeance 32 GB (2 x 16 GB) DDR5-5600 CL36", "price": 295, "url": "https://www.tori.fi/recommerce/forsale/item/37135180" },
    { "title": "Samsung DDR5 16GB SO-DIMM", "price": 120, "url": "https://www.tori.fi/recommerce/forsale/item/37132732" },
    { "title": "KINGSTON FURY BEAST 64GB (2X32) DDR5 6000MHZ", "price": 650, "url": "https://www.tori.fi/recommerce/forsale/item/37110104" },
    { "title": "Kingston FURY Beast DDR5-6000 - 64GB", "price": 800, "url": "https://www.tori.fi/recommerce/forsale/item/34167688" },
    { "title": "Kingston 32gb DDR5-4800 CL38 262-Pin SODIMM (XMP)", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/37071726" },
    { "title": "Myydään: Renegade DDR5-muistit, 7200MT/s, CL38. Uudet", "price": 550, "url": "https://www.tori.fi/recommerce/forsale/item/37066107" },
    { "title": "Patriot Viper Xtreme 5 RGB 32 Gt (2x16 Gt) DDR5 8000 MHz, CL38", "price": 390, "url": "https://www.tori.fi/recommerce/forsale/item/37030704" },
    { "title": "Kingston DDR5 1x16GB", "price": 160, "url": "https://www.tori.fi/recommerce/forsale/item/34575919" },
    { "title": "Adata DDR5 2x16GB", "price": 320, "url": "https://www.tori.fi/recommerce/forsale/item/34575495" },
    { "title": "Trident Z5 Neo RGB DDR5 2x32 6000MHz cl30", "price": 595, "url": "https://www.tori.fi/recommerce/forsale/item/36999845" },
    { "title": "Patriot Viper Xtreme5 DDR5 2x16Gb 8000Mhz", "price": 450, "url": "https://www.tori.fi/recommerce/forsale/item/36955446" },
    { "title": "Corsair Vengeance RGB DDR5 6400 MHz CL32 32 Gt", "price": 750, "url": "https://www.tori.fi/recommerce/forsale/item/36939797" },
    { "title": "DDR5 64Gb 6000 Mhz CL30 *Takuu*", "price": 599, "url": "https://www.tori.fi/recommerce/forsale/item/36926858" },
    { "title": "DDR5 5600Mt/s SODIMM, Yht 16Gb", "price": 80, "url": "https://www.tori.fi/recommerce/forsale/item/36924862" },
    { "title": "Kingston Fury Beast 2x16gb ddr5 6000MHz cl36 muistikammat", "price": 320, "url": "https://www.tori.fi/recommerce/forsale/item/36891905" },
    { "title": "Kingston FURY Impact DDR5 5600 MHz CL40 SO-DIMM 32 Gt", "price": 400, "url": "https://www.tori.fi/recommerce/forsale/item/36884733" },
    { "title": "16gb [2x8gb] DDR5 sodimm 5600 MHz", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/36856289" },
    { "title": "32 GB 5600 MHz DDR5 SODIMM", "price": 240, "url": "https://www.tori.fi/recommerce/forsale/item/36835870" },
    { "title": "2 x 32Gb DDR5 muistit", "price": 800, "url": "https://www.tori.fi/recommerce/forsale/item/36780101" },
    { "title": "Kingston Fury Beast 32GB DDR5 6000MHz CL36", "price": 330, "url": "https://www.tori.fi/recommerce/forsale/item/36771673" },
    { "title": "Corsair vengeance DDR5 6000MT/s CL36 2x16GB", "price": 399, "url": "https://www.tori.fi/recommerce/forsale/item/34208850" },
    { "title": "CORSAIR VENGEANCE 32GB DDR5 2x16GB kit 6000mhz CL36 UUSI", "price": 400, "url": "https://www.tori.fi/recommerce/forsale/item/36734226" },
    { "title": "DDR5 2 x 48 GB 5600mhz Cruicial PRO", "price": 790, "url": "https://www.tori.fi/recommerce/forsale/item/34105485" },
    { "title": "2pv käytetyt 16gb (2x8gb) ddr5 4800MHZ", "price": 150, "url": "https://www.tori.fi/recommerce/forsale/item/36666341" },
    { "title": "Ostetaan DDR5 2 x 8GB 5600MHz UDIMM", "price": 120, "url": "https://www.tori.fi/recommerce/forsale/item/36653386" },
    { "title": "Corsair 96GB DDR5 6000MHz, CL36, 1.40V", "price": 839, "url": "https://www.tori.fi/recommerce/forsale/item/34039908" },
    { "title": "Corsair 64GB (2 x 32GB) Vengeance, DDR5 5200MHz, CL40, 1.25V, musta/harmaa", "price": 500, "url": "https://www.tori.fi/recommerce/forsale/item/36637885" },
    { "title": "Ostetaan DDR5 32GB", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/36587190" },
    { "title": "Kingston FURY Beast DDR5-6000mhz - 2x16GB - CL36 RGB (36-44-44 1.35V)", "price": 400, "url": "https://www.tori.fi/recommerce/forsale/item/36568855" },
    { "title": "Corsair 32GB (2 x 16GB) DDR5 6400MHz CL36 1.35V", "price": 380, "url": "https://www.tori.fi/recommerce/forsale/item/34015617" },
    { "title": "G.Skill Ripjaws S5 DDR5 32GB 6400Mhz CL32 (2x16GB)", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/36459577" },
    { "title": "Ostetaan 96 / 128Gb DDR5 (2xDIMM Kit)", "price": 900, "url": "https://www.tori.fi/recommerce/forsale/item/36419599" },
    { "title": "Corsair Vengeance DDR5 6000 MHz CL36 16GB", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/36417531" },
    { "title": "Samsung 32GB (2 x 16GB) DDR5 5600MHz, SO-DIMM, CL46, 1.10V", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/36402802" },
    { "title": "G.Skill 32GB (2 x 16GB) Flare X5, DDR5 6000MHz, CL32, 1.35V, musta", "price": 440, "url": "https://www.tori.fi/recommerce/forsale/item/36395582" },
    { "title": "G.Skill Ripjaws M5 RGB 96 Gt (2 x 48 Gt) DDR5 6400 MHz, CL32", "price": 800, "url": "https://www.tori.fi/recommerce/forsale/item/36368193" },
    { "title": "DDR5 16GB SODIMM", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/36360274" },
    { "title": "DDR5 SO-DIMM 64gb (2x32gb) 5600mhz", "price": 500, "url": "https://www.tori.fi/recommerce/forsale/item/36361545" },
    { "title": "Kingston ValueRAM DDR5 5600 MHz CL46 32 Gt SO-DIMM -muistimoduli", "price": 270, "url": "https://www.tori.fi/recommerce/forsale/item/36343194" },
    { "title": "32GB DDR5 6000MHz CL30 Corsair Vengeance RGB", "price": 360, "url": "https://www.tori.fi/recommerce/forsale/item/36267914" },
    { "title": "DDR5 5600 sodimm 16GB kit (2*8GB)", "price": 95, "url": "https://www.tori.fi/recommerce/forsale/item/36230337" },
    { "title": "16Gt DDR5 4800MHz So-Dimm Sk-Hynix -muisti", "price": 120, "url": "https://www.tori.fi/recommerce/forsale/item/36128093" },
    { "title": "Kingston Technology FURY Beast 32GB 5200MT/s DDR5 CL40 DIMM RGB XMP", "price": 275, "url": "https://www.tori.fi/recommerce/forsale/item/36104084" },
    { "title": "G.SKILL DDR5 SO-DIMM 32GB (2x 16GB) 5200MHz", "price": 220, "url": "https://www.tori.fi/recommerce/forsale/item/36060349" },
    { "title": "2x8 Gb 5600 SO-DIMM DDR5", "price": 110, "url": "https://www.tori.fi/recommerce/forsale/item/36040797" },
    { "title": "2x 16gb sodimm ddr5 5600", "price": 250, "url": "https://www.tori.fi/recommerce/forsale/item/36041790" },
    { "title": "Kingston FURY Renegade DDR5 6000 MHz CL32 64 Gt", "price": 650, "url": "https://www.tori.fi/recommerce/forsale/item/36023959" },
    { "title": "16gb ddr5 4800 sodimm [8gb x2]", "price": 80, "url": "https://www.tori.fi/recommerce/forsale/item/35969243" },
    { "title": "CAMM 32gb ddr5 4800mhz", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/35959575" },
    { "title": "So-Dimm DDR5 5600 1x32GB", "price": 320, "url": "https://www.tori.fi/recommerce/forsale/item/35887952" },
    { "title": "Kingston FURY Beast 16GB (2 x 8GB) DDR5", "price": 240, "url": "https://www.tori.fi/recommerce/forsale/item/35819096" },
    { "title": "Kingston FURY Beast DDR5 RGB EXPO 6400 MHz CL32 128Gt (4x32Gt)", "price": 1300, "url": "https://www.tori.fi/recommerce/forsale/item/35803558" },
    { "title": "DDR5 5600 16GB SODIMM 2kpl", "price": 300, "url": "https://www.tori.fi/recommerce/forsale/item/35793926" },
    { "title": "SODIMM DDR5 32Gb 2x16GB 5600MT/s", "price": 230, "url": "https://www.tori.fi/recommerce/forsale/item/35603632" },
    { "title": "SO-DIMM DDR5 16GB", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/35778812" },
    { "title": "Corsair Vengeance DDR5 6200Mhz", "price": 420, "url": "https://www.tori.fi/recommerce/forsale/item/35775343" },
    { "title": "Samsung 16GB (2x8GB) 4800MHz DDR5 SO-DIMM", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/35768194" },
    { "title": "Kingston 64GB (2 x 32GB) FURY Beast DDR5, 6000MHz, CL36", "price": 650, "url": "https://www.tori.fi/recommerce/forsale/item/35093876" },
    { "title": "Kingston FURY Impact DDR5 64 Gt", "price": 590, "url": "https://www.tori.fi/recommerce/forsale/item/35657905" },
    { "title": "Samsung DDR5 SoDIMM 4800 m425r1gb4bb0-v07 2x8GB", "price": 100, "url": "https://www.tori.fi/recommerce/forsale/item/35630126" },
    { "title": "Kingston 2x8 GB DDR5 4800 Mhz muistikammat", "price": 120, "url": "https://www.tori.fi/recommerce/forsale/item/35598527" },
    { "title": "DDR5 32Gb", "price": 400, "url": "https://www.tori.fi/recommerce/forsale/item/35585052" },
    { "title": "Kingston 32GB DDR5 5600MHz SO-DIMM", "price": 340, "url": "https://www.tori.fi/recommerce/forsale/item/35569447" },
    { "title": "Kingston FURY Beast 32 Gt (2 x 16 Gt) DDR5 6000 MHz, CL30", "price": 650, "url": "https://www.tori.fi/recommerce/forsale/item/35537231" },
    { "title": "Kingston Fury DDR5 CL30 2x16gb", "price": 180, "url": "https://www.tori.fi/recommerce/forsale/item/35508773" },
    { "title": "8gb Samsung DDR5 läppärin muisti", "price": 50, "url": "https://www.tori.fi/recommerce/forsale/item/35472976" },
    { "title": "G.Skill DDR5-6000 - 64GB - CL30", "price": 950, "url": "https://www.tori.fi/recommerce/forsale/item/35468510" },
    { "title": "Kingston Fury Beast DDR5 6000mhz CL40 32gb", "price": 350, "url": "https://www.tori.fi/recommerce/forsale/item/35462455" },
    { "title": "Keskusyksikkö Core Ultra 7 265K, 64gb ddr5, Windows 11 Pro", "price": 1450, "url": "https://www.tori.fi/recommerce/forsale/item/37345955" },
    { "title": "Pelitietokone RTX 4080 / i7-13700F / 16GB DDR5 / M.2 1TB", "price": 1700, "url": "https://www.tori.fi/recommerce/forsale/item/37275313" },
    { "title": "O: 32gb 2x16gb DDR5", "price": 200, "url": "https://www.tori.fi/recommerce/forsale/item/35296044" },
    { "title": "Tehokas pelitietokone Ryzen 7 7800x3d RTX 5070 TI 32GB DDR5", "price": 2000, "url": "https://www.tori.fi/recommerce/forsale/item/37254105" },
    { "title": "DDR5 32GB Pelikone", "price": 815, "url": "https://www.tori.fi/recommerce/forsale/item/37253245" },
    { "title": "Crucial Pro 32GB DDR5 6000MHz CL36", "price": 370, "url": "https://www.tori.fi/recommerce/forsale/item/35180401" },
];

// Filter: remove full computer listings, adapters, and "Ostetaan" (buying wanted)
const isRAMOnly = (item) => {
    const t = item.title.toLowerCase();
    // Exclude full PCs
    if (/pelitietokone|pelikone|keskusyksikkö|custom kone|rtx \d{4}|gtx \d{4}|rtx 5070|rtx 4080|i[579]-\d{4,5}|ryzen \d|core ultra/i.test(t)) return false;
    // Exclude adapters
    if (/adapteri/i.test(t)) return false;
    // Exclude "wanted to buy" ads
    if (/^o:|ostetaan/i.test(t)) return false;
    // Exclude full laptops
    if (/lenovo|acer (predator|nitro|aspire|swift).*rtx|asus.*rtx|hp.*rtx|dell.*rtx/i.test(t) && /ssd|rtx|gtx/i.test(t)) return false;
    if (/lenovo loq|lenovo legion/i.test(t)) return false;
    return true;
};

const ramListings = raw.filter(isRAMOnly);
console.log(`Filtered: ${raw.length} -> ${ramListings.length} RAM-only listings`);

// Enrich with specs and bargain score
const enriched = ramListings.map(item => {
    const specs = extractRAMSpecs(item.title);
    const bargainScore = calcScore(item.price, specs);
    const pricePerGB = specs.capacityGB && item.price ? +(item.price / specs.capacityGB).toFixed(1) : null;
    return { ...item, specs, bargainScore, pricePerGB, location: item.location || '', date: item.date || '' };
});

// Sort by bargain score
enriched.sort((a, b) => b.bargainScore - a.bargainScore);

const output = {
    scannedAt: new Date().toISOString(),
    query: 'DDR5 RAM',
    totalListings: enriched.length,
    bargainsFound: enriched.filter(l => l.bargainScore >= 65).length,
    listings: enriched,
};

fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(output, null, 2), 'utf-8');

console.log(`\nTotal: ${enriched.length} listings`);
console.log(`Bargains (score >= 65): ${output.bargainsFound}`);
console.log('\n═══ TOP BARGAINS ═══');
enriched.filter(l => l.bargainScore >= 65).forEach(b => {
    const cap = b.specs.capacityGB ? `${b.specs.capacityGB}GB` : '?GB';
    const spd = b.specs.speed ? ` DDR5-${b.specs.speed}` : '';
    const ppgb = b.pricePerGB ? ` (${b.pricePerGB}€/GB)` : '';
    console.log(`  🟢 [Score: ${b.bargainScore}] ${b.price}€ — ${cap}${spd}${ppgb}`);
    console.log(`     ${b.title}`);
    console.log(`     ${b.url}`);
    console.log('');
});

console.log('\n💾 Results saved to results.json');
