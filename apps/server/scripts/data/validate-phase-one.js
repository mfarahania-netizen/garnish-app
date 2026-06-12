const { validatePhaseOneData } = require('./phase-one-recipes');

const result = validatePhaseOneData();
console.log(JSON.stringify(result.summary, null, 2));

if (!result.ok) {
  console.error('Phase-one recipe validation failed:');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Phase-one recipe validation passed.');
