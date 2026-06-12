const { validateAliasRegistry } = require('./alias-registry');

const result = validateAliasRegistry();
console.log(JSON.stringify(result.summary, null, 2));

if (!result.ok) {
  console.error('Alias registry validation failed:');
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Alias registry validation passed.');
