import { build } from 'esbuild';
import fs from 'node:fs';

const BUILD = new Date().toISOString().slice(2, 16).replace(/[-:T]/g, '') +
  '-' + Math.random().toString(36).slice(2, 6);
const define = { __BUILD__: JSON.stringify(BUILD) };
console.log('build id:', BUILD);

// client bundle → inline into shell → dist/client.html
await build({
  entryPoints: ['client/client.ts'],
  bundle: true, target: 'es2020', outfile: 'dist/client.js', define,
});
const shell = fs.readFileSync('client/shell.html', 'utf8');
const js = fs.readFileSync('dist/client.js', 'utf8');
fs.writeFileSync('dist/client.html', shell.replace('/*__GAME_JS__*/', js));

// 3D client bundle → inline into shell3d → dist/client3d.html
await build({
  entryPoints: ['client/client3d.ts'],
  bundle: true, target: 'es2020', outfile: 'dist/client3d.js', define,
});
const shell3d = fs.readFileSync('client/shell3d.html', 'utf8');
const js3d = fs.readFileSync('dist/client3d.js', 'utf8');
fs.writeFileSync('dist/client3d.html', shell3d.replace('/*__GAME_JS__*/', js3d));

// server bundle (node)
await build({
  entryPoints: ['server/index.ts'],
  bundle: true, platform: 'node', target: 'node18',
  external: ['ws'], outfile: 'dist/server.js', define,
});
// bench bundle (node)
await build({
  entryPoints: ['test/bench.ts'],
  bundle: true, platform: 'node', target: 'node18',
  external: ['ws'], outfile: 'dist/bench.js',
});

// selftest bundle (node)
await build({
  entryPoints: ['test/selftest.ts'],
  bundle: true, platform: 'node', target: 'node18',
  external: ['ws'], outfile: 'dist/selftest.js',
});
console.log('build ok');
