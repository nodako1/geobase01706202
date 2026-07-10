import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {z} from 'zod';

const root = process.cwd();
const dir = path.join(root, 'public', 'data');

const configSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string(),
  hookText: z.string().optional(),
  metricLabel: z.string().optional(),
  sourceLabel: z.string().optional(),
  focusCountryCode: z.string().length(3).optional(),
  focusCountryLabel: z.string().optional(),
  endingQuestion: z.string().optional(),
  endingOptionA: z.string().optional(),
  endingOptionB: z.string().optional(),
  mapCenterLongitude: z.number().min(-180).max(180).optional(),
  startYear: z.number().int(),
  endYear: z.number().int(),
  secondsPerYear: z.number().positive(),
  introSeconds: z.number().nonnegative(),
  outroSeconds: z.number().nonnegative(),
  transitionRatio: z.number().min(0.05).max(1),
  outputWidth: z.number().int().positive(),
  outputHeight: z.number().int().positive(),
  fps: z.union([z.literal(30), z.literal(60)]),
  rankingSize: z.number().int().min(1).max(10),
  noDataColor: z.string(),
  backgroundColor: z.string(),
  showEvents: z.boolean(),
  showDelta: z.boolean()
}).refine((value) => value.startYear <= value.endYear);

const entitySchema = z.record(z.string(), z.object({
  displayName: z.string(),
  color: z.string(),
  priority: z.number().int()
}));

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const readCsv = (file) => {
  const result = Papa.parse(fs.readFileSync(path.join(dir, file), 'utf8'), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  });
  if (result.errors.length) throw new Error(result.errors.map((error) => error.message).join(', '));
  return result.data;
};

const config = configSchema.parse(readJson('config.json'));
const entities = entitySchema.parse(readJson('entities.json'));
const entityNames = Object.keys(entities).sort((a, b) => entities[a].priority - entities[b].priority);

const rows = readCsv('sample.csv').map((row, index) => {
  const year = Number(row.year);
  const value = Number(row.value);
  const entity = String(row.entity).trim();
  const countryCode = String(row.country_code).trim().toUpperCase();
  const numericCode = String(row.numeric_code).trim().padStart(3, '0');
  if (!Number.isInteger(year) || !Number.isFinite(value) || value < 0 || !entities[entity]) {
    throw new Error(`Invalid sample.csv row ${index + 2}`);
  }
  if (!/^[A-Z]{3}$/.test(countryCode) || !/^\d{3}$/.test(numericCode)) {
    throw new Error(`Invalid country code at sample.csv row ${index + 2}`);
  }
  return {
    year,
    countryCode,
    countryName: String(row.country_name).trim(),
    numericCode,
    entity,
    value
  };
});

const eventRows = fs.existsSync(path.join(dir, 'events.csv')) ? readCsv('events.csv') : [];
const events = new Map();
for (const row of eventRows) {
  const year = Number(row.year);
  const list = events.get(year) ?? [];
  list.push({year, title: String(row.title), description: String(row.description)});
  events.set(year, list);
}

const grouped = new Map();
for (const row of rows) {
  const key = `${row.year}:${row.countryCode}`;
  const list = grouped.get(key) ?? [];
  list.push(row);
  grouped.set(key, list);
}

let previousByCountry = new Map();
let previousShares = new Map();
let previousLeader = null;
const years = [];
const warnings = [];

for (let year = config.startYear; year <= config.endYear; year++) {
  const countries = [];
  for (const [key, candidates] of grouped) {
    if (!key.startsWith(`${year}:`)) continue;
    const first = candidates[0];
    const rawByEntity = new Map(entityNames.map((entity) => [entity, 0]));
    for (const candidate of candidates) {
      rawByEntity.set(candidate.entity, (rawByEntity.get(candidate.entity) ?? 0) + candidate.value);
    }
    const total = [...rawByEntity.values()].reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      warnings.push(`${year}:${first.countryCode}: total share is zero`);
      continue;
    }
    const shares = entityNames
      .map((entity) => ({entity, value: ((rawByEntity.get(entity) ?? 0) / total) * 100}))
      .sort((a, b) => b.value - a.value || entities[a.entity].priority - entities[b.entity].priority);
    const leader = shares[0];
    const previousEntity = previousByCountry.get(first.countryCode) ?? null;
    countries.push({
      countryCode: first.countryCode,
      countryName: first.countryName,
      numericCode: first.numericCode,
      entity: leader.entity,
      value: leader.value,
      shares,
      previousEntity,
      changed: previousEntity !== null && previousEntity !== leader.entity
    });
  }

  const averageShares = new Map(entityNames.map((entity) => [entity, 0]));
  for (const country of countries) {
    for (const share of country.shares) {
      averageShares.set(share.entity, (averageShares.get(share.entity) ?? 0) + share.value);
    }
  }
  const divisor = Math.max(1, countries.length);
  const ranking = entityNames
    .map((entity) => {
      const share = (averageShares.get(entity) ?? 0) / divisor;
      return {
        entity,
        share,
        delta: years.length === 0 ? 0 : share - (previousShares.get(entity) ?? 0),
        priority: entities[entity].priority
      };
    })
    .sort((a, b) => b.share - a.share || a.priority - b.priority)
    .map((row, index) => ({entity: row.entity, share: row.share, delta: row.delta, rank: index + 1}));

  const leader = ranking[0]?.share ? ranking[0].entity : null;
  years.push({
    year,
    countries,
    ranking,
    leader,
    previousLeader,
    leaderChanged: previousLeader !== null && leader !== previousLeader,
    changedCountries: countries.filter((country) => country.changed).length,
    events: events.get(year) ?? []
  });

  if (countries.length === 0) warnings.push(`${year}: no country data`);
  previousByCountry = new Map(countries.map((country) => [country.countryCode, country.entity]));
  previousShares = new Map(ranking.map((row) => [row.entity, row.share]));
  previousLeader = leader;
}

const output = {config, entities, years, warnings, generatedAt: new Date().toISOString()};
fs.mkdirSync(path.join(root, 'src', 'generated'), {recursive: true});
fs.writeFileSync(path.join(root, 'src', 'generated', 'video-data.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`Prepared ${years.length} annual share snapshots from ${rows.length} rows.`);
