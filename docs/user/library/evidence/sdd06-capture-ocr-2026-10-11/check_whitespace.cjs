// Current scoped code/config, including untracked files; preserved history/binary/log snapshots excluded.
const fs = require('node:fs');
const path = require('node:path');
const receipt = __dirname;
const root = path.resolve(receipt, '../../../../..');
const snapshot = JSON.parse(fs.readFileSync(path.join(receipt, 'BUNDLE-SOURCE-MANIFEST.json'), 'utf8').replace(/^\uFEFF/, ''));
const productPaths = snapshot.files.filter(file => /\.(tsx?|json)$/.test(file.path)).map(file => file.path);
const artifactPaths = fs.readdirSync(receipt).filter(file => /\.(cjs|py|ps1)$/.test(file))
  .map(file => path.relative(root, path.join(receipt, file)).replaceAll('\\', '/'));
const paths = [...new Set([...productPaths, ...artifactPaths])];
const trailingWhitespace = [];
for (const filename of paths) {
  fs.readFileSync(path.join(root, filename), 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (/[\t ]+$/.test(line)) trailingWhitespace.push({ path: filename, line: index + 1 });
  });
}
const result = { kind: 'Scoped current code/config and receipt-script whitespace; historical snapshots excluded',
  checkedFiles: paths.length, trailingWhitespace, status: trailingWhitespace.length ? 'FAIL' : 'PASS' };
fs.writeFileSync(path.join(receipt, 'FINAL-WHITESPACE-CHECK.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = trailingWhitespace.length ? 1 : 0;
