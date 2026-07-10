import fs from 'node:fs';
import path from 'node:path';

const countries = [
  ['JPN','Japan','392'],['USA','United States','840'],['CAN','Canada','124'],['MEX','Mexico','484'],
  ['BRA','Brazil','076'],['ARG','Argentina','032'],['CHL','Chile','152'],['COL','Colombia','170'],['PER','Peru','604'],
  ['GBR','United Kingdom','826'],['IRL','Ireland','372'],['FRA','France','250'],['DEU','Germany','276'],['ESP','Spain','724'],
  ['PRT','Portugal','620'],['ITA','Italy','380'],['NLD','Netherlands','528'],['BEL','Belgium','056'],['CHE','Switzerland','756'],
  ['AUT','Austria','040'],['POL','Poland','616'],['CZE','Czechia','203'],['SVK','Slovakia','703'],['HUN','Hungary','348'],
  ['SWE','Sweden','752'],['NOR','Norway','578'],['FIN','Finland','246'],['DNK','Denmark','208'],['ROU','Romania','642'],
  ['RUS','Russia','643'],['UKR','Ukraine','804'],['TUR','Turkey','792'],['CHN','China','156'],['KOR','South Korea','410'],
  ['IND','India','356'],['PAK','Pakistan','586'],['BGD','Bangladesh','050'],['IDN','Indonesia','360'],['THA','Thailand','764'],
  ['VNM','Vietnam','704'],['PHL','Philippines','608'],['AUS','Australia','036'],['NZL','New Zealand','554'],
  ['ZAF','South Africa','710'],['NGA','Nigeria','566'],['KEN','Kenya','404'],['GHA','Ghana','288'],['EGY','Egypt','818']
];

const entities = [
  'Internet Explorer',
  'Firefox',
  'Chrome',
  'Safari',
  'Opera Mini',
  'UC Browser',
  'Edge'
];

const firefoxStrong = new Set(['DEU','AUT','POL','CZE','SVK','HUN','FIN','ROU','FRA']);
const safariStrong = new Set(['USA','CAN','GBR','IRL','AUS','NZL','JPN']);
const latinAmerica = new Set(['MEX','BRA','ARG','CHL','COL','PER']);
const operaMiniMarkets = new Set(['NGA','KEN','GHA','ZAF','EGY']);
const ucMarkets = new Set(['IND','PAK','BGD','IDN','THA','VNM','PHL','CHN']);
const edgeMarkets = new Set(['USA','CAN','GBR','DEU','FRA','AUS','JPN']);

const bell = (value, center, width) => Math.exp(-Math.pow((value - center) / width, 2));

const globalCurve = (year) => {
  const t = year - 2009;
  return {
    'Internet Explorer': 55 * Math.exp(-0.37 * t) + 0.15,
    Firefox: Math.max(3.8, 29 - t * 1.55),
    Chrome: 4 + 69 / (1 + Math.exp(-0.67 * (t - 3.1))),
    Safari: 3.8 + 14 / (1 + Math.exp(-0.34 * (t - 7.2))),
    'Opera Mini': 0.8 + 3.8 * bell(t, 4.2, 3.2),
    'UC Browser': 0.35 + 3.4 * bell(t, 6.2, 2.8),
    Edge: t < 6 ? 0.05 : 0.5 + 6.6 * (1 - Math.exp(-0.25 * (t - 6)))
  };
};

const deterministicWobble = (year, code, entity) => {
  const seed = [...`${code}:${entity}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 1 + Math.sin(year * 0.73 + seed * 0.11) * 0.055;
};

const countryShares = (year, code) => {
  const t = year - 2009;
  const raw = globalCurve(year);

  if (firefoxStrong.has(code)) raw.Firefox *= 1.15 + 0.45 * Math.exp(-0.17 * t);
  if (safariStrong.has(code)) raw.Safari *= 1.45;
  if (latinAmerica.has(code)) raw.Chrome *= 1.18;
  if (operaMiniMarkets.has(code)) raw['Opera Mini'] *= 1 + 5.4 * bell(t, 4.8, 3.1);
  if (ucMarkets.has(code)) raw['UC Browser'] *= 1 + 5.2 * bell(t, 6.3, 2.7);
  if (edgeMarkets.has(code) && year >= 2020) raw.Edge *= 1.35;

  if (code === 'JPN') {
    raw['Internet Explorer'] *= year <= 2013 ? 1.48 : 0.9;
    raw.Chrome *= year >= 2017 ? 0.72 : 0.9;
    raw.Safari *= year >= 2017 ? 3.9 : 1.55;
  }
  if (code === 'KOR' && year <= 2013) raw['Internet Explorer'] *= 1.5;
  if (code === 'CHN') {
    raw['Internet Explorer'] *= year <= 2012 ? 1.35 : 0.8;
    raw['UC Browser'] *= 1 + 3.2 * bell(t, 6.1, 2.5);
    raw.Safari *= 0.55;
  }
  if (code === 'RUS' || code === 'UKR') {
    raw.Firefox *= year <= 2012 ? 1.22 : 1;
    raw['Opera Mini'] *= 1 + 1.5 * bell(t, 3.5, 2.8);
  }

  for (const entity of entities) raw[entity] *= deterministicWobble(year, code, entity);
  const total = entities.reduce((sum, entity) => sum + Math.max(0, raw[entity]), 0);
  return Object.fromEntries(entities.map((entity) => [entity, (Math.max(0, raw[entity]) / total) * 100]));
};

const lines = ['year,country_code,country_name,numeric_code,entity,value'];
for (let year = 2009; year <= 2025; year++) {
  countries.forEach(([code, name, numeric]) => {
    const shares = countryShares(year, code);
    entities.forEach((entity) => {
      lines.push([year, code, name, numeric, entity, shares[entity].toFixed(3)].join(','));
    });
  });
}

const outputDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(path.join(outputDir, 'sample.csv'), lines.join('\n') + '\n');
console.log(`Generated ${lines.length - 1} proportional browser-share rows for ${countries.length} countries.`);
