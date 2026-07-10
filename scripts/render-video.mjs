import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root = process.cwd();
const configPath = path.join(root, 'public', 'data', 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const sanitize = (value) =>
  String(value)
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || '動画';

const title = sanitize(config.title);
const start = sanitize(config.startPeriod ?? config.startYear);
const end = sanitize(config.endPeriod ?? config.endYear);
const filename = `GeoBase_${title}_${start}-${end}.mp4`;
const outputDir = path.join(root, 'out');
const outputPath = path.join(outputDir, filename);

fs.mkdirSync(outputDir, {recursive: true});

for (const existing of fs.readdirSync(outputDir)) {
  if (existing.startsWith('GeoBase_') && existing.endsWith('.mp4')) {
    fs.rmSync(path.join(outputDir, existing), {force: true});
  }
}

const extraArgs = process.argv.slice(2);
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  command,
  [
    'remotion',
    'render',
    'src/index.ts',
    'GeoBase',
    outputPath,
    '--codec=h264',
    ...extraArgs,
  ],
  {stdio: 'inherit'},
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Rendered video: ${outputPath}`);
