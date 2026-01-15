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
