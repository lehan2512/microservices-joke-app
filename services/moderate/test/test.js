// moderate tests
// Tests included:
// 1) Entrypoint presence: server file exists
// 2) Cache file seeded: cache/types.json exists and contains entries
// 3) publishModeratedJoke behavior: either throws about channel or succeeds (tolerant)
// 4) getJokeFromQueue: returns null when no channel

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { getJokeFromQueue, publishModeratedJoke, CACHE_FILE } = require('../queue');

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

  console.log('Test: Cache file seeded');
  assert.ok(fs.existsSync(CACHE_FILE), `Cache file missing: ${CACHE_FILE}`);
  const content = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  assert.ok(Array.isArray(content), 'Cache content is not an array');
  assert.ok(content.length >= 1, 'Cache should have at least one seeded type');
  console.log(' OK');

  console.log('Test: publishModeratedJoke behavior (tolerant)');
  try {
    await Promise.resolve().then(() => publishModeratedJoke({ setup: 'a', punchline: 'b', type: 'dad' }));
    console.log(' publishModeratedJoke did not throw (OK if channel is established)');
  } catch (e) {
    assert.ok(/channel/i.test(String(e.message)), 'Expected error message to mention channel');
    console.log(' publishModeratedJoke threw as expected when no channel');
  }

  console.log('Test: getJokeFromQueue returns null when no channel');
  const res = await getJokeFromQueue();
  assert.strictEqual(res, null, 'Expected null when channel not ready');
  console.log(' OK');
}

run().then(() => console.log('All moderate tests passed')).catch(err => { console.error(err); process.exit(1); });
