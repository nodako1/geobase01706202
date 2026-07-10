import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {z} from 'zod';

const root = process.cwd();
const dir = path.join(root, 'public', 'data');
const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

const configSchema = z.object({
  title: z.string().min(1),
  displayTitle: z.string().optional(),
  categoryTitle: z.string().optional(),
  subtitle: z.string(),
  hookText: z.string().optional(),
  shareExplanation: z.string().optional(),
  metricLabel: z.string().optional(),
  rankingLabel: z.string().optional(),
  rankingMode: z.enum(['average-share', 'gained-area']).optional(),
  sourceLabel: z.string().optional(),
  focusCountryCode: z.string().length(3).optional(),
  focusCountryLabel: z.string().optional(),
  focusFaction: z.string().optional(),
  focusPanelTitle: z.string().optional(),
  introEntities: z.array(z.string()).optional(),
  summaryEntities: z.array(z.string()).min(1).max(4).optional(),
  endingLessonTitle: z.string().optional(),
  endingLessons: z.array(z.string().min(1)).min(1).max(4).optional(),
  discussionPrompt: z.string().optional(),
  endingQuestion: z.string().optional(),
  endingOptionA: z.string().optional(),
  endingOptionB: z.string().optional(),
  mapCenterLongitude: z.number().min(-180).max(180).optional(),
  insetLeft: z.number().optional(),
  insetTop: z.number().optional(),
  eventHoldSeconds: z.number().positive().optional(),
  startYear: z.number().int(),
  endYear: z.number().int(),
  startPeriod: z.string().regex(periodPattern).optional(),
  endPeriod: z.string().regex(periodPattern).optional(),
  secondsPerPeriod: z.number().positive().optional(),
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
}).refine((value) => value.startYear <= value.endYear)
  .refine((value) => !value.startPeriod || !value.endPeriod || value.startPeriod <= value.endPeriod);

