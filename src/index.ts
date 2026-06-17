import { Hono } from 'hono';
import { parseSubscription, parseURI, encodeBase64Utf8 } from './parser';
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
    <div id="qr-popover" class="absolute z-50 transition-all duration-200 opacity-0 pointer-events-none transform scale-95 origin-top" style="width: 240px;">
        <div id="qr-arrow" class="absolute -top-[5px] -translate-x-1/2 w-[11px] h-[11px] rotate-45 bg-white dark:bg-[#1a1a1a] border-l border-t border-slate-200 dark:border-slate-800 rounded-tl-[1px] z-20 transition-all duration-200"></div>
        <div class="relative bg-white dark:bg-[#1a1a1a] p-3 rounded-xl shadow-2xl flex flex-col items-center z-10 border border-slate-200 dark:border-slate-800">
            <span class="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1 text-[11px] font-bold rounded mb-3 tracking-wide text-center truncate w-full" id="qr-tag-name">NodeX Sub</span>
            <div class="bg-white rounded-lg p-2 flex items-center justify-center">
                <img id="qr-image" src="" class="w-[180px] h-[180px] object-contain" alt="QR Code" />
            </div>
        </div>
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
            <div class="relative flex gap-4">
                <input type="text" readonly value="https://<your-worker-url>/sub" class="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-24 py-3 text-sm text-white dir-ltr font-medium" style="direction: ltr;" id="sub-link">
                <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-slate-800">
                    <button onclick="editMainSub()" class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                    </button>
                    <button onclick="copyToClipboard(document.getElementById('sub-link').value)" class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700" title="Copy">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    </button>
                </div>
            </div>
            <p class="text-slate-400 text-xs" data-i18n="pubSubDesc">Use this link in your V2Ray client. It contains all active, TCP-pinged nodes.</p>
            <div class="mt-4 flex flex-wrap items-center gap-3">
                <button onclick="toggleQR(event, document.getElementById('sub-link').value, 'NodeX Subscription')" class="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M3 12h13"/><path d="m16 8 4 4-4 4"/><path d="M16 12H8"/></svg>
                    <span data-i18n="qrCode">QR Code</span>
                </button>
                <a href="#" id="btn-v2rayng" class="px-4 py-2 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">v2rayNG (Android)</a>
                <a href="#" id="btn-v2box" class="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">V2Box (iOS)</a>
                <a href="#" id="btn-shadowrocket" class="px-4 py-2 bg-purple-50 dark:bg-purple-500/10 hover:bg-purple-100 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors">Shadowrocket</a>
            </div>
        </div>

        <div class="ds-card space-y-4">
            <h2 class="text-lg font-semibold text-blue-500 dark:text-blue-400" data-i18n="addSubTitle">Add Sub</h2>
            <div class="flex flex-col sm:flex-row gap-3">
                <input type="text" id="new-sub-url" data-i18n-ph="addSubPlaceholder" placeholder="Paste your V2Ray Subscription URL here..." class="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary ltr-placeholder transition-all" style="direction: ltr;">
                <button onclick="addSub()" class="px-6 py-3 bg-primary hover:bg-blue-600 text-white rounded-xl font-medium text-sm transition-all shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:-translate-y-0.5 whitespace-nowrap" data-i18n="addBtn">Add & Test</button>
            </div>
            <p id="admin-msg" class="text-xs text-slate-400 mt-2"></p>
        </div>

        <div class="ds-card space-y-4 mb-6">
            <div class="flex flex-col gap-4">
                <div>
                    <h2 class="text-lg font-semibold text-emerald-500 dark:text-emerald-400" data-i18n="autoUpdateTitle">Auto-Update Timer</h2>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1" data-i18n="autoUpdateDesc">Nodes are tested and updated automatically in the background.</p>
                    <div class="mt-3 flex items-center gap-2">
                        <span class="text-xs text-slate-500 font-medium" data-i18n="intervalLabel">Interval:</span>
                        <div class="flex items-center bg-slate-100/80 dark:bg-zinc-800 p-1 rounded-lg border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
                            <button onclick="changeInterval(1)" id="int-btn-1" class="int-btn px-2.5 py-1 text-[11px] font-bold rounded-md transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">1H</button>
                            <button onclick="changeInterval(3)" id="int-btn-3" class="int-btn px-2.5 py-1 text-[11px] font-bold rounded-md transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">3H</button>
                            <button onclick="changeInterval(6)" id="int-btn-6" class="int-btn px-2.5 py-1 text-[11px] font-bold rounded-md transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">6H</button>
                            <button onclick="changeInterval(12)" id="int-btn-12" class="int-btn px-2.5 py-1 text-[11px] font-bold rounded-md transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">12H</button>
                            <button onclick="changeInterval(24)" id="int-btn-24" class="int-btn px-2.5 py-1 text-[11px] font-bold rounded-md transition-all text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">24H</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="ds-card space-y-4">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-lg font-semibold text-purple-500 dark:text-purple-400" data-i18n="manageSub">Manage Subscriptions</h2>
            </div>
            <div id="subs-container" class="overflow-x-auto">
                <p class="text-slate-400 text-sm" data-i18n="loading">Loading...</p>
            </div>
        </div>

        <div class="ds-card space-y-4">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 class="text-lg font-semibold" data-i18n="activeNodes">Active Nodes</h2>
                <button onclick="updateAll()" id="btn-update" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-0.5 whitespace-nowrap flex items-center justify-center gap-2">
                    <svg viewBox="64 64 896 896" width="15" height="15" fill="currentColor"><path d="M909.1 209.3l-56.4 44.1C775.8 155.1 656.2 92 521.9 92 290 92 102.3 279.5 102.3 511.5 102.3 743.7 290 931.2 521.9 931.2c222.1 0 404.2-171.7 418.5-391.2h-64c-14.2 184.2-168.1 327.2-354.5 327.2-196.2 0-355.6-159.4-355.6-355.6 0-196.2 159.4-355.6 355.6-355.6 110.1 0 208.9 50.1 274.6 128.5L471.2 463.3h384V79.3l-53.9 130z"/></svg>
                    <span data-i18n="updateAllBtn">Update & Ping All</span>
                </button>
            </div>
            <div id="nodes-container" class="flex flex-col border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#1a1a1a]">
                <p class="text-slate-400 p-4" data-i18n="loading">Loading...</p>
            </div>
            <div id="pagination-controls" class="flex justify-center items-center gap-2 mt-6 hidden"></div>
        </div>
    </div>
    <script>
        const i18n = {
            en: {
                title: "NodeX", pubSub: "Public Subscription Link", pubSubDesc: "Use this link in your V2Ray client. It contains all active, TCP-pinged nodes.", addSubTitle: "Add Sub", addSubPlaceholder: "Paste your V2Ray Subscription URL here...", addBtn: "Add & Test", manageSub: "Manage Subscriptions", updateAllBtn: "Update & Ping All", updatingBtn: "Updating in background...", urlHead: "URL", actionHead: "Action", testBtn: "Test", updateBtn: "Update", deleteBtn: "Delete", noSubs: "No subscriptions added yet.", activeNodes: "Active Nodes", loading: "Loading...", noNodes: "No active nodes found. Paste a subscription link above and click Add & Test.", prev: "Prev", next: "Next", pageOf: "Page {1} of {2}", copied: "Copied", confirmDelete: "Are you sure you want to delete this subscription? All its nodes will be removed.", errorLoading: "Error loading nodes: ", testingMsg: "⏳ Adding sub and testing nodes in the background...", successMsg: "✅ Success! Nodes are being pinged in the background. Refresh in a minute.", actionSuccess: "✅ Task started in background.", autoUpdateTitle: "Auto-Update Timer", autoUpdateDesc: "Nodes are tested and updated automatically in the background.", intervalLabel: "Interval:", int1: "1 Hour", int3: "3 Hours", int6: "6 Hours", int12: "12 Hours", int24: "24 Hours", qrCode: "QR Code"
            },
            fa: {
                title: "نود ایکس", pubSub: "لینک اشتراک عمومی", pubSubDesc: "از این لینک در برنامه V2Ray خود استفاده کنید. این لینک شامل تمامی کانفیگ‌های فعال است.", addSubTitle: "افزودن اشتراک", addSubPlaceholder: "لینک اشتراک V2Ray خود را اینجا پیست کنید...", addBtn: "افزودن و تست", manageSub: "مدیریت اشتراک‌ها", updateAllBtn: "تست و آپدیت همه", updatingBtn: "در حال آپدیت...", urlHead: "لینک", actionHead: "عملیات", testBtn: "پینگ", updateBtn: "آپدیت", deleteBtn: "حذف", noSubs: "هنوز اشتراکی اضافه نشده است.", activeNodes: "کانفیگ‌های فعال", loading: "در حال بارگذاری...", noNodes: "هیچ کانفیگ فعالی یافت نشد. لینک اشتراک خود را وارد کنید و روی دکمه افزودن کلیک کنید.", prev: "قبلی", next: "بعدی", pageOf: "صفحه {1} از {2}", copied: "کپی شد", confirmDelete: "آیا از حذف این اشتراک اطمینان دارید؟ تمام کانفیگ‌های آن حذف خواهند شد.", errorLoading: "خطا در بارگذاری: ", testingMsg: "⏳ در حال افزودن و تست کانفیگ‌ها در پس‌زمینه...", successMsg: "✅ با موفقیت اضافه شد. کانفیگ‌ها در حال پینگ گرفتن هستند. لطفاً یک دقیقه دیگر رفرش کنید.", actionSuccess: "✅ عملیات در پس‌زمینه شروع شد.", autoUpdateTitle: "تایمر آپدیت خودکار", autoUpdateDesc: "نودها به صورت خودکار در پس‌زمینه تست و آپدیت می‌شوند.", intervalLabel: "بازه زمانی:", int1: "۱ ساعت", int3: "۳ ساعت", int6: "۶ ساعت", int12: "۱۲ ساعت", int24: "۲۴ ساعت", qrCode: "کیو‌آر کد"
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

        const defaultSubUrl = window.location.origin + '/sub';
        let subLinkVal = localStorage.getItem('nodex_main_sub') || defaultSubUrl;
        
        function updateMainSubLinks(val) {
            document.getElementById('sub-link').value = val;
            document.getElementById('btn-v2rayng').href = 'v2rayng://install-config?url=' + encodeURIComponent(val);
            document.getElementById('btn-v2box').href = 'v2box://install-sub?url=' + encodeURIComponent(val) + '&name=NodeX';
            document.getElementById('btn-shadowrocket').href = 'shadowrocket://add/sub://' + btoa(val) + '?remark=NodeX';
        }

        function editMainSub() {
            const current = document.getElementById('sub-link').value;
            const newUrl = prompt('Enter custom subscription link (or leave blank to reset):', current);
            if (newUrl === null) return;
            if (newUrl.trim() === '') {
                localStorage.removeItem('nodex_main_sub');
                updateMainSubLinks(defaultSubUrl);
            } else {
                localStorage.setItem('nodex_main_sub', newUrl.trim());
                updateMainSubLinks(newUrl.trim());
            }
        }
        
        updateMainSubLinks(subLinkVal);

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
                container.innerHTML = \`<p class="text-slate-500 dark:text-slate-400 text-sm p-4 text-start" data-i18n="noNodes">\${i18n[currentLang].noNodes}</p>\`;
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
                const isPending = n.status === 'pending';
                const isGood = !isPending && n.ping_ms !== -1 && n.ping_ms < 500;
                
                let pingText = isPending ? 'Testing...' : n.ping_ms + ' ms';
                if (!isPending && n.ping_ms === -1) pingText = 'Error';
                
                const dotColor = isPending ? 'bg-slate-400 animate-pulse' : (isGood ? 'bg-emerald-500' : 'bg-amber-500');
                
                let extraTags = '';
                try {
                    if (n.raw_uri && n.raw_uri.includes('://')) {
                        const urlObj = new URL('http://' + n.raw_uri.split('://')[1]);
                        const type = urlObj.searchParams.get('type');
                        const sec = urlObj.searchParams.get('security');
                        if (type) extraTags += \`<span class="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] rounded uppercase font-bold tracking-wider">\${type}</span>\`;
                        if (sec && sec !== 'none') extraTags += \`<span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] rounded uppercase font-bold tracking-wider">\${sec}</span>\`;
                    }
                } catch(e) {}

                container.innerHTML += \`
                    <div class="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors" style="direction: ltr;">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <span style="display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;">
                                <span class="px-2 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 text-[10px] rounded uppercase font-bold tracking-wider">\${n.protocol}</span>
                                \${extraTags}
                                <span class="px-2 py-0.5 bg-slate-500/10 text-slate-500 dark:text-slate-400 text-[10px] rounded uppercase font-bold tracking-wider flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full \${dotColor} shadow-[0_0_8px_currentColor]"></div>\${pingText}</span>
                            </span>
                            <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title="\${n.name}">\${n.name}</span>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0 ml-4">
                            <button aria-label="Copy" title="Copy" type="button" onclick="copyToClipboard('\${n.raw_uri}')" class="flex items-center justify-center w-7 h-7 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                                <span role="img" aria-label="copy" class="anticon anticon-copy"><svg viewBox="64 64 896 896" width="14" height="14" fill="currentColor"><path d="M832 64H296c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8h496v688c0 4.4 3.6 8 8 8h56c4.4 0 8-3.6 8-8V96c0-17.7-14.3-32-32-32zM704 192H192c-17.7 0-32 14.3-32 32v530.7c0 8.5 3.4 16.6 9.4 22.6l173.3 173.3c2.2 2.2 4.7 4 7.4 5.5v1.9h4.2c3.5 1.3 7.2 2 11 2H704c17.7 0 32-14.3 32-32V224c0-17.7-14.3-32-32-32zM350 856.2L263.9 770H350v86.2zM664 888H414V746c0-22.1-17.9-40-40-40H232V264h432v624z"></path></svg></span>
                            </button>
                            <button aria-label="QR" title="QR" type="button" onclick="toggleQR(event, '\${n.raw_uri}', '\${n.name.replace(/'/g, "\\'")}')" class="flex items-center justify-center w-7 h-7 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors">
                                <span role="img" aria-label="qrcode" class="anticon anticon-qrcode"><svg viewBox="64 64 896 896" width="14" height="14" fill="currentColor"><path d="M468 128H160c-17.7 0-32 14.3-32 32v308c0 4.4 3.6 8 8 8h332c4.4 0 8-3.6 8-8V136c0-4.4-3.6-8-8-8zm-56 284H192V192h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm194 210H136c-4.4 0-8 3.6-8 8v308c0 17.7 14.3 32 32 32h308c4.4 0 8-3.6 8-8V556c0-4.4-3.6-8-8-8zm-56 284H192V612h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm590-630H556c-4.4 0-8 3.6-8 8v332c0 4.4 3.6 8 8 8h332c4.4 0 8-3.6 8-8V160c0-17.7-14.3-32-32-32zm-32 284H612V192h220v220zm-138-74h56c4.4 0 8-3.6 8-8v-56c0-4.4-3.6-8-8-8h-56c-4.4 0-8 3.6-8 8v56c0 4.4 3.6 8 8 8zm194 210h-48c-4.4 0-8 3.6-8 8v134h-78V556c0-4.4-3.6-8-8-8H556c-4.4 0-8 3.6-8 8v332c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V644h78v102c0 4.4 3.6 8 8 8h190c4.4 0 8-3.6 8-8V556c0-4.4-3.6-8-8-8zM746 832h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8zm142 0h-48c-4.4 0-8 3.6-8 8v48c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8v-48c0-4.4-3.6-8-8-8z"></path></svg></span>
                            </button>
                        </div>
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
                container.innerHTML = \`<p class="text-slate-500 dark:text-slate-400 text-sm p-4 text-start" data-i18n="noSubs">\${i18n[currentLang].noSubs}</p>\`;
                return;
            }
            let html = \`<table class="w-full text-sm text-slate-600 dark:text-slate-300 text-\${currentLang === 'fa' ? 'right' : 'left'}" dir="ltr"><thead><tr class="ds-row"><th class="pb-3 text-left ds-table-head px-2">\${i18n[currentLang].urlHead}</th><th class="pb-3 text-right ds-table-head px-2">\${i18n[currentLang].actionHead}</th></tr></thead><tbody>\`;
            allSubs.forEach(s => {
                html += \`<tr class="ds-row hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td class="py-4 px-2 truncate max-w-[200px] sm:max-w-[150px] text-left font-medium text-slate-700 dark:text-slate-200" style="direction: ltr;" title="\${s.url}">\${s.url}</td>
                    <td class="py-4 px-2">
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="copyToClipboard('\${s.url}')" class="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors text-xs font-semibold">Copy</button>
                            <button onclick="editSub(\${s.id}, '\${s.url}')" class="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg transition-colors text-xs font-semibold">Edit</button>
                            <button onclick="updateSub(\${s.id})" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg transition-colors text-xs font-semibold">\${i18n[currentLang].updateBtn}</button>
                            <button onclick="testSub(\${s.id})" class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors text-xs font-semibold">\${i18n[currentLang].testBtn}</button>
                            <button onclick="deleteSub(\${s.id})" class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors text-xs font-semibold">\${i18n[currentLang].deleteBtn}</button>
                        </div>
                    </td>
                </tr>\`;
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }

        function editSub(id, oldUrl) {
            const newUrl = prompt('Enter new subscription URL:', oldUrl);
            if (!newUrl || newUrl === oldUrl) return;
            fetch('/api/admin/subs/' + id, { 
                method: 'PUT',
                body: JSON.stringify({ url: newUrl }),
                headers: { 'Content-Type': 'application/json' }
            }).then(() => loadSubs());
        }
        
        function updateSub(id) {
            const msg = document.getElementById('admin-msg');
            msg.innerHTML = \`<span class="text-emerald-500 font-medium">\${i18n[currentLang].actionSuccess}</span>\`;
            fetch('/api/admin/subs/' + id + '/update', { method: 'POST' })
                .then(() => setTimeout(loadConfigs, 2000));
        }

        function testSub(id) {
            const msg = document.getElementById('admin-msg');
            msg.innerHTML = \`<span class="text-blue-500 font-medium">\${i18n[currentLang].actionSuccess}</span>\`;
            fetch('/api/admin/subs/' + id + '/test', { method: 'POST' })
                .then(() => setTimeout(loadConfigs, 5000));
        }
        
        function deleteSub(id) {
            if(!confirm(i18n[currentLang].confirmDelete)) return;
            fetch('/api/admin/subs/' + id, { method: 'DELETE' })
                .then(() => {
                    loadSubs();
                    loadConfigs();
                });
        }

        function updateIntervalUI(val) {
            document.querySelectorAll('.int-btn').forEach(btn => {
                btn.classList.remove('bg-white', 'dark:bg-zinc-600', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                btn.classList.add('text-slate-500', 'dark:text-slate-400');
            });
            const activeBtn = document.getElementById('int-btn-' + val);
            if(activeBtn) {
                activeBtn.classList.add('bg-white', 'dark:bg-zinc-600', 'shadow-sm', 'text-slate-900', 'dark:text-white');
                activeBtn.classList.remove('text-slate-500', 'dark:text-slate-400');
            }
        }

        function changeInterval(val) {
            updateIntervalUI(val);
            fetch('/api/admin/settings', {
                method: 'POST',
                body: JSON.stringify({ interval: parseInt(val) }),
                headers: { 'Content-Type': 'application/json' }
            });
        }

        fetch('/api/admin/settings').then(r => r.json()).then(data => {
            if (data.interval) {
                updateIntervalUI(data.interval);
            }
        });

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

        function toggleQR(event, text, title = 'NodeX Sub') {
            event.stopPropagation();
            const popover = document.getElementById('qr-popover');
            const img = document.getElementById('qr-image');
            const tagName = document.getElementById('qr-tag-name');
            if (tagName) tagName.innerText = title;

            if (!popover.classList.contains('opacity-0') && img.src.includes(encodeURIComponent(text))) {
                closeQR();
                return;
            }
            img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=' + encodeURIComponent(text);
            const rect = event.currentTarget.getBoundingClientRect();
            
            const popoverWidth = 240;
            // Place to the left of the button
            let left = rect.left + window.scrollX - popoverWidth - 12;
            let top = rect.top + window.scrollY - 100;

            if (left < 10) {
                // If it doesn't fit on the left, place it on the right
                left = rect.right + 12;
            }
            if (left + popoverWidth > window.innerWidth + window.scrollX - 10) {
                left = window.innerWidth + window.scrollX - popoverWidth - 10;
            }
            
            popover.style.left = left + 'px';
            popover.style.top = top + 'px';

            const arrow = document.getElementById('qr-arrow');
            if (arrow) {
                // Move arrow to the left or right side depending on where popover is
                arrow.className = 'absolute w-[11px] h-[11px] rotate-45 bg-white dark:bg-[#1a1a1a] border-slate-200 dark:border-slate-800 z-20 transition-all duration-200';
                if (left > rect.right - 100) { // If it's placed on the right
                    arrow.classList.add('-left-[6px]', 'top-[115px]', 'border-l', 'border-b');
                } else {
                    // Popover is on the left
                    arrow.classList.add('-right-[6px]', 'top-[115px]', 'border-r', 'border-t');
                }
            }

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
    "SELECT raw_uri FROM configs WHERE status IN ('active', 'pending') AND fail_count < 3 GROUP BY host, port, protocol ORDER BY CASE WHEN status='pending' THEN 99999 ELSE ping_ms END ASC"
  ).all<{ raw_uri: string }>();

  const uris = results.map(r => r.raw_uri).join('\n');
  return c.text(encodeBase64Utf8(uris));
});

// Get Active Configs (JSON)
app.get('/api/configs', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT name, protocol, ping_ms, raw_uri, last_tested_at, status FROM configs WHERE status IN ('active', 'pending') AND fail_count < 3 GROUP BY host, port, protocol ORDER BY CASE WHEN status='pending' THEN 99999 ELSE ping_ms END ASC"
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

// Admin Edit Sub
app.put('/api/admin/subs/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  try {
    await c.env.DB.prepare("UPDATE subscriptions SET url = ? WHERE id = ?").bind(body.url, id).run();
    return c.json({ success: true });
  } catch (e) {
    return c.json({ error: 'Failed to update' }, 500);
  }
});

// Admin Get Settings
app.get('/api/admin/settings', async (c) => {
  try {
    await c.env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").run();
    const res = await c.env.DB.prepare("SELECT value FROM settings WHERE key='update_interval'").first<{value: string}>();
    return c.json({ interval: res ? parseInt(res.value) : 1 });
  } catch(e) { 
    return c.json({ interval: 1 }); 
  }
});

// Admin Set Settings
app.post('/api/admin/settings', async (c) => {
  const { interval } = await c.req.json();
  try {
    await c.env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").run();
    await c.env.DB.prepare("INSERT INTO settings (key, value) VALUES ('update_interval', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(interval.toString()).run();
    return c.json({ success: true });
  } catch(e) { 
    return c.json({ success: false }); 
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

    // Trigger update and ping for everything to include the new sub automatically
    c.executionCtx.waitUntil(runUpdateTask(c.env));

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// Trigger Update & Ping Task (Manual)
app.post('/api/admin/update', async (c) => {
  try {
    const { results: subs } = await c.env.DB.prepare("SELECT * FROM subscriptions").all<{ id: number, url: string }>();
    let newOrResetCount = 0;

    for (const sub of subs) {
      const resp = await fetch(sub.url, { headers: { 'User-Agent': 'NodeX/1.0' } });
      if (!resp.ok) {
        throw new Error(`Failed to fetch ${sub.url}: ${resp.status} ${resp.statusText}`);
      }
      const text = await resp.text();
      let uris = parseSubscription(text);
      uris = uris.sort(() => Math.random() - 0.5);
      uris = uris.slice(0, 8000);

      const insertStmts = [];
      for (const uri of uris) {
        const parsed = parseURI(uri);
        if (parsed && parsed.host) {
          insertStmts.push(c.env.DB.prepare(`
            INSERT INTO configs (sub_id, name, raw_uri, protocol, host, port)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(raw_uri) DO UPDATE SET 
              name=excluded.name, 
              host=excluded.host, 
              port=excluded.port,
              status = CASE WHEN configs.status = 'error' THEN 'pending' ELSE configs.status END,
              fail_count = CASE WHEN configs.status = 'error' THEN 0 ELSE configs.fail_count END
          `).bind(sub.id, parsed.name, parsed.raw_uri, parsed.protocol, parsed.host, parsed.port));
        }
      }
      for (let i = 0; i < insertStmts.length; i += 100) {
        await c.env.DB.batch(insertStmts.slice(i, i + 100));
      }
      newOrResetCount += insertStmts.length;
    }

    // Trigger the ping phase in background
    c.executionCtx.waitUntil((async () => {
      try {
        const { results: configs } = await c.env.DB.prepare("SELECT id, host, port FROM configs ORDER BY ifnull(last_tested_at, '1970-01-01') ASC LIMIT 4000").all<{ id: number, host: string, port: number }>();
        const batchSize = 200;
        for (let i = 0; i < configs.length; i += batchSize) {
          const batch = configs.slice(i, i + batchSize);
          const batchResults = await Promise.all(batch.map(async (cfg) => {
            if (!cfg.host || !cfg.port) return { id: cfg.id, ping: -1 };
            const ping = await tcpPing(cfg.host, cfg.port);
            return { id: cfg.id, ping };
          }));
          const stmts = [];
          for (const p of batchResults) {
            if (p.ping !== -1) {
              stmts.push(c.env.DB.prepare("UPDATE configs SET status='active', ping_ms=?, fail_count=0, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.ping, p.id));
            } else {
              stmts.push(c.env.DB.prepare("UPDATE configs SET status='error', fail_count=fail_count+1, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.id));
            }
          }
          for (let j = 0; j < stmts.length; j += 100) await c.env.DB.batch(stmts.slice(j, j + 100));
        }
      } catch(e) { console.error(e); }
    })());

    return c.json({ success: true, message: `Loaded ${newOrResetCount} configs. Testing in background...` });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/admin/subs/:id/update', async (c) => {
  const subId = c.req.param('id');
  c.executionCtx.waitUntil((async () => {
    try {
      const sub = await c.env.DB.prepare("SELECT * FROM subscriptions WHERE id = ?").bind(subId).first<{ id: number, url: string }>();
      if (!sub) return;
      const resp = await fetch(sub.url);
      const text = await resp.text();
      let uris = parseSubscription(text);
      // Shuffle to get a random sample of all protocols instead of just the top ones
      uris = uris.sort(() => Math.random() - 0.5);
      uris = uris.slice(0, 8000); // Limit to prevent D1 overload
      for (const uri of uris) {
        const parsed = parseURI(uri);
        if (parsed && parsed.host) {
          await c.env.DB.prepare(`
              INSERT INTO configs (sub_id, name, raw_uri, protocol, host, port)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(raw_uri) DO UPDATE SET 
                name=excluded.name, 
                host=excluded.host, 
                port=excluded.port,
                status = CASE WHEN configs.status = 'error' THEN 'pending' ELSE configs.status END,
                fail_count = CASE WHEN configs.status = 'error' THEN 0 ELSE configs.fail_count END
          `).bind(sub.id, parsed.name, parsed.raw_uri, parsed.protocol, parsed.host, parsed.port).run();
        }
      }
    } catch (e) {
      console.error(`Failed to update sub ${subId}`, e);
    }
  })());
  return c.json({ success: true });
});

app.post('/api/admin/subs/:id/test', async (c) => {
  const subId = c.req.param('id');
  c.executionCtx.waitUntil((async () => {
    try {
      const { results: configs } = await c.env.DB.prepare("SELECT id, host, port FROM configs WHERE sub_id = ?").bind(subId).all<{ id: number, host: string, port: number }>();
      const batchSize = 50;
      for (let i = 0; i < configs.length; i += batchSize) {
        const batch = configs.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (cfg) => {
          if (!cfg.host || !cfg.port) return { id: cfg.id, ping: -1 };
          const ping = await tcpPing(cfg.host, cfg.port);
          return { id: cfg.id, ping };
        }));
        
        const stmts = [];
        for (const p of batchResults) {
          if (p.ping !== -1) {
            stmts.push(c.env.DB.prepare("UPDATE configs SET status='active', ping_ms=?, fail_count=0, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.ping, p.id));
          } else {
            stmts.push(c.env.DB.prepare("UPDATE configs SET status='error', fail_count=fail_count+1, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.id));
          }
        }
        for (let j = 0; j < stmts.length; j += 100) {
          await c.env.DB.batch(stmts.slice(j, j + 100));
        }
      }
    } catch (e) {
      console.error(`Failed to test sub ${subId}`, e);
    }
  })());
  return c.json({ success: true });
});

async function runUpdateTask(env: Env) {
  try {
    const { results: subs } = await env.DB.prepare("SELECT * FROM subscriptions").all<{ id: number, url: string }>();

    for (const sub of subs) {
      try {
        const resp = await fetch(sub.url);
        const text = await resp.text();
        let uris = parseSubscription(text);
        // Shuffle to get a random sample of all protocols
        uris = uris.sort(() => Math.random() - 0.5);
        uris = uris.slice(0, 8000); // Limit to prevent D1 overload

        const insertStmts = [];
        for (const uri of uris) {
          const parsed = parseURI(uri);
          if (parsed && parsed.host) {
            insertStmts.push(env.DB.prepare(`
              INSERT INTO configs (sub_id, name, raw_uri, protocol, host, port)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(raw_uri) DO UPDATE SET 
                name=excluded.name, 
                host=excluded.host, 
                port=excluded.port,
                status = CASE WHEN configs.status = 'error' THEN 'pending' ELSE configs.status END,
                fail_count = CASE WHEN configs.status = 'error' THEN 0 ELSE configs.fail_count END
            `).bind(sub.id, parsed.name, parsed.raw_uri, parsed.protocol, parsed.host, parsed.port));
          }
        }
        for (let i = 0; i < insertStmts.length; i += 100) {
          await env.DB.batch(insertStmts.slice(i, i + 100));
        }
      } catch (e) {
        console.error(`Failed to fetch sub ${sub.url}`, e);
      }
    }

    // Ping test
    const { results: configs } = await env.DB.prepare("SELECT id, host, port FROM configs ORDER BY ifnull(last_tested_at, '1970-01-01') ASC LIMIT 4000").all<{ id: number, host: string, port: number }>();
    
    // Batch pinging to prevent connection/memory limits
    const batchSize = 200;
    for (let i = 0; i < configs.length; i += batchSize) {
      const batch = configs.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(async (cfg) => {
        if (!cfg.host || !cfg.port) return { id: cfg.id, ping: -1 };
        const ping = await tcpPing(cfg.host, cfg.port);
        return { id: cfg.id, ping };
      }));
      
      const stmts = [];
      for (const p of batchResults) {
        if (p.ping !== -1) {
          stmts.push(env.DB.prepare("UPDATE configs SET status='active', ping_ms=?, fail_count=0, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.ping, p.id));
        } else {
          stmts.push(env.DB.prepare("UPDATE configs SET status='error', fail_count=fail_count+1, last_tested_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.id));
        }
      }

      for (let j = 0; j < stmts.length; j += 100) {
        await env.DB.batch(stmts.slice(j, j + 100));
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
    try {
      await env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)").run();
      const setting = await env.DB.prepare("SELECT value FROM settings WHERE key='update_interval'").first<{value: string}>();
      const intervalHours = setting ? parseInt(setting.value) : 1;
      
      const lastRunSetting = await env.DB.prepare("SELECT value FROM settings WHERE key='last_run'").first<{value: string}>();
      const lastRun = lastRunSetting ? parseInt(lastRunSetting.value) : 0;
      const now = Date.now();
      
      // Allow running if time passed is close to the interval (minus 2 minutes for cron variability)
      if (now - lastRun >= intervalHours * 60 * 60 * 1000 - 120000) {
         await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('last_run', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(now.toString()).run();
         ctx.waitUntil(runUpdateTask(env));
      }
    } catch(e) {
      // Fallback if settings table logic fails
      ctx.waitUntil(runUpdateTask(env));
    }
  }
};
