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

const entities = ['ChatGPT','Google Gemini','Perplexity','Claude','Microsoft Copilot','DeepSeek'];
const periods = [];
for (let year = 2024, month = 1; year < 2026 || (year === 2026 && month <= 6);) {
  periods.push(`${year}-${String(month).padStart(2, '0')}`);
  month += 1;
  if (month === 13) { year += 1; month = 1; }
}

// 2026-06 values are anchored to StatCounter Global Stats public values.
// The intervening monthly country series is reconstructed for video production and is not raw StatCounter CSV.
const finalTargets = {
  JPN: {'ChatGPT':67.71,'Google Gemini':14.20,'Microsoft Copilot':11.05,'Claude':4.10,'Perplexity':2.93,'DeepSeek':0.01},
  USA: {'ChatGPT':66.13,'Microsoft Copilot':11.38,'Google Gemini':10.46,'Claude':6.99,'Perplexity':4.87,'DeepSeek':0.15},
  CHN: {'ChatGPT':70.35,'Google Gemini':18.16,'DeepSeek':5.63,'Perplexity':2.15,'Microsoft Copilot':2.08,'Claude':1.63},
  IND: {'ChatGPT':78.00,'Google Gemini':9.65,'Perplexity':5.07,'Claude':4.07,'Microsoft Copilot':3.19,'DeepSeek':0.02},
  KOR: {'ChatGPT':66.50,'Google Gemini':17.25,'Perplexity':6.12,'Claude':5.79,'Microsoft Copilot':4.34,'DeepSeek':0.00}
};

const englishMarkets = new Set(['USA','CAN','GBR','IRL','AUS','NZL']);
const europe = new Set(['FRA','DEU','ESP','PRT','ITA','NLD','BEL','CHE','AUT','POL','CZE','SVK','HUN','SWE','NOR','FIN','DNK','ROU','UKR']);
const asia = new Set(['JPN','KOR','CHN','IND','PAK','BGD','IDN','THA','VNM','PHL']);
const latinAmerica = new Set(['MEX','BRA','ARG','CHL','COL','PER']);
const africa = new Set(['ZAF','NGA','KEN','GHA','EGY']);

const normalize = (values) => {
  const total = entities.reduce((sum, entity) => sum + Math.max(0, values[entity] ?? 0), 0) || 1;
  return Object.fromEntries(entities.map((entity) => [entity, Math.max(0, values[entity] ?? 0) / total * 100]));
};

const globalStart = normalize({
  'ChatGPT': 88,
  'Google Gemini': 4,
  'Perplexity': 2,
  'Claude': 2,
  'Microsoft Copilot': 4,
  'DeepSeek': 0
});
const globalEnd = normalize({
  'ChatGPT': 76.87,
  'Google Gemini': 7.94,
  'Perplexity': 7.91,
  'Claude': 3.74,
  'Microsoft Copilot': 3.49,
  'DeepSeek': 0.03
});

const regionalFinal = (code) => {
  if (finalTargets[code]) return normalize(finalTargets[code]);
  const raw = {...globalEnd};
  if (englishMarkets.has(code)) {
    raw['ChatGPT'] *= 0.90;
    raw['Claude'] *= 1.65;
    raw['Microsoft Copilot'] *= 1.55;
    raw['Perplexity'] *= 1.12;
  }
  if (europe.has(code)) {
    raw['ChatGPT'] *= 0.94;
    raw['Perplexity'] *= 1.35;
    raw['Microsoft Copilot'] *= 1.25;
    raw['Claude'] *= 1.15;
  }
  if (asia.has(code)) {
    raw['Google Gemini'] *= 1.42;
    raw['Perplexity'] *= 0.88;
  }
  if (latinAmerica.has(code)) {
    raw['ChatGPT'] *= 1.11;
    raw['Google Gemini'] *= 1.08;
    raw['Claude'] *= 0.65;
  }
  if (africa.has(code)) {
    raw['ChatGPT'] *= 1.13;
    raw['Google Gemini'] *= 1.12;
    raw['Claude'] *= 0.58;
    raw['Microsoft Copilot'] *= 0.72;
  }
  if (code === 'RUS') {
    raw['ChatGPT'] *= 0.82;
    raw['DeepSeek'] = 5.8;
    raw['Google Gemini'] *= 1.2;
  }
  if (code === 'TUR') raw['Perplexity'] *= 1.42;
  return normalize(raw);
};

const countryStart = (code) => {
  const raw = {...globalStart};
  if (englishMarkets.has(code)) raw['Claude'] *= 1.25;
  if (asia.has(code)) raw['Google Gemini'] *= 1.18;
  if (code === 'JPN') raw['Microsoft Copilot'] *= 1.55;
  return normalize(raw);
};

const bell = (t, center, width) => Math.exp(-Math.pow((t - center) / width, 2));
const ease = (t) => t * t * (3 - 2 * t);
const seedFor = (code, entity) => [...`${code}:${entity}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);

const countryShares = (periodIndex, code) => {
  const lastIndex = periods.length - 1;
  const t = periodIndex / lastIndex;
  const start = countryStart(code);
  const target = regionalFinal(code);
  if (periodIndex === lastIndex) return target;

  const raw = {};
  for (const entity of entities) {
    raw[entity] = start[entity] + (target[entity] - start[entity]) * ease(t);
  }

  const deepSeekStrength = code === 'CHN' ? 13 : (asia.has(code) || code === 'RUS' ? 7.2 : 4.4);
  raw['DeepSeek'] += deepSeekStrength * bell(t, 0.46, 0.085);
  raw['ChatGPT'] -= deepSeekStrength * 0.72 * bell(t, 0.46, 0.10);
  raw['Google Gemini'] += (asia.has(code) ? 2.4 : 1.25) * bell(t, 0.70, 0.23);
  raw['Perplexity'] += (europe.has(code) ? 1.8 : 1.0) * bell(t, 0.73, 0.20);
  raw['Claude'] += (englishMarkets.has(code) ? 2.2 : 0.75) * bell(t, 0.62, 0.22);
  raw['Microsoft Copilot'] += (code === 'JPN' || englishMarkets.has(code) ? 2.0 : 0.8) * bell(t, 0.55, 0.24);

  const endpointSafeWave = Math.sin(Math.PI * t);
  for (const entity of entities) {
    const seed = seedFor(code, entity);
    raw[entity] *= 1 + Math.sin(periodIndex * 0.52 + seed * 0.07) * 0.025 * endpointSafeWave;
  }
  return normalize(raw);
};

const lines = ['period,country_code,country_name,numeric_code,entity,value'];
periods.forEach((period, periodIndex) => {
  countries.forEach(([code, name, numeric]) => {
    const shares = countryShares(periodIndex, code);
    entities.forEach((entity) => {
      lines.push([period, code, name, numeric, entity, shares[entity].toFixed(3)].join(','));
    });
  });
});

const outputDir = path.join(process.cwd(), 'public', 'data');
fs.mkdirSync(outputDir, {recursive: true});
fs.writeFileSync(path.join(outputDir, 'sample.csv'), lines.join('\n') + '\n');
console.log(`Generated ${lines.length - 1} monthly generative-AI rows for ${countries.length} countries and ${periods.length} periods.`);
