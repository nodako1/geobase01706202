import fs from 'node:fs';
import path from 'node:path';

const samplePath = path.join(process.cwd(), 'public', 'data', 'sample.csv');

if (fs.existsSync(samplePath)) {
  console.log('Using existing public/data/sample.csv');
} else {
  console.warn('public/data/sample.csv was not found. Generating the bundled sample dataset.');
  await import('./generate-sample.mjs');
}
