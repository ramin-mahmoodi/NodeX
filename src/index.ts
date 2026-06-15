import { Hono } from 'hono';
import { parseSubscription, parseURI } from './parser';
import { tcpPing } from './tester';

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Frontend HTML template
const getHtml = () => `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>V2Ray Sub Manager (Cloudflare)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: { primary: "#3b82f6", background: "#0f172a" },
                    fontFamily: { sans: ["Inter", "sans-serif"] }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: "Inter", sans-serif; background: #0f172a; color: #e2e8f0; }
        .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); }
    </style>
</head>
<body class="min-h-screen p-8">
    <div class="max-w-4xl mx-auto space-y-8">
        <h1 class="text-3xl font-bold text-white">V2Ray Sub Manager (CF Edition)</h1>
        
        <div class="glass p-6 rounded-xl space-y-4">
            <h2 class="text-xl font-semibold">Public Subscription Link</h2>
            <div class="flex gap-4">
                <input type="text" readonly value="https://<your-worker-url>/sub" class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" id="sub-link">
            </div>
            <p class="text-slate-400 text-sm">Use this link in your V2Ray client. It contains all active, TCP-pinged nodes.</p>
        </div>

        <div class="glass p-6 rounded-xl space-y-4">
            <h2 class="text-xl font-semibold">Active Nodes</h2>
            <div id="nodes-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                Loading...
            </div>
        </div>
    </div>
    <script>
        fetch('/api/configs')
            .then(res => res.json())
            .then(data => {
                const container = document.getElementById('nodes-container');
                container.innerHTML = '';
                if(data.length === 0) container.innerHTML = '<p>No nodes found. Add subs via DB or Admin API.</p>';
                data.forEach(n => {
                    container.innerHTML += \`
                        <div class="bg-slate-800 p-4 rounded-lg border border-slate-700">
                            <div class="flex justify-between">
                                <span class="font-bold text-blue-400">\${n.protocol.toUpperCase()}</span>
                                <span class="\${n.ping_ms < 200 ? 'text-emerald-400' : 'text-yellow-400'}">\${n.ping_ms} ms</span>
                            </div>
                            <p class="text-slate-300 truncate mt-2">\${n.name}</p>
                        </div>
                    \`;
                });
            });
    </script>
</body>
</html>`;

// Serve Frontend
app.get('/', (c) => c.html(getHtml()));

// Output Base64 Subscription
app.get('/sub', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT raw_uri FROM configs WHERE status = 'active' AND fail_count < 3 ORDER BY ping_ms ASC"
  ).all<{ raw_uri: string }>();

  const uris = results.map(r => r.raw_uri).join('\n');
  return c.text(btoa(uris));
});

// Get Active Configs (JSON)
app.get('/api/configs', async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT name, protocol, ping_ms, last_tested_at FROM configs WHERE status = 'active' AND fail_count < 3 ORDER BY ping_ms ASC"
  ).all();
  return c.json(results);
});

// Admin Add Sub (Simplified)
app.post('/api/admin/subs', async (c) => {
  const body = await c.req.json();
  if (!body.url) return c.json({ error: 'URL required' }, 400);

  await c.env.DB.prepare(
    "INSERT INTO subscriptions (url, name) VALUES (?, ?)"
  ).bind(body.url, body.name || 'Auto-Added').run();

  return c.json({ success: true });
});

// Trigger Update & Ping Task (Manual)
app.post('/api/admin/update', async (c) => {
  await runUpdateTask(c.env);
  return c.json({ success: true, message: 'Update task triggered in background' });
});

async function runUpdateTask(env: Env) {
  try {
    const { results: subs } = await env.DB.prepare("SELECT * FROM subscriptions").all<{ id: number, url: string }>();

    for (const sub of subs) {
      try {
        const resp = await fetch(sub.url);
        const text = await resp.text();
        const uris = parseSubscription(text);

        for (const uri of uris) {
          const parsed = parseURI(uri);
          if (parsed && parsed.host) {
            await env.DB.prepare(`
              INSERT INTO configs (sub_id, name, raw_uri, protocol, host, port)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(raw_uri) DO UPDATE SET name=excluded.name, host=excluded.host, port=excluded.port
            `).bind(sub.id, parsed.name, parsed.raw_uri, parsed.protocol, parsed.host, parsed.port).run();
          }
        }
      } catch (e) {
        console.error(`Failed to fetch sub ${sub.url}`, e);
      }
    }

    // Ping test
    const { results: configs } = await env.DB.prepare("SELECT id, host, port FROM configs").all<{ id: number, host: string, port: number }>();
    
    for (const cfg of configs) {
      if (cfg.host && cfg.port) {
        const ping = await tcpPing(cfg.host, cfg.port);
        if (ping !== -1) {
          await env.DB.prepare("UPDATE configs SET status='active', ping_ms=?, fail_count=0, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(ping, cfg.id).run();
        } else {
          await env.DB.prepare("UPDATE configs SET status='error', fail_count=fail_count+1, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(cfg.id).run();
        }
      }
    }

    // Prune
    await env.DB.prepare("DELETE FROM configs WHERE fail_count >= 5").run();

  } catch (e) {
    console.error("Task failed", e);
  }
}

export default {
  fetch: app.fetch,
  
  // Cron Trigger handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runUpdateTask(env));
  }
};
