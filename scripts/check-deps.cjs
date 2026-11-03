// Used by start.cmd: exits with 1 when a package from package.json is not installed yet
// (e.g. KaTeX, added in Part 3), so the start file knows to run `npm install` first.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const wanted = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
const missing = wanted.filter(name => !fs.existsSync(path.join(root, 'node_modules', name, 'package.json')));
if (missing.length) console.log(`Missing packages: ${missing.join(', ')}`);
process.exit(missing.length ? 1 : 0);
