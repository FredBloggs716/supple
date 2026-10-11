# Deploy supple on Cloudflare (free tier)

This is the hosted version of the Social Training Club app, rebuilt to run on
Cloudflare Workers + D1 + R2 so it can be hosted **free** with persistent data.
The front-end in `public/` is the original app, unchanged.

## What it uses

- **Workers** — serves the app + the `/api/*` backend (one same-origin Worker).
- **D1** — the club database (SQLite).
- **R2** — stores uploaded exercise videos.

All three have free tiers large enough for a single club.

## One-time deploy

You need a free Cloudflare account. These steps run from this folder.

```sh
npm install                      # installs tooling (ARM64 Windows handled automatically)

# 1. Sign in to your Cloudflare account (opens a browser).
npm run wrangler -- login

# 2. Create the database + video bucket.
npm run wrangler -- d1 create supple
#    -> copy the printed database_id into wrangler.toml (replace "local")
npm run wrangler -- r2 bucket create supple-videos

# 3. Create the tables on the live database.
npm run migrate:remote

# 4. Set a private setup code (any long random string). You'll type this when
#    creating your coach account on the live site.
npm run wrangler -- secret put STC_SETUP_TOKEN

# 5. Deploy.
npm run deploy
```

Wrangler prints your URL, e.g. `https://supple.<your-subdomain>.workers.dev`.
Open it, create your coach account using the setup code from step 4, and you're
live. The address works on phones and computers.

## Everyday

- Re-deploy after changes: `npm run deploy`
- Run the tests: `npm test`
- Local preview: `npm run dev` (serves on http://127.0.0.1:8787)

## Custom domain (optional)

Add the domain in the Cloudflare dashboard (Workers → your worker → Domains),
then set `STC_PUBLIC_ORIGIN` in `wrangler.toml` to the exact HTTPS origin, e.g.
`https://training.example.com`, and `npm run deploy` again.

## Notes

- There is one coach account per club; clients get their own accounts via the
  private invite links you create in the app.
- Back up by exporting from the app, or copy the D1 database with
  `wrangler d1 export`.
- Windows-on-ARM64 toolchain details live in `scripts/patch-workerd-arm64.mjs`
  and `scripts/wrangler.mjs` (handled automatically by `npm install`).