const entitySchema = z.record(z.string(), z.object({
  displayName: z.string(),
  mark: z.string().optional(),
  color: z.string(),
  priority: z.number().int(),
  excludeFromRanking: z.boolean().optional()
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
for (const name of [
  ...(config.introEntities ?? []),
  ...(config.summaryEntities ?? []),
  ...(config.focusFaction ? [config.focusFaction] : [])
]) {
  if (!entities[name]) throw new Error(`Unknown entity in config: ${name}`);
}

const rows = readCsv('sample.csv').map((row, index) => {
  const fallbackYear = Number(row.year);
  const period = String(row.period ?? (Number.isInteger(fallbackYear) ? `${fallbackYear}-01` : '')).trim();
  const value = Number(row.value);
  const weight = row.weight === undefined || row.weight === '' ? 1 : Number(row.weight);
  const entity = String(row.entity).trim();
  const countryCode = String(row.country_code).trim().toUpperCase();
  const numericCode = String(row.numeric_code).trim().padStart(3, '0');
  if (!periodPattern.test(period) || !Number.isFinite(value) || value < 0 || !entities[entity]) {
    throw new Error(`Invalid sample.csv row ${index + 2}`);
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`Invalid weight at sample.csv row ${index + 2}`);
  }
  if (!/^[A-Z]{3}$/.test(countryCode) || !/^\d{3}$/.test(numericCode)) {
    throw new Error(`Invalid country code at sample.csv row ${index + 2}`);
  }
  const [year, month] = period.split('-').map(Number);
  return {
    period,
    year,
    month,
    countryCode,
    countryName: String(row.country_name).trim(),
    numericCode,
    entity,
    value,
    weight
  };
});

const eventRows = fs.existsSync(path.join(dir, 'events.csv')) ? readCsv('events.csv') : [];
const events = new Map();
for (const row of eventRows) {
  const fallbackYear = Number(row.year);
  const period = String(row.period ?? (Number.isInteger(fallbackYear) ? `${fallbackYear}-01` : '')).trim();
  if (!periodPattern.test(period)) throw new Error(`Invalid event period: ${period}`);
  const [year, month] = period.split('-').map(Number);
  const list = events.get(period) ?? [];
  list.push({period, year, month, title: String(row.title), description: String(row.description)});
  events.set(period, list);
}

const grouped = new Map();
for (const row of rows) {
  const key = `${row.period}:${row.countryCode}`;
  const list = grouped.get(key) ?? [];
  list.push(row);
  grouped.set(key, list);
}

const periodSet = new Set(rows.map((row) => row.period));
const periods = [...periodSet]
  .filter((period) => !config.startPeriod || period >= config.startPeriod)
  .filter((period) => !config.endPeriod || period <= config.endPeriod)
  .sort();

let previousByCountry = new Map();
let previousShares = new Map();
let previousLeader = null;
const baselineSharesByCountry = new Map();
const years = [];
const warnings = [];

for (const period of periods) {
  const [year, month] = period.split('-').map(Number);
  const countries = [];
  for (const [key, candidates] of grouped) {
    if (!key.startsWith(`${period}:`)) continue;
    const first = candidates[0];
    const rawByEntity = new Map(entityNames.map((entity) => [entity, 0]));
    for (const candidate of candidates) {
      rawByEntity.set(candidate.entity, (rawByEntity.get(candidate.entity) ?? 0) + candidate.value);
    }
    const total = [...rawByEntity.values()].reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      warnings.push(`${period}:${first.countryCode}: total share is zero`);
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
      weight: first.weight,
      shares,
      previousEntity,
      changed: previousEntity !== null && previousEntity !== leader.entity
    });
  }

  if (years.length === 0) {
    for (const country of countries) {
      baselineSharesByCountry.set(
        country.countryCode,
        new Map(country.shares.map((share) => [share.entity, share.value]))
      );
    }
  }

  const eligibleEntities = entityNames.filter((entity) => !entities[entity].excludeFromRanking);
  const rankingValues = new Map(eligibleEntities.map((entity) => [entity, 0]));
  const totalWeight = Math.max(1, countries.reduce((sum, country) => sum + country.weight, 0));

  for (const country of countries) {
    const baseline = baselineSharesByCountry.get(country.countryCode) ?? new Map();
    for (const share of country.shares) {
      if (!rankingValues.has(share.entity)) continue;
      if ((config.rankingMode ?? 'average-share') === 'gained-area') {
        const gained = Math.max(0, share.value - (baseline.get(share.entity) ?? 0));
        rankingValues.set(
          share.entity,
          (rankingValues.get(share.entity) ?? 0) + (gained / 100) * country.weight
        );
      } else {
        rankingValues.set(
          share.entity,
          (rankingValues.get(share.entity) ?? 0) + (share.value / 100) * country.weight
        );
      }
    }
  }

  const ranking = eligibleEntities
    .map((entity) => {
      const share = ((rankingValues.get(entity) ?? 0) / totalWeight) * 100;
      return {
        entity,
        share,
        delta: years.length === 0 ? 0 : share - (previousShares.get(entity) ?? 0),
        priority: entities[entity].priority
      };
    })
    .sort((a, b) => b.share - a.share || a.priority - b.priority)
    .map((row, index) => ({entity: row.entity, share: row.share, delta: row.delta, rank: index + 1}));

  const leader = ranking[0]?.share > 0.0001 ? ranking[0].entity : null;
  years.push({
    period,
    periodLabel: `${year}年${month}月`,
    year,
    month,
    countries,
    ranking,
    leader,
    previousLeader,
    leaderChanged: previousLeader !== null && leader !== previousLeader,
    changedCountries: countries.filter((country) => country.changed).length,
    events: events.get(period) ?? []
  });

  if (countries.length === 0) warnings.push(`${period}: no country data`);
  previousByCountry = new Map(countries.map((country) => [country.countryCode, country.entity]));
  previousShares = new Map(ranking.map((row) => [row.entity, row.share]));
  previousLeader = leader;
}

if (years.length < 2) throw new Error('At least two periods are required to render a timeline.');

const output = {
  config,
  entities,
  years,
  warnings,
  baselinePeriod: years[0]?.period,
  generatedAt: new Date().toISOString()
};
fs.mkdirSync(path.join(root, 'src', 'generated'), {recursive: true});
fs.writeFileSync(path.join(root, 'src', 'generated', 'video-data.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`Prepared ${years.length} weighted monthly control snapshots from ${rows.length} rows.`);
