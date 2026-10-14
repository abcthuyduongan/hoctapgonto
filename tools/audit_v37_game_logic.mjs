import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Presentation can change without rewriting answer locks, callbacks or storage.
const baseline = 'd2cca6c';
const previous = file => execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' });
const reports = [];
for (const name of ['MathQuest', 'MemoryMatch', 'SentenceBuilder']) {
  const file = `src/games/${name}.tsx`;
  const oldLogic = previous(file).split('  return <section')[0];
  const logic = fs.readFileSync(file, 'utf8').split('  return <section')[0];
  reports.push({ file, scope: 'imports, state, effects and callbacks before presentation JSX', unchanged: logic === oldLogic });
}
const appFile = 'src/App.tsx';
const functions = source => {
  const tree = ts.createSourceFile(appFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = {};
  const visit = node => {
    if (ts.isFunctionDeclaration(node) && node.name) found[node.name.text] = node.getText(tree);
    ts.forEachChild(node, visit);
  };
  visit(tree); return found;
};
const before = functions(previous(appFile)), after = functions(fs.readFileSync(appFile, 'utf8'));
for (const name of ['startGame', 'recordAttempt', 'completeSession', 'leaveGame', 'importContentPacks', 'publish']) {
  reports.push({ file: appFile, scope: name, unchanged: !!before[name] && before[name] === after[name] });
}
for (const entry of JSON.parse(fs.readFileSync('docs/V37_qa/protected-source-hashes.json', 'utf8'))) {
  if (!entry.Path.includes('\\core\\')) continue;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(entry.Path)).digest('hex').toUpperCase();
  reports.push({ file: path.relative(process.cwd(), entry.Path), scope: 'whole source', unchanged: hash === entry.Hash });
}
const output = { baseline, date: new Date().toISOString(), checks: reports.length,
  changed: reports.filter(report => !report.unchanged), reports };
fs.mkdirSync('docs/V37_games_qa', { recursive: true });
fs.writeFileSync('docs/V37_games_qa/game-logic-audit.json', JSON.stringify(output, null, 2) + '\n');
console.log(`${output.checks} protected source checks; ${output.changed.length} changed.`);
if (output.changed.length) process.exitCode = 1;
