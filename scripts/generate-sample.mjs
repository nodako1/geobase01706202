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

const firefoxStrong = new Set(['DEU','AUT','POL','CZE','SVK','HUN','FIN','ROU']);
const operaStrong = new Set(['RUS','UKR']);
const earlyChrome = new Set(['BRA','ARG','CHL','COL','PER','TUR']);
const ieHoldouts = new Set(['JPN','KOR','CHN']);
const operaMiniMarkets = new Set(['NGA','KEN','GHA']);
const ucMarkets = new Set(['IND','PAK','BGD','IDN']);

const winnerFor = (year, code) => {
  if (code === 'JPN') {
    if (year <= 2013) return 'Internet Explorer';
    if (year <= 2018) return 'Chrome';
    return 'Safari';
  }
  if (code === 'KOR') return year <= 2013 ? 'Internet Explorer' : 'Chrome';
  if (code === 'CHN') {
    if (year <= 2011) return 'Internet Explorer';
    if (year >= 2014 && year <= 2016) return 'UC Browser';
    return 'Chrome';
  }
  if (operaMiniMarkets.has(code)) {
    if (year <= 2010) return 'Internet Explorer';
    if (year <= 2015) return 'Opera Mini';
    return 'Chrome';
  }
  if (ucMarkets.has(code)) {
    if (year <= 2010) return code === 'IND' ? 'Firefox' : 'Internet Explorer';
    if (year <= 2013) return 'Chrome';
    if (year <= 2016) return 'UC Browser';
    return 'Chrome';
  }
  if (operaStrong.has(code)) {
    if (year <= 2010) return 'Opera Mini';
    return 'Chrome';
  }
  if (firefoxStrong.has(code)) {
    if (year <= 2010) return 'Firefox';
    if (year === 2011 && ['DEU','AUT','POL','CZE'].includes(code)) return 'Firefox';
    return 'Chrome';
  }
  if (earlyChrome.has(code)) return year <= 2009 ? 'Internet Explorer' : 'Chrome';
  if (ieHoldouts.has(code)) return year <= 2013 ? 'Internet Explorer' : 'Chrome';
  if (year <= 2010) return 'Internet Explorer';
  if (year === 2011 && ['FRA','NLD','BEL','CHE','SWE','NOR'].includes(code)) return 'Firefox';
  return 'Chrome';
};

const winnerShare = (entity, year, codeIndex) => {
  const wobble = ((year * 7 + codeIndex * 3) % 9) - 4;
  if (entity === 'Internet Explorer') return Math.max(37, 64 - (year - 2009) * 6 + wobble * 0.35);
  if (entity === 'Firefox') return 38 + wobble * 0.45;
  if (entity === 'Chrome') return Math.min(79, 42 + (year - 2010) * 2.25 + wobble * 0.4);
  if (entity === 'Safari') return 47 + (year - 2019) * 1.3 + wobble * 0.3;
  if (entity === 'Opera Mini') return 44 + wobble * 0.55;
  if (entity === 'UC Browser') return 46 + wobble * 0.5;
  return 36 + wobble * 0.4;
};

const lines = ['year,country_code,country_name,numeric_code,entity,value'];
for (let year = 2009; year <= 2025; year++) {
  countries.forEach(([code,name,numeric], countryIndex) => {
    const winner = winnerFor(year, code);
    const top = winnerShare(winner, year, countryIndex);
    entities.forEach((entity, entityIndex) => {
      const base = 4 + ((year + countryIndex * 2 + entityIndex * 5) % 16);
      const value = entity === winner ? top : Math.min(top - 7, base + (entity === 'Chrome' ? Math.max(0, year - 2009) * 0.7 : 0));
      lines.push([year,code,name,numeric,entity,value.toFixed(1)].join(','));
    });
  });
}

const outputDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(path.join(outputDir, 'sample.csv'), lines.join('\n') + '\n');
console.log(`Generated ${lines.length - 1} browser-market rows for ${countries.length} countries.`);
