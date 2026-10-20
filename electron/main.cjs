const {app,BrowserWindow,ipcMain,dialog}=require("electron");
const path=require("node:path"),os=require("node:os"),fs=require("node:fs/promises"),crypto=require("node:crypto");
const {spawn}=require("node:child_process");
const RELEASE_REPO="lousoparaelmac6-code/pes-releases";
const RELEASES_API="https://api.github.com/repos/"+RELEASE_REPO+"/releases?per_page=100";
let mainWindow;
function parts(v){return String(v||"0").replace(/^v/,"").split(/[.+-]/).map(n=>parseInt(n,10)||0);}
function compare(a,b){const aa=parts(a),bb=parts(b);for(let i=0;i<Math.max(aa.length,bb.length);i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return d>0?1:-1;}return 0;}
async function getJson(url){const r=await fetch(url,{headers:{Accept:"application/vnd.github+json","User-Agent":"PES-Desktop-Updater"}});if(!r.ok)throw new Error("GitHub respondió HTTP "+r.status+".");return r.json();}
async function latestDesktopRelease(){
 const releases=await getJson(RELEASES_API);
 const candidates=releases.filter(r=>!r.draft&&!r.prerelease&&/^desktop-v\d+\.\d+\.\d+$/.test(r.tag_name||""));
 candidates.sort((a,b)=>compare(b.tag_name.replace(/^desktop-v/,""),a.tag_name.replace(/^desktop-v/,"")));
 for(const release of candidates){const asset=(release.assets||[]).find(a=>a.name==="PES-Windows-manifest.json");if(!asset)continue;
  const manifest=await getJson(asset.browser_download_url);
  if(manifest.platform==="windows"&&manifest.version&&manifest.url&&manifest.sha256)return manifest;
 }return null;
}
async function downloadVerified(url,expectedSha){
 const response=await fetch(url,{"headers":{"User-Agent":"PES-Desktop-Updater"}});
 if(!response.ok)throw new Error("No se pudo descargar el instalador (HTTP "+response.status+").");
 const bytes=Buffer.from(await response.arrayBuffer());
 if(!bytes.length)throw new Error("El instalador descargado está vacío.");
 const actual=crypto.createHash("sha256").update(bytes).digest("hex");
 if(!expectedSha||actual.toLowerCase()!==String(expectedSha).toLowerCase())throw new Error("La verificación SHA-256 no coincide. No se ejecutó el archivo.");
 const destination=path.join(os.tmpdir(),"PES-Windows-Setup.exe");await fs.writeFile(destination,bytes);return destination;
}
function createWindow(){
 mainWindow=new BrowserWindow({width:1420,height:920,minWidth:900,minHeight:650,backgroundColor:"#0b1020",autoHideMenuBar:true,
  webPreferences:{preload:path.join(__dirname,"preload.cjs"),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 mainWindow.loadFile(path.join(__dirname,"..","dist","index.html"));
}
app.whenReady().then(()=>{
 ipcMain.handle("pes:version",()=>app.getVersion());
 ipcMain.handle("pes:check-updates",async()=>{
  try{const manifest=await latestDesktopRelease();if(!manifest)return{available:false,currentVersion:app.getVersion(),message:"No hay una release válida de Windows publicada."};
   return{available:compare(manifest.version,app.getVersion())>0,currentVersion:app.getVersion(),latestVersion:manifest.version,url:manifest.url,sha256:manifest.sha256,size:manifest.size};
  }catch(e){throw new Error("No se pudo comprobar la versión de Windows: "+String(e.message||e));}
 });
 ipcMain.handle("pes:download-install",async(_event,payload)=>{
  try{if(!payload||!payload.url||!payload.sha256)throw new Error("Faltan datos para verificar el instalador.");
   const installer=await downloadVerified(payload.url,payload.sha256);
   const child=spawn(installer,["/S"],{detached:true,stdio:"ignore"});child.unref();setTimeout(()=>app.quit(),500);return{started:true};
  }catch(e){await dialog.showMessageBox(mainWindow,{type:"error",title:"Actualización de PES",message:"No se pudo instalar la actualización.",detail:String(e.message||e)});throw e;}
 });
 createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
