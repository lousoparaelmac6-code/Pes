import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { build } from "esbuild";
import { patchPesHtml } from "./patch-pes-app.mjs";
const root=process.cwd();
await import('./generate-icons.mjs');
const sourceHtml=path.join(root,"GyJ_PES_PLANTELES_V3_CORREGIDO (2) (1).html");
const sourceJson=path.join(root,"GyJ_PES_Historial_Backup_2026-10-20.json");
const dist=path.join(root,"dist");
const version=process.env.PES_VERSION||"1.0.0";
function validateInlineScripts(html) {
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = match[1] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i);
    const type = (typeMatch && typeMatch[1] || "text/javascript").toLowerCase();
    if (type === "module" || !/^(?:text|application)\/(?:java|ecma)script$/.test(type)) continue;
    const code = (match[2] || "").trim();
    if (!code) continue;
    try { new vm.Script(code, { filename: "PES-inline-script-" + (++count) + ".js" }); }
    catch (error) { throw new Error("Error de sintaxis en JavaScript incrustado (" + count + "): " + error.message); }
  }
  return count;
}

const packagePath=path.join(root,"package.json");
const packageJson=JSON.parse(await fs.readFile(packagePath,"utf8"));
packageJson.version=version;
await fs.writeFile(packagePath,JSON.stringify(packageJson,null,2)+"\n","utf8");
await fs.access(sourceHtml); await fs.access(sourceJson);
await fs.rm(dist,{recursive:true,force:true}); await fs.mkdir(dist,{recursive:true});
await fs.copyFile(path.join(root,"assets","generated","pes-icon.png"),path.join(dist,"pes-icon.png"));
let html=await fs.readFile(sourceHtml,"utf8");
if(!/<link[^>]+rel=["']icon["']/i.test(html)) html=html.replace(/<head\b[^>]*>/i,match=>match+'\n<link rel="icon" type="image/png" href="./pes-icon.png">');
html=patchPesHtml(html);
const cdnTag=/<script\s+id=["']gyj-supabase-sdk["']\s+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2["']><\/script>/i;
if(!cdnTag.test(html)) throw new Error("No se encontró el script Supabase esperado; se detiene el build.");
html=html.replace(cdnTag,'<script id="gyj-supabase-sdk" src="./supabase.bundle.js"></script>');
// Force a proper mobile viewport even if the original legacy HTML omitted it.
if (/<meta\s+name=["']viewport["']/i.test(html)) {
  html = html.replace(/<meta\s+name=["']viewport["'][^>]*>/i, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
} else {
  html = html.replace(/<head\b[^>]*>/i, match => match + '\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
}
// Responsive app-wide layer: preserve the existing visual design while preventing
// desktop-sized overflow and making controls comfortable on Android touch screens.
const responsiveCss = [
'<style id="pes-responsive-layout">',
'*,*::before,*::after{box-sizing:border-box}',
// Keep modal dialogs above the fixed mobile navigation and make their form actions reachable.
'#modal,#modalOverlay,#modalBackdrop,#modalWrap,#modalContainer,.modal,.modal-overlay,.modal-backdrop,[role="dialog"],dialog{z-index:2147483500!important}',
'#modalBox{box-sizing:border-box;max-height:calc(100dvh - 32px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}',
'#modalBox .actions,#modal .actions,#modalOverlay .actions,#modalWrap .actions,.modal .actions,.modal-overlay .actions,[role="dialog"] .actions{position:sticky;bottom:0;z-index:3;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;padding:12px 0 calc(10px + env(safe-area-inset-bottom,0px));background:var(--panel,#111923);border-top:1px solid var(--line,#344251)}',
'#modalBox .actions button,#modal .actions button,#modalOverlay .actions button,#modalWrap .actions button,.modal .actions button,.modal-overlay .actions button,[role="dialog"] .actions button{flex:0 1 auto;min-width:96px;max-width:100%;white-space:normal;overflow-wrap:anywhere}',
'#modalBox input,#modalBox select,#modalBox textarea{min-width:0;max-width:100%}',
'html{width:100%;min-width:0;min-height:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%}',
'body{width:100%;min-width:0;max-width:100%;min-height:100dvh;margin:0;overflow-x:hidden}',
'img,svg,video,canvas,iframe{max-width:100%;height:auto}',
'input,select,textarea,button{max-width:100%;font:inherit}',
'@media(max-width:720px){',
'html,body{width:100%;min-width:0;min-height:100%;overflow-x:hidden}',
'body{padding-left:max(0px,env(safe-area-inset-left));padding-right:max(0px,env(safe-area-inset-right));padding-top:max(12px,env(safe-area-inset-top,0px));padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))}',
'header,.header,.topbar,.app-header{max-width:100%;padding-top:max(8px,env(safe-area-inset-top,0px))}',
'.nav{bottom:env(safe-area-inset-bottom,0px)!important;padding-bottom:6px!important;min-height:60px!important;max-height:66px!important}',
'.main,.content,.page-content{scroll-margin-top:calc(12px + env(safe-area-inset-top,0px));scroll-padding-bottom:calc(90px + env(safe-area-inset-bottom,0px))}',
'#root,#app,main,.app,.app-container,.container,.content,.main-content,.page,.page-content{min-width:0!important;max-width:100%!important}',
'img,svg,video,canvas{max-width:100%}',
'input,select,textarea{min-width:0!important;width:100%;font-size:16px!important}',
'button,[role="button"],input[type="button"],input[type="submit"]{min-height:44px;touch-action:manipulation}',
'button{white-space:normal;overflow-wrap:anywhere}',
'table{max-width:100%;display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}',
'pre,code{max-width:100%;overflow-wrap:anywhere;white-space:pre-wrap}',
'.row,.flex,.toolbar,.actions,.button-row{flex-wrap:wrap;min-width:0}',
'[style*="min-width"]{min-width:0!important}',
'[style*="width: 1000"],[style*="width:1000"]{max-width:100%!important}',
'}',
'@media(max-width:420px){body{font-size:15px}h1{font-size:clamp(1.25rem,6vw,1.8rem)}h2{font-size:clamp(1.1rem,5vw,1.5rem)}.nav button[data-nav-id]{font-size:11px!important;line-height:1.1!important;padding:5px 2px!important}.nav button.mobile-nav-more{font-size:11px!important;padding:5px 2px!important}header h1,.header h1,.topbar h1{max-width:calc(100vw - 90px);overflow-wrap:anywhere}}',
'@media(min-width:721px){.app{width:100%;min-width:0}.main{flex:1 1 0%;min-width:0;width:auto;max-width:none;overflow-x:hidden}.section,.panel,.toolbar,.grid2,.grid3,.cards{min-width:0;max-width:100%}}',
'@media(max-width:720px){.nav{max-height:66px!important;flex-wrap:nowrap!important}.nav button[data-nav-id]:not([data-nav-id="dashboard"]):not([data-nav-id="calendar"]):not([data-nav-id="players"]):not([data-nav-id="palmares"]){display:none!important}.nav button[data-nav-id]{flex:1 0 0!important;min-width:0!important;max-width:20%!important;white-space:normal!important;overflow-wrap:anywhere!important}.nav button.mobile-nav-more{display:block!important;min-width:56px!important;max-width:64px!important}#awardEditTable .table{min-width:0!important;width:100%!important;display:block!important}#awardEditTable .table thead{display:none!important}#awardEditTable .table tbody{display:grid!important;gap:9px!important}#awardEditTable .table tr{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;gap:4px 8px!important;padding:8px!important;border:1px solid var(--line)!important;border-radius:12px!important}#awardEditTable .table td{white-space:normal!important;overflow-wrap:anywhere!important;padding:6px 4px!important}#awardEditTable .table td:first-child,#awardEditTable .table td:last-child{grid-column:1/-1!important;position:static!important;box-shadow:none!important}}',
'</style>'
].join('\n');
if (!/<meta\s+name=["']viewport["']/i.test(html)) throw new Error("No se pudo configurar el viewport móvil.");
if (!html.includes('id="pes-responsive-layout"')) {
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, responsiveCss + '\n</head>');
  else html = responsiveCss + html;
}

const designSystemCss = "<style id=\"pes-design-system-v1\">\n:root{color-scheme:dark;--night1:#0d1522;--panel:#141e2d;--panel2:#1a293d;--line:#2b3b51;--text:#e8edf5;--muted:#a4b1c2;--accent:#8ab4f8;--accent-strong:#467fc9;--focus:#a8cbff;--radius-sm:7px;--radius-md:11px;--radius-lg:15px;--shadow-soft:0 8px 24px rgb(0 0 0 / .14)}\nhtml{font-family:\"Segoe UI\",Inter,Roboto,system-ui,-apple-system,sans-serif}\nbody{font-size:14px;line-height:1.48;color:var(--text,#e8edf5);background-color:var(--night1,#0d1522);font-weight:400;letter-spacing:0}\nh1,h2,h3,h4{line-height:1.25;letter-spacing:-.018em;text-wrap:pretty}h1{font-size:clamp(1.45rem,2.1vw,1.85rem);font-weight:720;margin-block:.25em .65em}h2{font-size:1.12rem;font-weight:680;margin-block:.2em .65em}h3{font-size:.98rem;font-weight:650}\np{line-height:1.5}small,.muted,.hint,.subtle{color:var(--muted,#a4b1c2)}\n.main{padding:clamp(14px,1.8vw,24px);min-width:0}.panel{padding:clamp(13px,1.35vw,18px);border:1px solid var(--line,#2b3b51);border-radius:var(--radius-md,11px);background:var(--panel,#141e2d);box-shadow:0 2px 8px rgb(0 0 0 / .08);min-width:0}.panel+.panel{margin-top:12px}\n.grid2,.grid3,.cards{gap:12px}.row,.toolbar,.actions,.button-row{gap:8px}\nbutton,input[type=button],input[type=submit],input[type=reset]{font-family:inherit;font-size:13px;font-weight:600;line-height:1.25;letter-spacing:0;border-radius:var(--radius-sm,7px);transition:background-color .14s ease,border-color .14s ease,box-shadow .14s ease}\nbutton:hover,input[type=button]:hover,input[type=submit]:hover,input[type=reset]:hover{filter:brightness(1.07)}button:active,input[type=button]:active,input[type=submit]:active,input[type=reset]:active{transform:translateY(1px)}button:disabled,input:disabled,select:disabled,textarea:disabled{opacity:.58;cursor:not-allowed}\n:where(button,a,input,select,textarea,[tabindex]):focus-visible{outline:2px solid var(--focus,#a8cbff);outline-offset:2px}\ninput,select,textarea{font-family:inherit;font-size:14px;line-height:1.4;border-radius:var(--radius-sm,7px);border-color:var(--line,#2b3b51);background-color:var(--panel2,#1a293d);color:var(--text,#e8edf5)}input,select{min-height:38px}textarea{min-height:84px;resize:vertical}label{font-size:13px;font-weight:600;color:var(--text,#e8edf5)}\ntable{border-collapse:separate;border-spacing:0;font-size:13px}th{font-size:11px;font-weight:700;letter-spacing:.035em;text-transform:uppercase;color:var(--muted,#a4b1c2)}td,th{padding:9px 10px}hr{border:0;border-top:1px solid var(--line,#2b3b51);margin:14px 0}\n.nav{background:var(--night1,#0d1522);border-color:var(--line,#2b3b51)}.nav button{font-size:12px;font-weight:600;border-radius:8px}.nav button.active,.nav button[aria-current=page],.nav button[aria-selected=true]{background:var(--panel2,#1a293d);color:var(--accent,#8ab4f8);border-color:var(--line,#2b3b51)}\n#palmares .panel,#players .panel,#estadisticas .panel,#stats .panel{box-shadow:none}#palmares .award-summary-row{border-color:var(--line,#2b3b51);border-radius:var(--radius-md,11px);background:var(--panel2,#1a293d)}#palmares .award-summary-head button{font-size:12px}\nimg,svg{vertical-align:middle}a{color:var(--accent,#8ab4f8);text-underline-offset:3px}\n@media(min-width:721px){.main{padding:22px clamp(18px,2vw,30px)}.panel{padding:16px}.grid2,.grid3,.cards{gap:14px}}\n@media(max-width:720px){body{font-size:14px}.main{padding:12px 10px calc(88px + env(safe-area-inset-bottom,0px))}h1{font-size:clamp(1.35rem,5.4vw,1.7rem);margin-bottom:.55em}h2{font-size:1.08rem}.panel{padding:12px;border-radius:10px;box-shadow:none}.panel+.panel{margin-top:10px}.grid2,.grid3,.cards{gap:10px}button,input[type=button],input[type=submit],input[type=reset]{font-size:13px}input,select,textarea{font-size:16px}}\n@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}\n\nheader h1,.header h1,.topbar h1,.app-header h1{font-size:clamp(1.25rem,1.8vw,1.65rem);font-weight:700}\n.logo,.app-logo,.brand-logo,#appLogo,#app-logo{max-width:40px;max-height:40px;object-fit:contain;flex-shrink:0}\n#modalBox,[role=dialog],dialog,.modal{border:1px solid var(--line,#2b3b51);border-radius:var(--radius-lg,15px);background:var(--panel,#141e2d);color:var(--text,#e8edf5);box-shadow:0 18px 48px rgb(0 0 0 / .32)}\n#modalBox h2,[role=dialog] h2,dialog h2,.modal h2{font-size:1.08rem}\n#modalBox input,#modalBox select,#modalBox textarea,[role=dialog] input,[role=dialog] select,[role=dialog] textarea{max-width:100%;min-width:0}\n.table thead th,table thead th{border-bottom:1px solid var(--line,#2b3b51)}\n.table tbody tr:hover td,table tbody tr:hover td{background-color:rgb(138 180 248 / .045)}\n.table td,table td{vertical-align:middle}\n.stat-card,.metric-card,.summary-card,.stat,.metric{min-width:0;overflow-wrap:anywhere}\n.badge,.tag,.pill{font-size:11px;font-weight:650;line-height:1.25;border-radius:999px;padding:3px 8px}\n.empty-state,.empty,.empty-state p{color:var(--muted,#a4b1c2)}\nbutton svg,button .icon{width:16px;height:16px;flex:0 0 auto}\nbutton{overflow-wrap:anywhere}\n@media(min-width:721px){.main{max-width:1600px;margin-inline:auto}.nav{flex-shrink:0}}\n@media(max-width:720px){header h1,.header h1,.topbar h1,.app-header h1{font-size:1.25rem}.logo,.app-logo,.brand-logo,#appLogo,#app-logo{max-width:34px;max-height:34px}#modalBox,[role=dialog],dialog,.modal{border-radius:12px;max-width:calc(100vw - 20px)}.table td,table td{padding:8px 7px}}\n\n</style>";
if(!/<\/head>/i.test(html)) throw new Error("No se encontró </head> para insertar el sistema visual.");
if(!html.includes('id="pes-design-system-v1"')) html=html.replace(/<\/head>/i,designSystemCss+"\n</head>");
if(!html.includes('id="pes-design-system-v1"')) throw new Error("El sistema visual de PES no quedó integrado en el HTML.");
html+="\n<script>window.PES_APP_VERSION="+JSON.stringify(version)+";</script>\n<script src=\"./pes-updater-bridge.js\"></script>\n<script src=\"./pes-updater.js\"></script>\n";
const inlineScriptCount=validateInlineScripts(html);
new vm.Script(await fs.readFile(path.join(root,"scripts","pes-updater.js"),"utf8"), { filename: "scripts/pes-updater.js" });
console.log("Validated inline JavaScript blocks:",inlineScriptCount);
await fs.writeFile(path.join(dist,"index.html"),html,"utf8");
await fs.copyFile(sourceJson,path.join(dist,path.basename(sourceJson)));
await fs.copyFile(path.join(root,"scripts","pes-updater.js"),path.join(dist,"pes-updater.js"));
await build({entryPoints:["scripts/pes-updater-bridge.js"],bundle:true,platform:"browser",format:"iife",target:["es2020"],outfile:path.join(dist,"pes-updater-bridge.js"),logLevel:"info"});
await build({entryPoints:["node_modules/@supabase/supabase-js/dist/module/index.js"],bundle:true,platform:"browser",format:"iife",globalName:"supabase",target:["es2020"],outfile:path.join(dist,"supabase.bundle.js"),logLevel:"info"});
console.log("PES web bundle ready:",dist,"version",version);
