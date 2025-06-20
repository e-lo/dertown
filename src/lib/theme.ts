export const categoryColors = {
  'Arts + Culture': { bg: 'bg-purple-600', text: 'text-white' },
  'Civic': { bg: 'bg-rose-500', text: 'text-white' },
  'Family': { bg: 'bg-green-800', text: 'text-white' },
  'Nature': { bg: 'bg-green-600', text: 'text-white' },
  'Outdoors': { bg: 'bg-green-700', text: 'text-white' },
  'Sports': { bg: 'bg-cyan-600', text: 'text-white' },
  'Town': { bg: 'bg-slate-600', text: 'text-white' }
} as const;

export type CategoryName = 
  | 'Arts + Culture'
  | 'Civic'
  | 'Family'
  | 'Nature'
  | 'Outdoors'
  | 'Sports'
  | 'Town';

// Helper to convert category name to kebab case
function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace any non-alphanumeric characters with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Helper to get color classes for a category
export function getCategoryColors(categoryName: string | null | undefined) {
  if (!categoryName) return { bg: 'bg-gray-600', text: 'text-category' };
  
  const kebabName = toKebabCase(categoryName);
  return {
    bg: `bg-category-${kebabName}`,
    text: 'text-category'
  };
} 