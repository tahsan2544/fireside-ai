<div align="center">

# Fireside AI

**A quiet place. A warm voice.**

[![Live app](https://img.shields.io/badge/live_app-fireside--ai.lovable.app-d97757)](https://fireside-ai.lovable.app/)
[![License: MIT](https://img.shields.io/badge/license-MIT-2e7d32.svg)](./LICENSE)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)

</div>

Fireside AI is a minimalist space to talk with a gentle AI companion one-on-one, or sit alongside others in **the Commons** — a shared space for calmer, more communal conversation.

![Fireside AI preview](https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/95b2a980-1954-432a-bb93-ef055deb2a14/id-preview-b583d2d3--ae63a3c0-750e-4044-a223-e6fbb46b3ccb.lovable.app-1785914439547.png)

**[Open the live app →](https://fireside-ai.lovable.app/)**

## ✨ Features

- **1:1 AI conversation** — a calm, focused chat experience with a gentle conversational tone
- **The Commons** — a shared space to sit with others rather than chat alone
- **Hearth, journal & memory** — private pages for reflection that stay yours
- **Authentication** — sign in / sign up with email & password, or continue with Google
- **Minimalist UI** — distraction-free, warm, fireside-inspired design with light/dark themes

## 🛠 Tech stack

Taken from this repo's `package.json` — not guesses:

| Layer | Tools |
| --- | --- |
| UI | React 19, TypeScript 5.8, Tailwind CSS 4, shadcn/ui (Radix UI primitives), Lucide icons |
| Framework | TanStack Start, TanStack Router (file-based routing), TanStack Query |
| Build & tooling | Vite 8, ESLint 9, Prettier |
| Backend | Supabase (auth, Postgres, storage), Drizzle ORM migrations |
| Forms & validation | React Hook Form, Zod |
| Charts | Recharts |

## 🚀 Getting started

### Prerequisites

- [Bun](https://bun.sh) **(recommended — this repo ships `bun.lock` + `bunfig.toml`)**, or [Node.js](https://nodejs.org/) 20+ with npm
- A [Supabase](https://supabase.com) project (or the Lovable Cloud project this app is connected to)

### Clone & run

```bash
git clone https://github.com/tahsan2544/fireside-ai.git
cd fireside-ai

# With Bun (preferred)
bun install
bun run dev

# Or with npm
npm install
npm run dev
```

Open the URL printed in the terminal (Lovable's Vite config typically serves on `http://localhost:8080`).

### Environment variables

Create a `.env` file in the project root:

```bash
# Client + server (Supabase)
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key

# Server-only
SUPABASE_URL=your-project-url
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database migrations (drizzle-kit)
LOVABLE_DB_MIGRATION_URL=postgres://...

# Optional — AI voice/features (server-only)
OPENROUTER_API_KEY=...
ELEVENLABS_API_KEY=...
```

Never commit `.env` — only real values belong in your local copy.

### Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` / `npm run dev` | Start the dev server |
| `bun run build` / `npm run build` | Production build |
| `bun run build:dev` | Development-mode build |
| `bun run preview` / `npm run preview` | Preview the production build |
| `bun run lint` / `npm run lint` | Run ESLint |
| `bun run format` / `npm run format` | Format with Prettier |

### Editing in Lovable

You can also edit this project directly in the [Lovable editor](https://lovable.dev/projects/lovp_0p7ysr7mn98wsa76t801q9v32f) — changes made there sync automatically with this repo.

## 📦 Deployment

This project is deployed via Lovable at [fireside-ai.lovable.app](https://fireside-ai.lovable.app/). To publish updates, use **Share → Publish** in the Lovable editor, or connect a custom domain under **Project → Settings → Domains**.

Pushes to `main` also trigger the release workflow in `.github/workflows/release.yml`.

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE) for details.

## 📝 Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). Please be kind and respectful in all interactions.
