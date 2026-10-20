import fs from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
const root=process.cwd();
const sourceHtml=path.join(root,"GyJ_PES_PLANTELES_V3_CORREGIDO (2) (1).html");
const sourceJson=path.join(root,"GyJ_PES_Historial_Backup_2026-10-20.json");
const dist=path.join(root,"dist");
const version=process.env.PES_VERSION||"1.0.0";
const packagePath=path.join(root,"package.json");
const packageJson=JSON.parse(await fs.readFile(packagePath,"utf8"));
packageJson.version=version;
await fs.writeFile(packagePath,JSON.stringify(packageJson,null,2)+"\n","utf8");
await fs.access(sourceHtml); await fs.access(sourceJson);
await fs.rm(dist,{recursive:true,force:true}); await fs.mkdir(dist,{recursive:true});
let html=await fs.readFile(sourceHtml,"utf8");
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
'html{width:100%;min-width:0;min-height:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%}',
'body{width:100%;min-width:0;max-width:100%;min-height:100dvh;margin:0;overflow-x:hidden}',
'img,svg,video,canvas,iframe{max-width:100%;height:auto}',
'input,select,textarea,button{max-width:100%;font:inherit}',
'@media(max-width:720px){',
'html,body{width:100%;min-width:0;min-height:100%;overflow-x:hidden}',
'body{padding-left:max(0px,env(safe-area-inset-left));padding-right:max(0px,env(safe-area-inset-right));padding-bottom:env(safe-area-inset-bottom)}',
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
'@media(max-width:420px){body{font-size:15px}h1{font-size:clamp(1.25rem,6vw,1.8rem)}h2{font-size:clamp(1.1rem,5vw,1.5rem)}}',
'</style>'
].join('\n');
if (!/<meta\s+name=["']viewport["']/i.test(html)) throw new Error("No se pudo configurar el viewport móvil.");
if (!html.includes('id="pes-responsive-layout"')) {
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, responsiveCss + '\n</head>');
  else html = responsiveCss + html;
}
html+="\n<script>window.PES_APP_VERSION="+JSON.stringify(version)+";</script>\n<script src=\"./pes-updater-bridge.js\"></script>\n<script src=\"./pes-updater.js\"></script>\n";
await fs.writeFile(path.join(dist,"index.html"),html,"utf8");
await fs.copyFile(sourceJson,path.join(dist,path.basename(sourceJson)));
await fs.copyFile(path.join(root,"scripts","pes-updater.js"),path.join(dist,"pes-updater.js"));
await build({entryPoints:["scripts/pes-updater-bridge.js"],bundle:true,platform:"browser",format:"iife",target:["es2020"],outfile:path.join(dist,"pes-updater-bridge.js"),logLevel:"info"});
await build({entryPoints:["node_modules/@supabase/supabase-js/dist/module/index.js"],bundle:true,platform:"browser",format:"iife",globalName:"supabase",target:["es2020"],outfile:path.join(dist,"supabase.bundle.js"),logLevel:"info"});
console.log("PES web bundle ready:",dist,"version",version);
