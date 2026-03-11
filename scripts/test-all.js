#!/usr/bin/env node
// Cross-platform single test runner. Runs all JS test files under services/*/test/*.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const servicesDir = path.join(root, 'services');
if (!fs.existsSync(servicesDir)) {
  console.error('No services/ directory found');
  process.exit(1);
}

let failed = false;
const services = fs.readdirSync(servicesDir).filter(d => fs.statSync(path.join(servicesDir, d)).isDirectory());
for (const svc of services) {
  const testDir = path.join(servicesDir, svc, 'test');
  console.log('\n== Service:', svc, '==');
  if (!fs.existsSync(testDir)) {
    console.log('(no tests)');
    continue;
  }
  const tests = fs.readdirSync(testDir).filter(f => f.endsWith('.js'));
  if (tests.length === 0) { console.log('(no tests)'); continue; }
  for (const t of tests) {
    const file = path.join(testDir, t);
    console.log('->', file);
    const res = spawnSync(process.execPath, [file], { stdio: 'inherit' });
    if (res.status !== 0) failed = true;
  }
}

if (failed) {
  console.error('\nSome tests failed');
  process.exit(1);
} else {
  console.log('\nAll tests passed');
  process.exit(0);
}
