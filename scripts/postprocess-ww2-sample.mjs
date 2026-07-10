import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

const samplePath = path.join(process.cwd(), 'public', 'data', 'sample.csv');
if (!fs.existsSync(samplePath)) {
  throw new Error('public/data/sample.csv was not found.');
}

const parsed = Papa.parse(fs.readFileSync(samplePath, 'utf8'), {
  header: true,
  skipEmptyLines: true,
});
if (parsed.errors.length > 0) {
  throw new Error(parsed.errors.map((error) => error.message).join(', '));
}

const baselineOverrides = new Map([
  ['1939-09:CHN:Japan', 26],
  ['1939-09:CHN:Other', 74],
]);

let changed = 0;
for (const row of parsed.data) {
  const key = `${row.period}:${row.country_code}:${row.entity}`;
  const override = baselineOverrides.get(key);
  if (override === undefined) continue;
  row.value = override.toFixed(4);
  changed += 1;
}

if (changed !== baselineOverrides.size) {
  throw new Error(
    `Expected ${baselineOverrides.size} baseline overrides, but applied ${changed}.`,
  );
}

const csv = Papa.unparse(parsed.data, {
  columns: ['period', 'country_code', 'country_name', 'numeric_code', 'entity', 'value', 'weight'],
  newline: '\n',
});
fs.writeFileSync(samplePath, `${csv}\n`);
console.log('Applied verified 1939-09 baseline control overrides.');
