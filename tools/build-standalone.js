'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const enginePath = path.join(root, 'engine.js');
const outPath = path.join(root, 'standalone.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const engine = fs.readFileSync(enginePath, 'utf8');
const marker = '<script src="engine.js"></script>';

if (!html.includes(marker)) {
  throw new Error('Expected engine script marker was not found in ' + htmlPath);
}
if (engine.includes('</script>')) {
  throw new Error('Engine source contains a closing script tag; refusing an unsafe inline bundle.');
}

const output = html.replace(marker, '<script>\n' + engine + '\n</script>');
fs.writeFileSync(outPath, output, 'utf8');
process.stdout.write('Built ' + path.relative(root, outPath) + ' (' + fs.statSync(outPath).size + ' bytes)\n');
