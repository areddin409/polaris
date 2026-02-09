# Polaris

A modern, real-time project management application built with Next.js 16, featuring collaborative editing, AI-powered content generation, and background job processing.

## Features

- 🔐 **Secure Authentication** - Clerk-based auth with GitHub OAuth support
- 🗂️ **Project Management** - Create and organize projects with hierarchical file structures
- ✏️ **Real-time Collaboration** - Live updates across all connected clients via Convex
- 🎨 **VS Code-style Editor** - Familiar tab-based interface with preview/pinned modes
- 🤖 **AI Integration** - Content generation powered by Anthropic Claude and Google Gemini
- 🚀 **Background Jobs** - Async processing with Inngest for URL scraping and AI tasks
- 🌓 **Dark Mode** - System-aware theme switching
- 📊 **Error Tracking** - Integrated Sentry monitoring

## Tech Stack

### Frontend

- **Next.js 16** - App Router with React 19
- **Tailwind CSS 4** - Utility-first styling
- **shadcn/ui** - Component library
- **Zustand** - Global state management
- **Lucide React** - Icon system

### Backend

- **Convex** - Real-time database with type-safe queries
- **Clerk** - Authentication and user management
- **Inngest** - Background job processing

### AI & Services

- **Vercel AI SDK** - AI model integration
- **Anthropic Claude** - Text generation
- **Google Gemini** - Alternative AI provider
- **Firecrawl** - Web scraping service
- **Sentry** - Error tracking and monitoring

## Prerequisites

- **Node.js** 18+ and **pnpm** 8+
- **Clerk Account** - [clerk.com](https://clerk.com)
- **Convex Account** - [convex.dev](https://convex.dev)
- **API Keys** (optional but recommended):
  - Anthropic API key
  - Google AI API key
  - Firecrawl API key
  - Sentry DSN

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/areddin409/polaris.git
cd polaris
pnpm install
```

### 2. Environment Setup

Create a `.env.local` file in the root directory:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_JWT_ISSUER_DOMAIN=https://your-instance.clerk.accounts.dev

# Convex
NEXT_PUBLIC_CONVEX_URL=your_convex_url
CONVEX_DEPLOYMENT=your_deployment_name
POLARIS_CONVEX_INTERNAL_KEY=your_internal_key

# AI Providers (Optional)
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key

# Services (Optional)
FIRECRAWL_API_KEY=your_firecrawl_key
SENTRY_AUTH_TOKEN=your_sentry_token
SENTRY_DSN=your_sentry_dsn

# Development (Windows fix for file watching)
CONVEX_TMPDIR=./convex-tmp
```

### 3. Configure Clerk

1. Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Enable **GitHub OAuth** (or Email/Password) in SSO connections
3. For GitHub OAuth:
   - Create OAuth app at [github.com/settings/developers](https://github.com/settings/developers)
   - Set callback URL: `https://your-clerk-instance.clerk.accounts.dev/v1/oauth_callback`
   - Add credentials to Clerk dashboard

### 4. Configure Convex

1. Create a Convex project at [dashboard.convex.dev](https://dashboard.convex.dev)
2. Link to your local project:
   ```bash
   npx convex dev
   ```
3. In Convex dashboard, set environment variable:
   - `CLERK_JWT_ISSUER_DOMAIN` = Your Clerk issuer URL

### 5. Run Development Servers

**You need TWO terminal windows:**

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: Convex backend
npx convex dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
polaris/
├── convex/              # Convex backend functions
│   ├── auth.config.ts   # Clerk JWT integration
│   ├── schema.ts        # Database schema
│   ├── projects.ts      # Project queries/mutations
│   ├── files.ts         # File management
│   └── _generated/      # Auto-generated types
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # Shared UI components
│   │   ├── ui/          # shadcn/ui components
│   │   └── ai-elements/ # AI-specific components
│   ├── features/        # Feature-based modules
│   │   ├── auth/        # Authentication views
│   │   ├── projects/    # Project management
│   │   ├── editor/      # File editor + tabs
│   │   └── conversations/ # Chat/messaging
│   ├── inngest/         # Background job definitions
│   └── lib/             # Utilities and clients
└── public/              # Static assets
```

## Key Workflows

### Creating a Project

```typescript
// Uses Convex mutation with optimistic updates
const createProject = useCreateProject();
await createProject({ name: "My Project" });
```

### File Management

Files support hierarchical structures (folders/files) via `parentId`:

```typescript
// Create folder
const folderId = await createFile({
  projectId,
  name: "src",
  type: "folder",
  parentId: null, // Root level
});

// Create file in folder
await createFile({
  projectId,
  name: "index.ts",
  type: "file",
  content: "export default {}",
  parentId: folderId,
});
```

### Background Jobs

Trigger async tasks via Inngest:

```typescript
await inngest.send({
  name: "demo/generate",
  data: { projectId, urls: ["https://example.com"] },
});
```

## Authentication Flow

1. **Clerk** handles UI/session management
2. JWT token passed to Convex via `ConvexProviderWithClerk`
3. All Convex functions validate via `verifyAuth(ctx)`
4. User identity available as `identity.subject` (Clerk user ID)

## Development Tips

- **Convex Dashboard**: Running `npx convex dev` provides a local dashboard for testing queries
- **Type Safety**: Convex auto-generates types in `convex/_generated/`
- **Hot Reload**: Both Next.js and Convex support hot module replacement
- **Schema Changes**: Convex auto-pushes schema updates on save
- **Tab Management**: Editor uses Zustand store with VS Code-style behavior

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
pnpm install -g vercel

# Deploy
vercel
```

Set all environment variables in Vercel dashboard.

### Convex Production

```bash
# Deploy to production
npx convex deploy
```

Update `NEXT_PUBLIC_CONVEX_URL` to production URL.

## Troubleshooting

### GitHub OAuth Issues

- Verify callback URL matches Clerk instance
- Check GitHub OAuth app is enabled in Clerk
- Ensure GitHub servers are operational

### Convex Connection Errors

- Run `npx convex dev` in separate terminal
- Check `NEXT_PUBLIC_CONVEX_URL` is set correctly
- Verify Clerk JWT issuer domain in Convex dashboard

### Type Errors

- Run `npx convex dev` to regenerate types
- Restart TypeScript server in VS Code

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Inngest Documentation](https://www.inngest.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
