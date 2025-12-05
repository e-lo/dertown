/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  safelist: [
    // Category background colors
    'bg-category-arts-culture',
    'bg-category-civic',
    'bg-category-family',
    'bg-category-nature',
    'bg-category-outdoors',
    'bg-category-sports',
    'bg-category-town',
    // Text colors
    'text-category',
    // Opacity classes for hover
    'opacity-60',
    'hover:opacity-100',
    // Basic colors
    'bg-gray-100',
    'bg-gray-200',
    'bg-gray-800',
    'text-gray-700',
    'text-gray-800',
    'text-white',
    'hover:bg-gray-200'
  ],
  theme: {
    extend: {
      colors: {
        // Custom colors can be added here
      },
      fontFamily: {
        // Custom fonts can be added here
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 