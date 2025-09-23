const shiprocketService = require('./services/shiprocket');

// Test name splitting functionality
console.log('🧪 Testing Name Splitting Functionality\n');

const testNames = [
  'Jaywant Namdeora Mhala',
  'Jaywant Mhala',
  'Prashant',
  'John Doe Smith',
  'Mary Jane Watson Parker',
  '',
  null,
  undefined
];

testNames.forEach((name, index) => {
  console.log(`Test ${index + 1}: "${name}"`);
  console.log(`  First Name: "${shiprocketService.getFirstName(name)}"`);
  console.log(`  Last Name: "${shiprocketService.getLastName(name)}"`);
  console.log('');
});

console.log('✅ Name splitting tests completed!');
