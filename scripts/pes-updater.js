(function(){
 "use strict";
 const API="https://api.github.com/repos/lousoparaelmac6-code/pes-releases/releases?per_page=100";
 const currentVersion=String(window.PES_APP_VERSION||"1.0.0"),cap=window.Capacitor;
 const isAndroid=!!(cap&&typeof cap.getPlatform==="function"&&cap.getPlatform()==="android"),isDesktop=!!window.pesDesktop;
 let progressBox=null,progressText=null,progressBar=null,progressDetails=null,progressStarted=0;
 function parts(v){return String(v||"0").replace(/^v/,"").split(/[.+-]/).map(n=>parseInt(n,10)||0);}
 function compare(a,b){const aa=parts(a),bb=parts(b);for(let i=0;i<Math.max(aa.length,bb.length);i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return d>0?1:-1;}return 0;}
 async function getJson(url){const r=await fetch(url,{headers:{Accept:"application/vnd.github+json"}});if(!r.ok)throw new Error("GitHub respondió HTTP "+r.status+".");return r.json();}
 async function latestAndroidRelease(){
  const releases=await getJson(API),list=releases.filter(r=>!r.draft&&!r.prerelease&&/^apk-v\d+\.\d+\.\d+$/.test(r.tag_name||""));
  list.sort((a,b)=>compare(b.tag_name.replace(/^apk-v/,""),a.tag_name.replace(/^apk-v/,"")));
  for(const release of list){const asset=(release.assets||[]).find(a=>a.name==="PES-Android-manifest.json");if(!asset)continue;
   const manifest=await getJson(asset.browser_download_url);if(manifest.platform==="android"&&manifest.version&&manifest.url&&manifest.sha256)return manifest;
  }return null;
 }
 function ensureUi(){
  if(!document.getElementById("pes-update-launcher")){
   const style=document.createElement("style");
   style.textContent="#pes-update-launcher{position:fixed;right:12px;top:calc(max(10px,env(safe-area-inset-top,0px)));z-index:9000;border:1px solid #3b5279;border-radius:999px;background:#16223a;color:#eef3ff;padding:9px 12px;font:600 12px Segoe UI,Arial,sans-serif;box-shadow:0 6px 24px #0005}#pes-update-launcher:disabled{opacity:.7}#pes-update-toast{position:fixed;right:12px;top:calc(58px + env(safe-area-inset-top,0px));z-index:9001;max-width:min(420px,calc(100vw - 24px));max-height:calc(100dvh - 90px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));overflow:auto;padding:13px 15px;border:1px solid #3b5279;border-radius:12px;background:#101a30;color:#eef3ff;font:13px/1.45 Segoe UI,Arial,sans-serif;box-shadow:0 10px 30px #0008;white-space:pre-wrap}#pes-update-toast button{margin:8px 6px 0 0;border:1px solid #3b5279;border-radius:8px;background:#1d3152;color:#fff;padding:8px 10px;min-height:40px}#pes-update-settings{margin-top:12px;padding:14px;border:1px solid #344251;border-radius:14px;background:#111923;color:#e8edf1}#pes-update-settings h3{margin:0 0 6px;font-size:16px}#pes-update-settings p{margin:0 0 10px;color:#aab5c0;font-size:13px;line-height:1.45}#pes-update-settings button{min-height:44px;padding:9px 12px;border-radius:10px;border:1px solid #3b5279;background:#1d3152;color:#fff}#pes-update-progress{margin-top:12px}#pes-update-progress-track{height:10px;width:100%;overflow:hidden;border-radius:999px;background:#29364a;border:1px solid #43536b}#pes-update-progress-fill{height:100%;width:0;background:#76a9ff;transition:width .15s linear}#pes-update-progress-details{margin-top:7px;color:#c5d1df;font-size:12px;line-height:1.45}#pes-update-progress-title{font-weight:700;margin-bottom:7px}";
   document.head.appendChild(style);
   const button=document.createElement("button");button.id="pes-update-launcher";button.type="button";button.textContent="↻ Actualizaciones";button.addEventListener("click",()=>runCheck(false));document.body.appendChild(button);
  }
  ensureSettingsPanel();
 }
 function ensureSettingsPanel(){
  const config=document.getElementById("config");if(!config||document.getElementById("pes-update-settings"))return;
  const panel=document.createElement("div");panel.id="pes-update-settings";
  panel.innerHTML="<h3>Actualizaciones de PES</h3><p>Se comprueba automáticamente al abrir. Durante la descarga vas a ver el porcentaje, el tamaño recibido y el tiempo estimado restante.</p><button type=\"button\" id=\"pes-update-settings-check\">Buscar actualizaciones</button>";
  config.appendChild(panel);panel.querySelector("#pes-update-settings-check").addEventListener("click",()=>runCheck(false));
 }
 function watchSettings(){const config=document.getElementById("config");if(config&&window.MutationObserver)new MutationObserver(()=>ensureSettingsPanel()).observe(config,{childList:true});}
 function show(message,actions){
  let box=document.getElementById("pes-update-toast");if(box)box.remove();box=document.createElement("div");box.id="pes-update-toast";
  const text=document.createElement("div");text.textContent=message;box.appendChild(text);
  (actions||[]).forEach(item=>{const b=document.createElement("button");b.textContent=item.label;b.addEventListener("click",async()=>{b.disabled=true;try{await item.run();}catch(e){show("No se pudo completar la actualización.\n"+String(e.message||e));}});box.appendChild(b);});
  const close=document.createElement("button");close.textContent="Cerrar";close.addEventListener("click",()=>box.remove());box.appendChild(close);document.body.appendChild(box);
 }
 function bytes(n){if(!Number.isFinite(n)||n<0)return "—";if(n<1024)return n+" B";const units=["KB","MB","GB"];let x=n/1024,i=0;while(x>=1024&&i<units.length-1){x/=1024;i++;}return x.toFixed(1)+" "+units[i];}
 function remaining(received,total){
  if(!total||received<=0||received>=total)return received>=total?"0 s":"Calculando…";
  const elapsed=(Date.now()-progressStarted)/1000;if(elapsed<1)return "Calculando…";
  const speed=received/elapsed;if(speed<=0)return "Calculando…";
  const sec=Math.ceil((total-received)/speed);if(sec<60)return sec+" s";if(sec<3600)return Math.floor(sec/60)+" min "+(sec%60)+" s";return Math.floor(sec/3600)+" h "+Math.floor((sec%3600)/60)+" min";
 }
 function beginProgress(){
  let box=document.getElementById("pes-update-toast");if(box)box.remove();
  box=document.createElement("div");box.id="pes-update-toast";
  const title=document.createElement("div");title.id="pes-update-progress-title";title.textContent="Preparando descarga…";box.appendChild(title);
  const track=document.createElement("div");track.id="pes-update-progress-track";const fill=document.createElement("div");fill.id="pes-update-progress-fill";track.appendChild(fill);box.appendChild(track);
  const details=document.createElement("div");details.id="pes-update-progress-details";details.textContent="Conectando con el servidor…";box.appendChild(details);
  const close=document.createElement("button");close.textContent="Ocultar";close.addEventListener("click",()=>box.remove());box.appendChild(close);
  document.body.appendChild(box);progressBox=box;progressText=title;progressBar=fill;progressDetails=details;progressStarted=Date.now();
 }
 function updateProgress(p){
  if(!progressBox||!progressBox.isConnected)return;
  p=p||{};const stage=String(p.stage||"Descargando actualización…");progressText.textContent=stage;
  const received=Number(p.received||0),total=Number(p.total||0),percent=Number.isFinite(Number(p.percent))?Number(p.percent):-1;
  if(percent>=0){progressBar.style.width=Math.max(0,Math.min(100,percent))+"%";progressBar.style.animation="none";progressDetails.textContent=Math.round(percent)+"% · "+bytes(received)+" de "+bytes(total)+" · Restante: "+remaining(received,total);}
  else{progressBar.style.width="35%";progressBar.style.animation="pes-progress-indeterminate 1.1s ease-in-out infinite alternate";progressDetails.textContent=bytes(received)+" recibidos · Tamaño total no informado · Restante: no disponible";}
  if(stage==="Verificando archivo…")progressDetails.textContent="Descarga recibida: "+bytes(received)+". Comprobando integridad SHA-256…";
  if(stage==="Preparando instalación…")progressDetails.textContent="Archivo verificado. Preparando el instalador…";
  if(stage==="Descarga completada")progressDetails.textContent="Descarga completa. "+bytes(received)+" recibidos.";
 }
 async function startDownload(latest){
  beginProgress();
  if(isAndroid){
   const plugin=window.PESNativeUpdater;if(!plugin||typeof plugin.installApk!=="function")throw new Error("No está disponible el instalador nativo; hace falta una compilación Android actualizada.");
   let handle=null;
   try{
    if(typeof plugin.addListener==="function")handle=await plugin.addListener("downloadProgress",p=>updateProgress(p));
    updateProgress({stage:"Conectando con el servidor…",received:0,total:0,percent:-1});
    await plugin.installApk({url:latest.url,sha256:latest.sha256});
    updateProgress({stage:"Preparando instalación…",received:1,total:1,percent:100});
    if(progressBox&&progressBox.isConnected){progressText.textContent="Descarga verificada";progressDetails.textContent="Android va a abrir el instalador. Confirmá la actualización para conservar los datos.";const b=document.createElement("button");b.textContent="Listo";b.addEventListener("click",()=>progressBox&&progressBox.remove());progressBox.appendChild(b);}
   }finally{if(handle&&typeof handle.remove==="function")await handle.remove();}
  }else{
   if(typeof window.pesDesktop.onDownloadProgress==="function")window.pesDesktop.onDownloadProgress(p=>updateProgress(p));
   await window.pesDesktop.downloadAndInstall({url:latest.url,sha256:latest.sha256});
   updateProgress({stage:"Descarga completada",received:1,total:1,percent:100});
  }
 }
 async function runCheck(silent){
  const button=document.getElementById("pes-update-launcher");if(button){button.disabled=true;button.textContent="Comprobando…";}
  try{
   if(!isAndroid&&!isDesktop){show("La comprobación está disponible en las aplicaciones instaladas de Windows y Android.");return;}
   const latest=isDesktop?await window.pesDesktop.checkForUpdates():await latestAndroidRelease();
   if(!latest){if(!silent)show("No se encontró una publicación válida para esta plataforma.");return;}
   const installed=isDesktop?String(latest.currentVersion||currentVersion):currentVersion,version=String(latest.latestVersion||latest.version||"");
   const available=typeof latest.available==="boolean"?latest.available:compare(version,installed)>0;
   if(!available){if(!silent)show("PES está actualizado.\nVersión instalada: "+installed);return;}
   show("Hay una versión nueva de PES para "+(isAndroid?"Android":"Windows")+".\nInstalada: "+installed+"\nDisponible: "+version+"\n\nSe conservarán los datos. No desinstales la aplicación.",[
    {label:"Ir a Configuración",run:async()=>{if(typeof window.go==="function")window.go("config");ensureSettingsPanel();}},
    {label:"Descargar e instalar",run:async()=>{await startDownload(latest);}}
   ]);
  }catch(e){if(!silent)show("No se pudo comprobar o descargar la actualización.\n"+String(e.message||e)+"\n\nPodés seguir usando esta versión e intentar nuevamente.");else console.warn("PES update check failed:",e);}
  finally{if(button){button.disabled=false;button.textContent="↻ Actualizaciones";}}
 }
 function start(){ensureUi();watchSettings();setTimeout(()=>runCheck(true),2200);}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();