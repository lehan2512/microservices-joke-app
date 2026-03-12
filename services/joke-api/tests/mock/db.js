const path = require('path');
const fs = require('fs');

// Manual test mock for ../db.js — reads fixture data so tests don't need a DB.
const fixturesPath = path.join(__dirname, 'jokes.json');
let jokes = [];
try {
  const parsed = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
  // fixtures may include a top-level { jokes: [...] } or be the array itself
  jokes = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.jokes) ? parsed.jokes : []);
} catch (e) {
  // If fixtures are missing or invalid, keep jokes empty — tests will fail deterministically.
  jokes = [];
}

function getTypes() {
  const s = new Set(jokes.map(j => j.type));
  return Array.from(s);
}

function getRandomJokes(type = 'any', count = 1) {
  const n = Number(count) || 1;
  let pool;
  if (!type || String(type).toLowerCase() === 'any') {
    pool = jokes.slice();
  } else {
    const lowered = String(type).toLowerCase();
    pool = jokes.filter(j => String(j.type).toLowerCase() === lowered || String(j.type).toLowerCase() === (lowered.endsWith('s') ? lowered.slice(0, -1) : lowered + 's') || String(j.type).toLowerCase().includes(lowered));
  }

  if (!Array.isArray(pool) || pool.length === 0) return [];

  // If single item, pick uniformly at random
  if (n === 1) {
    const idx = Math.floor(Math.random() * pool.length);
    const j = pool[idx];
    return [{ setup: j.setup, punchline: j.punchline, type: j.type }];
  }

  // For multiple items, shuffle and take n (allowing duplicates only if pool smaller)
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[r]] = [shuffled[r], shuffled[i]];
  }
  return shuffled.slice(0, n).map(j => ({ setup: j.setup, punchline: j.punchline, type: j.type }));
}

module.exports = { getTypes, getRandomJokes };
