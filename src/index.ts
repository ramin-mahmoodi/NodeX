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
<body class="min-h-screen p-8 relative">
    <!-- Toast Notification -->
    <div id="toast" class="fixed top-5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg transition-opacity duration-300 opacity-0 pointer-events-none flex items-center gap-2 z-50">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        <span class="font-medium">Copied</span>
    </div>

    <!-- QR Code Popover -->
    <div id="qr-popover" class="fixed bg-white p-3 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-200 opacity-0 pointer-events-none z-50 transform scale-95" style="width: 200px; height: 200px;">
        <img id="qr-image" src="" class="w-full h-full bg-white" alt="QR Code" />
    </div>

    <div class="max-w-4xl mx-auto space-y-8">
        <div class="flex items-center space-x-4 mb-6">
            <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span class="text-white font-black text-2xl tracking-tighter">NX</span>
            </div>
            <h1 class="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight">NodeX</h1>
        </div>
        
        <div class="glass p-6 rounded-xl space-y-4">
            <h2 class="text-xl font-semibold">Public Subscription Link</h2>
            <div class="flex gap-4">
                <input type="text" readonly value="https://<your-worker-url>/sub" class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" id="sub-link">
            </div>
            <p class="text-slate-400 text-sm">Use this link in your V2Ray client. It contains all active, TCP-pinged nodes.</p>
        </div>

        <div class="glass p-6 rounded-xl space-y-4">
            <h2 class="text-xl font-semibold text-blue-400">Add Sub</h2>
            <div class="flex flex-col sm:flex-row gap-4">
                <input type="text" id="new-sub-url" placeholder="Paste your V2Ray Subscription URL here..." class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary">
                <button onclick="addSub()" class="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-[0_0_15px_rgba(59,130,246,0.2)]">Add & Test</button>
            </div>
            <p id="admin-msg" class="text-sm text-slate-400 mt-2"></p>
        </div>

        <div class="glass p-6 rounded-xl space-y-4">
            <div class="flex justify-between items-center">
                <h2 class="text-xl font-semibold text-purple-400">Manage Subscriptions</h2>
                <button onclick="updateAll()" id="btn-update" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]">Update & Ping All</button>
            </div>
            <div id="subs-container" class="overflow-x-auto">
                <p class="text-slate-400">Loading subscriptions...</p>
            </div>
        </div>

        <div class="glass p-6 rounded-xl space-y-4">
            <h2 class="text-xl font-semibold">Active Nodes</h2>
            <div id="nodes-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                Loading...
            </div>
            <div id="pagination-controls" class="flex justify-center items-center gap-2 mt-6 hidden"></div>
        </div>
    </div>
    <script>
        let allConfigs = [];
        let currentPage = 1;
        const itemsPerPage = 10;

        // Set dynamic URL
        document.getElementById('sub-link').value = window.location.origin + '/sub';

        // Load configs and render
        function loadConfigs() {
            fetch('/api/configs')
                .then(res => res.json())
                .then(data => {
                    const container = document.getElementById('nodes-container');
                    const pagContainer = document.getElementById('pagination-controls');
                    if (data.error) {
                        container.innerHTML = \`<p class="text-red-400">Error loading nodes: \${data.error}</p>\`;
                        pagContainer.classList.add('hidden');
                        return;
                    }
                    allConfigs = data;
                    currentPage = 1;
                    renderConfigs();
                })
                .catch(err => {
                    document.getElementById('nodes-container').innerHTML = \`<p class="text-red-400">Error loading nodes: \${err.message}. Please check if the Database is correctly created and bound.</p>\`;
                    document.getElementById('pagination-controls').classList.add('hidden');
                });
        }

        function renderConfigs() {
            const container = document.getElementById('nodes-container');
            const pagContainer = document.getElementById('pagination-controls');
            
            if (!allConfigs || allConfigs.length === 0) {
                container.innerHTML = '<p class="text-slate-400 col-span-full">No active nodes found. Paste a subscription link above and click Add & Test.</p>';
                pagContainer.classList.add('hidden');
                return;
            }

            const totalPages = Math.ceil(allConfigs.length / itemsPerPage);
            if(currentPage < 1) currentPage = 1;
            if(currentPage > totalPages) currentPage = totalPages;

            const startIdx = (currentPage - 1) * itemsPerPage;
            const currentItems = allConfigs.slice(startIdx, startIdx + itemsPerPage);

            container.innerHTML = '';
            currentItems.forEach(n => {
                container.innerHTML += \`
                            <div class="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col justify-between hover:border-slate-500 transition-colors">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded font-bold">\${n.protocol.toUpperCase()}</span>
                                    <span class="flex items-center gap-1 text-sm font-medium \${n.ping_ms < 200 ? 'text-emerald-400' : 'text-yellow-400'}">
                                        <div class="w-2 h-2 rounded-full \${n.ping_ms < 200 ? 'bg-emerald-500' : 'bg-yellow-500'}"></div>
                                        \${n.ping_ms} ms
                                    </span>
                                </div>
                                <p class="text-slate-200 text-sm truncate mb-3" title="\${n.name}">\${n.name}</p>
                                <div class="flex justify-end gap-2 mt-auto relative">
                                    <button onclick="copyToClipboard('\${n.raw_uri}')" class="flex items-center justify-center w-7 h-7 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors border border-slate-600" title="Copy">
                                        <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32zM704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"></path></svg>
                                    </button>
                                    <button onclick="toggleQR(event, '\${n.raw_uri}')" class="flex items-center justify-center w-7 h-7 bg-slate-700/50 hover:bg-slate-600 rounded text-slate-300 transition-colors border border-slate-600" title="QR Code">
                                        <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M468 128H160c-17.7 0-32 14.3-32 32v308c0 4.4 3.6 8 8 8h332c4.4 0 8-3.6 8-8V136c0-4.4-3.6-8-8-8zm-56 284H192V192h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm194 210H136c-4.4 0-8 3.6-8 8v308c0 17.7 14.3 32 32 32h308c4.4 0 8-3.6 8-8V556c0-4.4-3.6-8-8-8zm-56 284H192V612h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm590-630H556c-4.4 0-8 3.6-8 8v332c0 4.4 3.6 8 8 8h332c4.4 0 8-3.6 8-8V160c0-17.7-14.3-32-32-32zm-32 284H612V192h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm194 210h-48c-4.4 0-8 3.6-8 8v134h-78V556c0-4.4-3.6-8-8-8H556c-4.4 0-8 3.6-8 8v332c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V644h78v102c0 4.4 3.6 8 8 8h190c4.4 0 8-3.6 8-8V556c0-4.4-3.6-8-8-8zM746 832h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zm142 0h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8z"></path></svg>
                                    </button>
                                </div>
                            </div>
                        \`;
            });

            if (totalPages > 1) {
                pagContainer.classList.remove('hidden');
                pagContainer.innerHTML = \`
                    <button onclick="changePage(-1)" class="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" \${currentPage === 1 ? 'disabled' : ''}>Prev</button>
                    <span class="text-slate-400 text-sm px-4 font-medium">Page \${currentPage} of \${totalPages}</span>
                    <button onclick="changePage(1)" class="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" \${currentPage === totalPages ? 'disabled' : ''}>Next</button>
                \`;
            } else {
                pagContainer.classList.add('hidden');
            }
        }

        function changePage(dir) {
            currentPage += dir;
            renderConfigs();
        }

        // Load Subscriptions
        function loadSubs() {
            fetch('/api/admin/subs')
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    const container = document.getElementById('subs-container');
                    if (!data || data.length === 0) {
                        container.innerHTML = '<p class="text-slate-400">No subscriptions added yet.</p>';
                        return;
                    }
                    let html = '<table class="w-full text-left text-sm text-slate-300"><thead><tr class="border-b border-slate-700/50"><th class="pb-2">URL</th><th class="pb-2 text-right">Action</th></tr></thead><tbody>';
                    data.forEach(s => {
                        html += \`<tr class="border-b border-slate-700/50"><td class="py-3 truncate max-w-[200px] sm:max-w-xs" title="\${s.url}">\${s.url}</td><td class="py-3 text-right"><button onclick="deleteSub(\${s.id})" class="text-red-400 hover:text-red-300 px-3 py-1.5 bg-red-400/10 hover:bg-red-400/20 rounded transition-colors text-xs font-medium">Delete</button></td></tr>\`;
                    });
                    html += '</tbody></table>';
                    container.innerHTML = html;
                }).catch(e => {
                    document.getElementById('subs-container').innerHTML = '<p class="text-red-400">Error loading subscriptions.</p>';
                });
        }
        
        function deleteSub(id) {
            if(!confirm('Are you sure you want to delete this subscription? All its nodes will be removed.')) return;
            fetch('/api/admin/subs/' + id, { method: 'DELETE' })
                .then(() => {
                    loadSubs();
                    loadConfigs();
                });
        }

        loadConfigs();
        loadSubs();

        // Add sub logic
        function addSub() {
            const url = document.getElementById('new-sub-url').value;
            const msg = document.getElementById('admin-msg');
            if(!url) return;
            msg.innerHTML = '<span class="text-yellow-400">⏳ Adding sub and testing nodes in the background. Please wait, this might take a minute...</span>';
            
            fetch('/api/admin/subs', {
                method: 'POST',
                body: JSON.stringify({ url: url }),
                headers: { 'Content-Type': 'application/json' }
            }).then(() => {
                return fetch('/api/admin/update', { method: 'POST' });
            }).then(() => {
                msg.innerHTML = '<span class="text-emerald-400">✅ Success! Nodes are being pinged in the background. Refresh the page in a minute to see them below.</span>';
                document.getElementById('new-sub-url').value = '';
                setTimeout(loadConfigs, 5000); // Try loading after 5s just in case some finished
            }).catch(e => {
                msg.innerHTML = '<span class="text-red-400">❌ Error adding subscription.</span>';
            });
        }
        function updateAll() {
            const btn = document.getElementById('btn-update');
            btn.innerText = 'Updating in background...';
            btn.disabled = true;
            btn.classList.add('opacity-50');
            fetch('/api/admin/update', { method: 'POST' }).then(() => {
                setTimeout(() => {
                    btn.innerText = 'Update & Ping All';
                    btn.disabled = false;
                    btn.classList.remove('opacity-50');
                    loadConfigs();
                }, 10000);
            });
        }

        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                const toast = document.getElementById('toast');
                toast.classList.remove('opacity-0', 'pointer-events-none');
                setTimeout(() => toast.classList.add('opacity-0', 'pointer-events-none'), 2000);
            });
        }

        function toggleQR(event, text) {
            event.stopPropagation();
            const popover = document.getElementById('qr-popover');
            const img = document.getElementById('qr-image');
            
            // If clicking the same button to close
            if (!popover.classList.contains('opacity-0') && img.src.includes(encodeURIComponent(text))) {
                closeQR();
                return;
            }

            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=' + encodeURIComponent(text);
            
            const rect = event.currentTarget.getBoundingClientRect();
            
            // Calculate position
            if (rect.top < 220) {
                popover.style.top = (rect.bottom + 10) + 'px';
                popover.classList.replace('origin-bottom-right', 'origin-top-right');
            } else {
                popover.style.top = (rect.top - 210) + 'px';
                popover.classList.replace('origin-top-right', 'origin-bottom-right');
            }
            popover.style.left = (rect.left - 170) + 'px';

            popover.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        }

        function closeQR() {
            const popover = document.getElementById('qr-popover');
            popover.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
        }

        document.addEventListener('click', (e) => {
            const popover = document.getElementById('qr-popover');
            if (!popover.contains(e.target)) {
                closeQR();
            }
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
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT name, protocol, ping_ms, raw_uri, last_tested_at FROM configs WHERE status = 'active' AND fail_count < 3 ORDER BY ping_ms ASC"
    ).all();
    return c.json(results);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// Admin Get Subs
app.get('/api/admin/subs', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM subscriptions").all();
    return c.json(results);
  } catch (e) {
    return c.json([], 500);
  }
});

// Admin Delete Sub
app.delete('/api/admin/subs/:id', async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare("DELETE FROM configs WHERE sub_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM subscriptions WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Failed to delete' }, 500);
  }
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
  // Use waitUntil so the worker doesn't timeout while testing many nodes
  c.executionCtx.waitUntil(runUpdateTask(c.env));
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
    
    // Concurrent pinging for blazing fast tests
    const pings = await Promise.all(configs.map(async (cfg) => {
      if (!cfg.host || !cfg.port) return { id: cfg.id, ping: -1 };
      const ping = await tcpPing(cfg.host, cfg.port);
      return { id: cfg.id, ping };
    }));

    const stmts = [];
    for (const p of pings) {
      if (p.ping !== -1) {
        stmts.push(env.DB.prepare("UPDATE configs SET status='active', ping_ms=?, fail_count=0, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.ping, p.id));
      } else {
        stmts.push(env.DB.prepare("UPDATE configs SET status='error', fail_count=fail_count+1, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.id));
      }
    }

    // Execute in batches (D1 supports max 100 statements per batch)
    for (let i = 0; i < stmts.length; i += 100) {
      await env.DB.batch(stmts.slice(i, i + 100));
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
