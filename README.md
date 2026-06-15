# NodeX

A Serverless V2Ray Subscription Manager and Ping Tester built for Cloudflare Workers.

NodeX fetches your V2Ray subscriptions, parses the nodes, tests their latency using Cloudflare's TCP Sockets, and provides you with a clean, unified, and fast Base64 subscription link along with a beautiful UI.

## Features
- **Serverless**: Runs 100% on Cloudflare Workers (No VPS needed).
- **TCP Ping**: Tests nodes directly using `cloudflare:sockets`.
- **Database**: Stores everything in Cloudflare D1.
- **Auto-Update**: Uses Cloudflare Cron Triggers to test nodes every 6 hours.
- **Premium UI**: Beautiful Glassmorphism dark-mode interface.

## Quick Deploy

You can deploy this project directly to your Cloudflare account with one click:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ramin-mahmoodi/NodeX)

> **Note**: During deployment, Cloudflare might ask you to authorize Github and configure the D1 database binding.
> The default D1 binding name is `DB`. You must run `schema.sql` to initialize the database tables.

## Manual Setup & Development

1. Clone the repository.
2. Install dependencies: `npm install`
3. Create a D1 database: `npx wrangler d1 create sub-manager-db`
4. Update `wrangler.toml` with your `database_id`.
5. Execute the schema: `npx wrangler d1 execute sub-manager-db --file=./schema.sql --remote`
6. Deploy: `npm run deploy`
