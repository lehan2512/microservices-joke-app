// joke-api tests
// Tests included:
// 1) Entrypoint presence: verifies a server/main file exists among common candidates
// 2) DB module exports: ensures getRandomJokes and getTypes are exported (without creating DB connections)

const fs = require('fs');
const path = require('path');
const assert = require('assert');

async function run() {
  // Test 1: Entrypoint presence
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

  // Test 2: DB exports
  console.log('Test: DB module exports (no DB connections)');
  process.env.DB_TYPE = 'NONE';
  const db = require('../db');
  assert.strictEqual(typeof db.getRandomJokes, 'function', 'getRandomJokes must be a function');
  assert.strictEqual(typeof db.getTypes, 'function', 'getTypes must be a function');
  console.log(' OK');
}

run().then(() => console.log('All joke-api tests passed')).catch(err => { console.error(err); process.exit(1); });
