# Der Town

A modern, community-driven events site built with Astro, TypeScript, and Supabase. Der Town features a beautiful calendar, custom design system, and a modular component-based architecture for maintainability and scalability.

## Tech Stack

- [Astro](https://astro.build/) (static-first, minimal JS)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) (custom theme)
- [Shoelace](https://shoelace.style/) (accessible web components)
- [Supabase](https://supabase.com/) (PostgreSQL, Auth, Storage)
- [FullCalendar.js](https://fullcalendar.io/) (calendar UI)
- [Prettier](https://prettier.io/) (code formatting)
- [ESLint](https://eslint.org/) (linting)

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Start local dev server:**
   ```bash
   npm run dev
   ```
3. **Lint and format code:**
   ```bash
   npm run lint
   npm run format
   ```

## Project Structure

- `src/` — Astro pages, components, and styles
- `public/` — Static assets
- `astro.config.mjs` — Astro configuration
- `tailwind.config.js` — Tailwind CSS configuration
- `tsconfig.json` — TypeScript configuration

## Scripts

- `npm run dev` — Start local dev server
- `npm run build` — Build for production
- `npm run lint` — Run ESLint
- `npm run format` — Run Prettier

## Documentation

- See [DEVELOPING.md](./DEVELOPING.md) for full developer setup and workflow
- See [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md) for requirements and design

```sh
npm create astro@latest -- --template minimal
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/minimal)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/minimal)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/minimal/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
