// Read-only verification of the reviewed development-only dependency fork.
async function main() {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const crypto = await import('node:crypto');
  const assert = (await import('node:assert/strict')).default;
  const { createRequire } = await import('node:module');
  const root = path.resolve(__dirname, '..');
  const load = createRequire(path.join(root, 'package.json'));
  const forkRoot = path.join(root, 'vendor/braces-depth-guard');
  const provenance = JSON.parse(fs.readFileSync(path.join(forkRoot, 'provenance.json'), 'utf8'));
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(sha(path.join(root, 'vendor', provenance.archive)), provenance.archiveSha256, 'unreviewed archive');
  const installedRoot = path.dirname(load.resolve('braces/package.json'));
  const installed = load('braces/package.json');
  assert.equal(installed.name, '@ruwang/braces-depth-guard');
  assert.equal(installed.version, '3.0.3-ruwang.depth.1');
  for (const [file, hash] of Object.entries(provenance.files)) {
    assert.equal(sha(path.join(forkRoot, file)), hash, 'source changed: ' + file);
    assert.equal(sha(path.join(installedRoot, file)), hash, 'installed fork changed: ' + file);
  }
  const braces = load('braces');
  for (const [left, right] of [['{','}'], ['(',')']]) {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.doesNotThrow(() => braces[method](left.repeat(100) + 'a' + right.repeat(100)));
      for (const depth of [101, 4999]) assert.throws(() => braces[method](left.repeat(depth) + 'a' + right.repeat(depth)), /exceeds max depth/);
      assert.throws(() => braces[method](left.repeat(2) + 'a' + right.repeat(2), {maxDepth: 1.5}), /exceeds max depth/);
      assert.throws(() => braces[method](left.repeat(101) + 'a' + right.repeat(101), {maxDepth: Infinity}), /exceeds max depth/);
    }
  }
  let ast = { type: 'text', value: 'a' };
  for (let i = 0; i < 101; i++) ast = { type: 'brace', nodes: [ast] };
  ast = { type: 'root', nodes: [ast] };
  for (const method of ['compile', 'expand', 'stringify']) assert.throws(() => braces[method](ast), /exceeds max depth/);
  const cycle = {type:'paren', nodes:[{type:'text',value:'a'}]};
  cycle.parent = cycle;
  assert.throws(() => braces.expand(cycle), /cycle/);
  assert.deepEqual(braces.expand('a{1..3}'), ['a1','a2','a3']);
  assert.equal(braces.stringify(braces.parse('{a,b}'), {escapeInvalid:true}), '{a,b}');
  const nextLoad = createRequire(load.resolve('@next/eslint-plugin-next'));
  const fg = nextLoad('fast-glob');
  const mmLoad = createRequire(nextLoad.resolve('fast-glob'));
  const micromatch = mmLoad('micromatch');
  const bracesLoad = createRequire(mmLoad.resolve('micromatch'));
  assert.equal(bracesLoad('braces'), braces, 'Next lint still uses another braces');
  assert.deepEqual(micromatch(['src/a.ts','src/b.js','a.png'], 'src/*.{ts,js}'), ['src/a.ts','src/b.js']);
  assert.ok(fg.globSync('vendor/*', {cwd:root, onlyDirectories:true}).includes('vendor/braces-depth-guard'));
  console.log('PASS: source/archive/installed integrity; bounded APIs, AST/cycles, Next lint consumer compatibility');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
