db = db.getSiblingDB('jokes_db');

db.types.insertMany([
  { name: 'dad' },
  { name: 'sports' },
  { name: 'love' }
]);

db.jokes.insertMany([
  { type: 'dad', setup: 'Why did the scarecrow win an award?', punchline: 'Because he was outstanding in his field.' },
  { type: 'sports', setup: 'Why are baseball games at night?', punchline: 'Because the bats sleep during the day.' },
  { type: 'love', setup: 'What did the calculator say to the pencil?', punchline: 'You can count on me.' }
]);