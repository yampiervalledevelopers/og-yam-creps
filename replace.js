const fs = require('fs');
const text = fs.readFileSync('store.js', 'utf8');
const patch = fs.readFileSync('patch.js', 'utf8');

const parts = text.split('function renderStore() {');
const part1 = parts[0];
const part2 = 'function initModals() {' + parts[1].split('function initModals() {')[1];

fs.writeFileSync('store.js', part1 + '\n\n' + patch + '\n\n' + part2);
console.log('Replaced successfully using Node.js');
