// joke-etl tests
// Tests included:
// 1) Entrypoint presence: verifies etl.js or other entry exists
// 2) normalizeType helper: trimming, lowercasing, null handling

const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function run() {
  console.log('Test: Entrypoint presence');
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const candidates = [pkg.main, 'server.js', 'app.js', 'index.js', 'etl.js'].filter(Boolean);
  let found = null;
  for (const c of candidates) {
    const p = path.join(__dirname, '..', c);
    if (fs.existsSync(p)) { found = p; break; }
  }
  console.log(' Checking candidates', candidates);
  assert.ok(found, `No entry file found among candidates: ${candidates.join(', ')}`);
  console.log(' OK ->', found);

  console.log('Test: normalizeType helper');
  const { normalizeType } = require('../etl');
  assert.strictEqual(normalizeType('  Sports '), 'sports');
  assert.strictEqual(normalizeType('DaD'), 'dad');
  assert.strictEqual(normalizeType(null), '');
  assert.strictEqual(normalizeType(undefined), '');
  assert.strictEqual(normalizeType(123), '123');
  console.log(' OK');
}

run().then(() => console.log('All joke-etl tests passed')).catch(err => { console.error(err); process.exit(1); });
