import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

const directory = process.argv[2] ?? 'dist';
const assetsDirectory = path.join(directory, 'assets');
const files = fs.readdirSync(assetsDirectory).filter((name) => name.endsWith('.js'));
const graph = new Map();
const sizes = new Map();
for (const name of files) {
  const bytes = fs.readFileSync(path.join(assetsDirectory, name));
  const source = ts.createSourceFile(name, bytes.toString(), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  sizes.set(name, { raw: bytes.length, gzip: gzipSync(bytes, { level: 6 }).length });
  graph.set(name, source.statements
    .filter((statement) => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
    .map((statement) => statement.moduleSpecifier?.text?.replace(/^\.\//, ''))
    .filter((dependency) => files.includes(dependency)));
}
const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
const entry = html.match(/src="\/assets\/([^" ]+\.js)"/)?.[1];
if (!entry) throw new Error('Entrada JavaScript ausente no HTML compilado.');
const results = [];
for (const prefix of [entry, 'landing-page-', 'overview-page-', 'reports-page-', 'investments-page-', 'settings-page-']) {
  const name = files.find((file) => file.startsWith(prefix));
  if (!name) continue;
  const reachable = new Set([name]);
  for (const file of reachable) for (const dependency of graph.get(file)) reachable.add(dependency);
  results.push({
    root: prefix === entry ? 'entry' : prefix.slice(0, -1),
    chunks: reachable.size,
    rawBytes: [...reachable].reduce((sum, file) => sum + sizes.get(file).raw, 0),
    gzipBytes: [...reachable].reduce((sum, file) => sum + sizes.get(file).gzip, 0),
    files: [...reachable].sort(),
  });
}
console.log(JSON.stringify(results, null, 2));
