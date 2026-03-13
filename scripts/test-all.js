#!/usr/bin/env node
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
const services = fs.readdirSync(servicesDir).filter(d => {
    const p = path.join(servicesDir, d);
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'package.json'));
});

// 1. Run Unit Tests for all services
for (const svc of services) {
  console.log(`\n== Running Unit Tests for Service: ${svc} ==`);
  const svcPath = path.join(servicesDir, svc);
  
  const res = spawnSync('npm', ['test'], { 
    cwd: svcPath, 
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TEST_MODE: 'true' }
  });
  
  if (res.status !== 0) {
    console.error(`Unit tests failed for ${svc}`);
    failed = true;
  }
}

// 2. Run System-Wide Resilience Tests
console.log("\n== Running System-Wide Resilience Tests ==");
const resilienceScriptPath = path.join(__dirname, 'test-resilience.js');
const resRes = spawnSync('node', [`"${resilienceScriptPath}"`], { 
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TEST_MODE: 'false', DB_TYPE: 'MYSQL' }
});

if (resRes.status !== 0) {
    console.error("Resilience tests failed");
    failed = true;
}

if (failed) {
  console.error('\nOne or more test suites failed.');
  process.exit(1);
} else {
  console.log('\nAll tests (Unit + Resilience) passed!');
  process.exit(0);
}
