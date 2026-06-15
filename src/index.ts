import { Hono } from 'hono';
import { parseSubscription, parseURI } from './parser';
import { tcpPing } from './tester';

export interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Frontend HTML template
const getHtml = () => `<!DOCTYPE html>
<html lang="fa" dir="rtl" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NodeX</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: { primary: "#3b82f6" },
                    fontFamily: { sans: ["Inter", "Vazirmatn", "sans-serif"] }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Vazirmatn:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        html[lang="fa"] body { font-family: "Vazirmatn", sans-serif; transition: background-color 0.3s, color 0.3s; }
        html[lang="en"] body { font-family: "Inter", sans-serif; transition: background-color 0.3s, color 0.3s; }
        
        /* Light Theme (Fluid Art Inspired Background) */
        html.light body { 
            background: radial-gradient(circle at 15% 50%, rgba(253, 230, 138, 0.4), transparent 50%),
                        radial-gradient(circle at 85% 30%, rgba(191, 219, 254, 0.6), transparent 50%),
                        radial-gradient(circle at 50% 80%, rgba(252, 165, 165, 0.3), transparent 50%),
                        #f8fafc;
            color: #0f172a;
        }
        
        /* Dark Theme (Solid Dark) */
        html.dark body { 
            background-color: #09090b; /* Very dark zinc */
            color: #fafafa;
        }
        
        /* Premium Cards */
        .ds-card {
            border-radius: 1.5rem; /* rounded-3xl */
            padding: 1.5rem;
            transition: all 0.3s ease;
        }
        
        html.light .ds-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(0, 0, 0, 0.04);
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08);
        }
        
        html.dark .ds-card {
            background: #18181b; /* zinc-900 */
            border: 1px solid #27272a; /* zinc-800 */
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.5);
        }
        
        /* Table / Grid System */
        .ds-table-head {
            font-size: 0.65rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            font-weight: 600;
        }
        html.light .ds-table-head { color: #94a3b8; }
        html.dark .ds-table-head { color: #71717a; }
        
        .ds-row {
            border-bottom-width: 1px;
            transition: background-color 0.2s;
        }
        html.light .ds-row { border-color: #f1f5f9; }
        html.dark .ds-row { border-color: #27272a; }
        html.light .ds-row:hover { background-color: #f8fafc; }
        html.dark .ds-row:hover { background-color: #27272a; }

        /* General text overrides */
        html.light .text-slate-400 { color: #64748b !important; }
        html.light .text-slate-300 { color: #475569 !important; }
        html.light .text-slate-200 { color: #334155 !important; }
        html.light .bg-slate-800 { background-color: #f1f5f9 !important; border-color: #e2e8f0 !important; color: #0f172a !important; }
        html.light .bg-slate-700 { background-color: #e2e8f0 !important; color: #0f172a !important; }
        html.light .border-slate-700 { border-color: #cbd5e1 !important; }
        html.light .hover\:bg-slate-600:hover { background-color: #cbd5e1 !important; }
    </style>
</head>
<body class="min-h-screen p-4 sm:p-8 relative">

    <!-- Toast Notification -->
    <div id="toast" class="fixed top-5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg transition-opacity duration-300 opacity-0 pointer-events-none flex items-center gap-2 z-50">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        <span class="font-medium" data-i18n="copied">Copied</span>
    </div>

    <!-- QR Code Popover -->
    <div id="qr-popover" class="fixed bg-white p-3 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-200 opacity-0 pointer-events-none z-50 transform scale-95" style="width: 200px; height: 200px;">
        <img id="qr-image" src="" class="w-full h-full bg-white" alt="QR Code" />
    </div>

    <div class="max-w-4xl mx-auto space-y-8">
        <div class="flex justify-between items-center mb-6">
            <div class="flex items-center space-x-4 rtl:space-x-reverse">
                <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <span class="font-black text-2xl tracking-tighter" style="color: white !important;">NX</span>
                </div>
                <h1 class="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 tracking-tight" data-i18n="title">NodeX</h1>
            </div>

            <!-- Toolbar (Theme & Lang) -->
            <div class="flex items-center gap-2">
                <button onclick="toggleTheme()" id="theme-btn" class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300 transition-colors shadow-sm bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50" title="Theme">
                    <!-- Default Moon (Dark mode icon) -->
                    <svg id="icon-moon" fill-rule="evenodd" viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M489.5 111.66c30.65-1.8 45.98 36.44 22.58 56.33A243.35 243.35 0 00426 354c0 134.76 109.24 244 244 244 72.58 0 139.9-31.83 186.01-86.08 19.87-23.38 58.07-8.1 56.34 22.53C900.4 745.82 725.15 912 512.5 912 291.31 912 112 732.69 112 511.5c0-211.39 164.29-386.02 374.2-399.65l.2-.01z"></path></svg>
                    <svg id="icon-sun" class="hidden" fill-rule="evenodd" viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M548 818v126a16 16 0 01-16 16h-40a16 16 0 01-16-16V818c15.85 1.64 27.84 2.46 36 2.46 8.15 0 20.16-.82 36-2.46m205.25-115.66l89.1 89.1a16 16 0 010 22.62l-28.29 28.29a16 16 0 01-22.62 0l-89.1-89.1c12.37-10.04 21.43-17.95 27.2-23.71 5.76-5.77 13.67-14.84 23.71-27.2m-482.5 0c10.04 12.36 17.95 21.43 23.71 27.2 5.77 5.76 14.84 13.67 27.2 23.71l-89.1 89.1a16 16 0 01-22.62 0l-28.29-28.29a16 16 0 010-22.63zM512 278c129.24 0 234 104.77 234 234S641.24 746 512 746 278 641.24 278 512s104.77-234 234-234m0 72c-89.47 0-162 72.53-162 162s72.53 162 162 162 162-72.53 162-162-72.53-162-162-162M206 476c-1.64 15.85-2.46 27.84-2.46 36 0 8.15.82 20.16 2.46 36H80a16 16 0 01-16-16v-40a16 16 0 0116-16zm738 0a16 16 0 0116 16v40a16 16 0 01-16 16H818c1.64-15.85 2.46-27.84 2.46-36 0-8.15-.82-20.16-2.46-36zM814.06 180.65l28.29 28.29a16 16 0 010 22.63l-89.1 89.09c-10.04-12.37-17.95-21.43-23.71-27.2-5.77-5.76-14.84-13.67-27.2-23.71l89.1-89.1a16 16 0 0122.62 0m-581.5 0l89.1 89.1c-12.37 10.04-21.43 17.95-27.2 23.71-5.76 5.77-13.67 14.84-23.71 27.2l-89.1-89.1a16 16 0 010-22.62l28.29-28.29a16 16 0 0122.62 0M532 64a16 16 0 0116 16v126c-15.85-1.64-27.84-2.46-36-2.46-8.15 0-20.16.82-36 2.46V80a16 16 0 0116-16z"></path></svg>
                </button>
                <button onclick="toggleLang()" class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300 transition-colors shadow-sm bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/50" title="Language">
                    <svg viewBox="64 64 896 896" width="1em" height="1em" fill="currentColor"><path d="M140 188h584v164h76V144c0-17.7-14.3-32-32-32H96c-17.7 0-32 14.3-32 32v736c0 17.7 14.3 32 32 32h544v-76H140V188z"></path><path d="M414.3 256h-60.6c-3.4 0-6.4 2.2-7.6 5.4L219 629.4c-.3.8-.4 1.7-.4 2.6 0 4.4 3.6 8 8 8h55.1c3.4 0 6.4-2.2 7.6-5.4L322 540h196.2L422 261.4a8.42 8.42 0 00-7.7-5.4zm12.4 228h-85.5L384 360.2 426.7 484zM936 528H800v-93c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v93H592c-13.3 0-24 10.7-24 24v176c0 13.3 10.7 24 24 24h136v152c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V752h136c13.3 0 24-10.7 24-24V552c0-13.3-10.7-24-24-24zM728 680h-88v-80h88v80zm160 0h-88v-80h88v80z"></path></svg>
                </button>
            </div>
        </div>
        
        <div class="ds-card space-y-4">
            <h2 class="text-lg font-semibold" data-i18n="pubSub">Public Subscription Link</h2>
            <div class="flex gap-4">
                <input type="text" readonly value="https://<your-worker-url>/sub" class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white dir-ltr font-medium" style="direction: ltr;" id="sub-link">
            </div>
            <p class="text-slate-400 text-xs" data-i18n="pubSubDesc">Use this link in your V2Ray client. It contains all active, TCP-pinged nodes.</p>
        </div>

        <div class="ds-card space-y-4">
            <h2 class="text-lg font-semibold text-blue-500 dark:text-blue-400" data-i18n="addSubTitle">Add Sub</h2>
            <div class="flex flex-col sm:flex-row gap-3">
                <input type="text" id="new-sub-url" data-i18n-ph="addSubPlaceholder" placeholder="Paste your V2Ray Subscription URL here..." class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ltr-placeholder transition-all" style="direction: ltr;">
                <button onclick="addSub()" class="px-6 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:-translate-y-0.5 whitespace-nowrap" data-i18n="addBtn">Add & Test</button>
            </div>
            <p id="admin-msg" class="text-xs text-slate-400 mt-2"></p>
        </div>

        <div class="ds-card space-y-4">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-lg font-semibold text-purple-500 dark:text-purple-400" data-i18n="manageSub">Manage Subscriptions</h2>
                <button onclick="updateAll()" id="btn-update" class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-all shadow-[0_4px_14px_0_rgba(147,51,234,0.39)] hover:shadow-[0_6px_20px_rgba(147,51,234,0.23)] hover:-translate-y-0.5" data-i18n="updateAllBtn">Update & Ping All</button>
            </div>
            <div id="subs-container" class="overflow-x-auto">
                <p class="text-slate-400 text-sm" data-i18n="loading">Loading...</p>
            </div>
        </div>

        <div class="ds-card space-y-4">
            <h2 class="text-lg font-semibold mb-6" data-i18n="activeNodes">Active Nodes</h2>
            <div id="nodes-container" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p class="text-slate-400" data-i18n="loading">Loading...</p>
            </div>
            <div id="pagination-controls" class="flex justify-center items-center gap-2 mt-6 hidden"></div>
        </div>
    </div>
    <script>
        const i18n = {
            en: {
                title: "NodeX", pubSub: "Public Subscription Link", pubSubDesc: "Use this link in your V2Ray client. It contains all active, TCP-pinged nodes.", addSubTitle: "Add Sub", addSubPlaceholder: "Paste your V2Ray Subscription URL here...", addBtn: "Add & Test", manageSub: "Manage Subscriptions", updateAllBtn: "Update & Ping All", updatingBtn: "Updating in background...", urlHead: "URL", actionHead: "Action", deleteBtn: "Delete", noSubs: "No subscriptions added yet.", activeNodes: "Active Nodes", loading: "Loading...", noNodes: "No active nodes found. Paste a subscription link above and click Add & Test.", prev: "Prev", next: "Next", pageOf: "Page {1} of {2}", copied: "Copied", confirmDelete: "Are you sure you want to delete this subscription? All its nodes will be removed.", errorLoading: "Error loading nodes: ", testingMsg: "⏳ Adding sub and testing nodes in the background...", successMsg: "✅ Success! Nodes are being pinged in the background. Refresh in a minute."
            },
            fa: {
                title: "نود ایکس", pubSub: "لینک اشتراک عمومی", pubSubDesc: "از این لینک در برنامه V2Ray خود استفاده کنید. این لینک شامل تمامی کانفیگ‌های فعال است.", addSubTitle: "افزودن اشتراک", addSubPlaceholder: "لینک اشتراک V2Ray خود را اینجا پیست کنید...", addBtn: "افزودن و تست", manageSub: "مدیریت اشتراک‌ها", updateAllBtn: "تست و آپدیت همه", updatingBtn: "در حال آپدیت...", urlHead: "لینک", actionHead: "عملیات", deleteBtn: "حذف", noSubs: "هنوز اشتراکی اضافه نشده است.", activeNodes: "کانفیگ‌های فعال", loading: "در حال بارگذاری...", noNodes: "هیچ کانفیگ فعالی یافت نشد. لینک اشتراک خود را وارد کنید و روی دکمه افزودن کلیک کنید.", prev: "قبلی", next: "بعدی", pageOf: "صفحه {1} از {2}", copied: "کپی شد", confirmDelete: "آیا از حذف این اشتراک اطمینان دارید؟ تمام کانفیگ‌های آن حذف خواهند شد.", errorLoading: "خطا در بارگذاری: ", testingMsg: "⏳ در حال افزودن و تست کانفیگ‌ها در پس‌زمینه...", successMsg: "✅ با موفقیت اضافه شد. کانفیگ‌ها در حال پینگ گرفتن هستند. لطفاً یک دقیقه دیگر رفرش کنید."
            }
        };

        let currentLang = localStorage.getItem('nodex_lang') || 'fa';
        let currentTheme = localStorage.getItem('nodex_theme') || 'dark';

        function applyTheme() {
            document.documentElement.classList.remove('dark', 'light');
            document.documentElement.classList.add(currentTheme);
            document.getElementById('icon-sun').classList.toggle('hidden', currentTheme === 'dark');
            document.getElementById('icon-moon').classList.toggle('hidden', currentTheme === 'light');
            localStorage.setItem('nodex_theme', currentTheme);
        }

        function applyLang() {
            document.documentElement.dir = currentLang === 'fa' ? 'rtl' : 'ltr';
            document.documentElement.lang = currentLang;
            
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const k = el.getAttribute('data-i18n');
                if (i18n[currentLang][k]) el.innerText = i18n[currentLang][k];
            });
            document.querySelectorAll('[data-i18n-ph]').forEach(el => {
                const k = el.getAttribute('data-i18n-ph');
                if (i18n[currentLang][k]) el.placeholder = i18n[currentLang][k];
            });

            localStorage.setItem('nodex_lang', currentLang);
            
            // Re-render components to apply new language
            renderConfigs();
            renderSubs();
        }

        function toggleTheme() {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme();
        }

        function toggleLang() {
            currentLang = currentLang === 'en' ? 'fa' : 'en';
            applyLang();
        }

        let allConfigs = [];
        let currentPage = 1;
        const itemsPerPage = 10;
        let allSubs = [];

        // Init
        applyTheme();
        applyLang();

        document.getElementById('sub-link').value = window.location.origin + '/sub';

        function loadConfigs() {
            fetch('/api/configs')
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        document.getElementById('nodes-container').innerHTML = \`<p class="text-red-400">\${i18n[currentLang].errorLoading}\${data.error}</p>\`;
                        document.getElementById('pagination-controls').classList.add('hidden');
                        return;
                    }
                    allConfigs = data;
                    currentPage = 1;
                    renderConfigs();
                })
                .catch(err => {
                    document.getElementById('nodes-container').innerHTML = \`<p class="text-red-400">\${i18n[currentLang].errorLoading}\${err.message}</p>\`;
                    document.getElementById('pagination-controls').classList.add('hidden');
                });
        }

        function renderConfigs() {
            const container = document.getElementById('nodes-container');
            const pagContainer = document.getElementById('pagination-controls');
            
            if (!allConfigs || allConfigs.length === 0) {
                container.innerHTML = \`<p class="text-slate-400 col-span-full">\${i18n[currentLang].noNodes}</p>\`;
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
                const isGood = n.ping_ms < 200;
                const statusColor = isGood ? 'text-emerald-500' : 'text-amber-500';
                const statusBg = isGood ? 'bg-emerald-500/10' : 'bg-amber-500/10';
                
                container.innerHTML += \`
                    <div class="ds-row p-4 flex flex-col justify-between" style="direction: ltr;">
                        <div class="flex justify-between items-center mb-3">
                            <div class="flex items-center gap-3">
                                <span class="px-2.5 py-1 \${statusBg} \${statusColor} text-[10px] rounded-full font-bold uppercase tracking-wider">\${n.protocol}</span>
                                <span class="flex items-center gap-1.5 text-xs font-semibold \${statusColor}">
                                    <div class="w-1.5 h-1.5 rounded-full \${isGood ? 'bg-emerald-500' : 'bg-amber-500'} shadow-[0_0_8px_currentColor]"></div>
                                    \${n.ping_ms} ms
                                </span>
                            </div>
                            <div class="flex justify-end gap-1 relative">
                                <button onclick="copyToClipboard('\${n.raw_uri}')" class="flex items-center justify-center w-7 h-7 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="Copy">
                                    <svg viewBox="64 64 896 896" width="14" height="14" fill="currentColor"><path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32zM704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"></path></svg>
                                </button>
                                <button onclick="toggleQR(event, '\${n.raw_uri}')" class="flex items-center justify-center w-7 h-7 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors" title="QR Code">
                                    <svg viewBox="64 64 896 896" width="14" height="14" fill="currentColor"><path d="M468 128H160c-17.7 0-32 14.3-32 32v308c0 4.4 3.6 8 8 8h332c4.4 0 8-3.6 8-8V136c0-4.4-3.6-8-8-8zm-56 284H192V192h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm194 210H136c-4.4 0-8 3.6-8 8v308c0 17.7 14.3 32 32 32h308c4.4 0 8-3.6 8-8V556c0-4.4-3.6-8-8-8zm-56 284H192V612h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm590-630H556c-4.4 0-8 3.6-8 8v332c0 4.4 3.6 8 8 8h332c4.4 0 8-3.6 8-8V160c0-17.7-14.3-32-32-32zm-32 284H612V192h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm194 210h-48c-4.4 0-8 3.6-8 8v134h-78V556c0-4.4-3.6-8-8-8H556c-4.4 0-8 3.6-8 8v332c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V644h78v102c0 4.4 3.6 8 8 8h190c4.4 0 8-3.6 8-8V556c0-4.4-3.6-8-8-8zM746 832h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zm142 0h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8z"></path></svg>
                                </button>
                            </div>
                        </div>
                        <p class="text-slate-600 dark:text-slate-300 text-sm truncate font-medium" title="\${n.name}">\${n.name}</p>
                    </div>
                \`;
            });

            if (totalPages > 1) {
                pagContainer.classList.remove('hidden');
                const pText = i18n[currentLang].pageOf.replace('{1}', currentPage).replace('{2}', totalPages);
                pagContainer.innerHTML = \`
                    <button onclick="changePage(-1)" class="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-transparent" \${currentPage === 1 ? 'disabled' : ''}>\${i18n[currentLang].prev}</button>
                    <span class="text-slate-500 dark:text-slate-400 text-xs px-4 font-semibold tracking-wide uppercase">\${pText}</span>
                    <button onclick="changePage(1)" class="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-500 dark:text-slate-400 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-transparent" \${currentPage === totalPages ? 'disabled' : ''}>\${i18n[currentLang].next}</button>
                \`;
            } else {
                pagContainer.classList.add('hidden');
            }
        }

        function changePage(dir) {
            currentPage += dir;
            renderConfigs();
        }

        function loadSubs() {
            fetch('/api/admin/subs')
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    allSubs = data;
                    renderSubs();
                });
        }

        function renderSubs() {
            const container = document.getElementById('subs-container');
            if (!allSubs || allSubs.length === 0) {
                container.innerHTML = \`<p class="text-slate-400">\${i18n[currentLang].noSubs}</p>\`;
                return;
            }
            let html = \`<table class="w-full text-sm text-slate-600 dark:text-slate-300 text-\${currentLang === 'fa' ? 'right' : 'left'}" dir="ltr"><thead><tr class="ds-row"><th class="pb-3 text-left ds-table-head px-2">\${i18n[currentLang].urlHead}</th><th class="pb-3 text-right ds-table-head px-2">\${i18n[currentLang].actionHead}</th></tr></thead><tbody>\`;
            allSubs.forEach(s => {
                html += \`<tr class="ds-row"><td class="py-4 px-2 truncate max-w-[200px] sm:max-w-xs text-left font-medium" style="direction: ltr;" title="\${s.url}">\${s.url}</td><td class="py-4 px-2 text-right"><button onclick="deleteSub(\${s.id})" class="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 px-3 py-1.5 bg-red-50 dark:bg-red-400/10 hover:bg-red-100 dark:hover:bg-red-400/20 rounded-lg transition-colors text-xs font-semibold">\${i18n[currentLang].deleteBtn}</button></td></tr>\`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }
        
        function deleteSub(id) {
            if(!confirm(i18n[currentLang].confirmDelete)) return;
            fetch('/api/admin/subs/' + id, { method: 'DELETE' })
                .then(() => {
                    loadSubs();
                    loadConfigs();
                });
        }

        loadConfigs();
        loadSubs();

        function addSub() {
            const url = document.getElementById('new-sub-url').value;
            const msg = document.getElementById('admin-msg');
            if(!url) return;
            msg.innerHTML = \`<span class="text-yellow-400">\${i18n[currentLang].testingMsg}</span>\`;
            
            fetch('/api/admin/subs', {
                method: 'POST',
                body: JSON.stringify({ url: url }),
                headers: { 'Content-Type': 'application/json' }
            }).then(async res => {
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    throw new Error(err.error || 'Failed to add sub');
                }
                loadSubs();
                return fetch('/api/admin/update', { method: 'POST' });
            }).then(async res => {
                if (!res.ok) {
                    const err = await res.json().catch(()=>({}));
                    throw new Error(err.error || 'Failed to start update');
                }
                msg.innerHTML = \`<span class="text-emerald-500 font-medium">\${i18n[currentLang].successMsg}</span>\`;
                document.getElementById('new-sub-url').value = '';
                setTimeout(loadConfigs, 5000);
            }).catch(e => {
                msg.innerHTML = \`<span class="text-red-500 font-medium">\${e.message || i18n[currentLang].errorLoading}</span>\`;
            });
        }

        function updateAll() {
            const btn = document.getElementById('btn-update');
            btn.innerText = i18n[currentLang].updatingBtn;
            btn.disabled = true;
            btn.classList.add('opacity-50');
            fetch('/api/admin/update', { method: 'POST' }).then(() => {
                setTimeout(() => {
                    btn.innerText = i18n[currentLang].updateAllBtn;
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
            if (!popover.classList.contains('opacity-0') && img.src.includes(encodeURIComponent(text))) {
                closeQR();
                return;
            }
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=' + encodeURIComponent(text);
            const rect = event.currentTarget.getBoundingClientRect();
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
            if (!popover.contains(e.target)) closeQR();
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
  try {
    const body = await c.req.json();
    if (!body.url) return c.json({ error: 'URL required' }, 400);

    try {
      new URL(body.url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO subscriptions (url, name) VALUES (?, ?)"
    ).bind(body.url, body.name || 'Auto-Added').run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
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
