(function(){
 "use strict";
 const API="https://api.github.com/repos/lousoparaelmac6-code/pes-releases/releases?per_page=100";
 const currentVersion=String(window.PES_APP_VERSION||"1.0.0"),cap=window.Capacitor;
 const isAndroid=!!(cap&&typeof cap.getPlatform==="function"&&cap.getPlatform()==="android"),isDesktop=!!window.pesDesktop;
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
  if(document.getElementById("pes-update-launcher"))return;
  const style=document.createElement("style");
  style.textContent="#pes-update-launcher{position:fixed;right:14px;top:14px;z-index:2147483000;border:1px solid #3b5279;border-radius:999px;background:#16223a;color:#eef3ff;padding:9px 13px;font:600 12px Segoe UI,Arial,sans-serif;box-shadow:0 6px 24px #0005}#pes-update-launcher:disabled{opacity:.7}#pes-update-toast{position:fixed;right:14px;top:58px;z-index:2147483000;max-width:min(420px,calc(100vw - 28px));padding:13px 15px;border:1px solid #3b5279;border-radius:12px;background:#101a30;color:#eef3ff;font:13px/1.45 Segoe UI,Arial,sans-serif;box-shadow:0 10px 30px #0008;white-space:pre-wrap}#pes-update-toast button{margin:8px 6px 0 0;border:1px solid #3b5279;border-radius:8px;background:#1d3152;color:#fff;padding:7px 10px}";
  document.head.appendChild(style);const button=document.createElement("button");button.id="pes-update-launcher";button.type="button";button.textContent="↻ Buscar actualizaciones";button.addEventListener("click",runCheck);document.body.appendChild(button);
 }
 function show(message,actions){
  let box=document.getElementById("pes-update-toast");if(box)box.remove();box=document.createElement("div");box.id="pes-update-toast";
  const text=document.createElement("div");text.textContent=message;box.appendChild(text);
  (actions||[]).forEach(item=>{const b=document.createElement("button");b.textContent=item.label;b.addEventListener("click",async()=>{b.disabled=true;try{await item.run();}catch(e){show("No se pudo completar la actualización.\n"+String(e.message||e));}});box.appendChild(b);});
  const close=document.createElement("button");close.textContent="Cerrar";close.addEventListener("click",()=>box.remove());box.appendChild(close);document.body.appendChild(box);
 }
 async function runCheck(){
  const button=document.getElementById("pes-update-launcher");if(button){button.disabled=true;button.textContent="Comprobando…";}
  try{
   if(!isAndroid&&!isDesktop){show("La comprobación está disponible en las aplicaciones instaladas de Windows y Android.");return;}
   const latest=isDesktop?await window.pesDesktop.checkForUpdates():await latestAndroidRelease();
   if(!latest){show("No se encontró una publicación válida para esta plataforma.");return;}
   const installed=isDesktop?String(latest.currentVersion||currentVersion):currentVersion,version=String(latest.latestVersion||latest.version||"");
   const available=typeof latest.available==="boolean"?latest.available:compare(version,installed)>0;
   if(!available){show("PES está actualizado.\nVersión instalada: "+installed);return;}
   show("Hay una versión nueva de PES para "+(isAndroid?"Android":"Windows")+".\nInstalada: "+installed+"\nDisponible: "+version+"\n\nSe conservarán los datos. No desinstales la aplicación.",[{
    label:"Descargar e instalar",run:async()=>{
     if(isAndroid){const plugin=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.PESUpdater;
      if(!plugin||typeof plugin.installApk!=="function")throw new Error("No está disponible el instalador nativo; hace falta una compilación Android actualizada.");
      await plugin.installApk({url:latest.url,sha256:latest.sha256});show("Descarga preparada. Seguí las indicaciones del instalador de Android para actualizar PES.");
     }else await window.pesDesktop.downloadAndInstall({url:latest.url,sha256:latest.sha256});
    }}]);
  }catch(e){show("No se pudo comprobar o descargar la actualización.\n"+String(e.message||e)+"\n\nPodés seguir usando esta versión e intentar nuevamente.");}
  finally{if(button){button.disabled=false;button.textContent="↻ Buscar actualizaciones";}}
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ensureUi,{once:true});else ensureUi();
})();
