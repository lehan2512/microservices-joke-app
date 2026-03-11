CREATE DATABASE IF NOT EXISTS jokes_db;
USE jokes_db;

CREATE TABLE types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE jokes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type_id INT,
    setup TEXT NOT NULL,
    punchline TEXT NOT NULL,
    FOREIGN KEY (type_id) REFERENCES types(id)
);

INSERT INTO types (name) VALUES ('dad'), ('sports'), ('love');

INSERT INTO jokes (type_id, setup, punchline) VALUES 
((SELECT id FROM types WHERE name = 'dad'), 'Why did the scarecrow win an award?', 'Because he was outstanding in his field.'),
((SELECT id FROM types WHERE name = 'sports'), 'Why are baseball games at night?', 'Because the bats sleep during the day.'),
((SELECT id FROM types WHERE name = 'love'), 'What did the calculator say to the pencil?', 'You can count on me.');