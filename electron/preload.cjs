const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("pesDesktop",{
  getVersion:()=>ipcRenderer.invoke("pes:version"),
  checkForUpdates:()=>ipcRenderer.invoke("pes:check-updates"),
  downloadAndInstall:payload=>ipcRenderer.invoke("pes:download-install",payload),
  onDownloadProgress:callback=>{
    const listener=(_event,progress)=>callback(progress);
    ipcRenderer.on("pes:download-progress",listener);
    return ()=>ipcRenderer.removeListener("pes:download-progress",listener);
  }
});