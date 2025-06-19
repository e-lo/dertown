// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  integrations: [
    // Tailwind CSS v4 is integrated via the @tailwindcss/vite plugin in vite config
  ],
  vite: {
    plugins: [
      // Tailwind CSS v4 integration
      (await import('@tailwindcss/vite')).default()
    ]
  }
});