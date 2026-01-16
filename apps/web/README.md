# ✨ Welcome to Your Spark Template!
You've just launched your brand-new Spark Template Codespace — everything’s fired up and ready for you to explore, build, and create with Spark!

This template is your blank canvas. It comes with a minimal setup to help you get started quickly with Spark development.

🚀 What's Inside?
- A clean, minimal Spark environment
- Pre-configured for local development
- Ready to scale with your ideas
  
## Deploying to Cloudflare Pages

This app is Vite-based and ready for Cloudflare Pages.

**Build command:** `npm run build`

**Output directory:** `dist`

**Config:** see `wrangler.toml` (already set with `pages_build_output_dir = "dist"`).

**Optional local preview** (requires `wrangler` globally or as a dev dependency):

```bash
npm install -g wrangler   # if you don't have it
wrangler pages dev dist   # preview the built site locally
```

In Cloudflare Pages, create a new project pointing to this repo, set the build command to `npm run build`, and the output directory to `dist`. Environment variables can be added in the Pages dashboard or `wrangler.toml` under `[vars]`.

## API consumption (recommended)

This app already centralizes network calls in `apps/web/src/lib/api.ts` + `apps/web/src/lib/api-client.ts`. To make API usage more scalable and resilient as you add more pages:

- Prefer a cache/dedupe layer (TanStack Query is already installed) for public catalog data to avoid refetching on every navigation and to unify loading/error states.
- Model the home page as a single “home payload” (either via a backend endpoint or `Promise.all` on the client) so banners, collections, and categories arrive together and render consistently.
- Use cursor/page-based pagination and “view” endpoints consistently (`/public/catalog/products/view`) so UI can rely on a stable read model and minimize client mapping.
- Keep DTO mapping in one place (e.g. `mapToProduct`) and avoid re-mapping the same entities in multiple hooks.
- Use HTTP caching headers (ETag / Cache-Control) for public data; the client can then safely enable `staleTime` and background refresh.
