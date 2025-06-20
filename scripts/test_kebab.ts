// Helper to convert category name to kebab case
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace any non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Test some tag names
const testTags = [
  'Arts + Culture',
  'Arts',
  'Community Event',
  'Music',
  'Art'
];

console.log('Testing kebab-case conversion:');
testTags.forEach(tag => {
  const kebab = toKebabCase(tag);
  const className = `bg-category-${kebab}`;
  console.log(`"${tag}" -> "${kebab}" -> "${className}"`);
}); 