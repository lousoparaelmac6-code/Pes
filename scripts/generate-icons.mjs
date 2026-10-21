import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";
const root=process.cwd();
const svgPath=path.join(root,"assets","pes-app-icon.svg");
const svg=await fs.readFile(svgPath);
const generated=path.join(root,"assets","generated");
await fs.mkdir(generated,{recursive:true});
const pngPath=path.join(generated,"pes-icon.png");
await sharp(svg,{density:192}).resize(1024,1024,{fit:"contain"}).png().toFile(pngPath);
const icoSizes=[16,24,32,48,64,128,256];
const icoBuffers=await Promise.all(icoSizes.map(size=>sharp(svg,{density:192}).resize(size,size,{fit:"contain"}).png().toBuffer()));
await fs.writeFile(path.join(generated,"pes-icon.ico"),await pngToIco(icoBuffers));
const appDir=path.join(root,"android","app");
try { await fs.access(appDir); } catch { console.log("Android aún no está creado; se generaron los iconos base para Windows."); process.exit(0); }
const res=path.join(appDir,"src","main","res");
const sizes={mdpi:48,hdpi:72,xhdpi:96,xxhdpi:144,xxxhdpi:192};
for(const [density,size] of Object.entries(sizes)){
 const dir=path.join(res,"mipmap-"+density);await fs.mkdir(dir,{recursive:true});
 await sharp(svg,{density:192}).resize(size,size,{fit:"contain"}).png().toFile(path.join(dir,"ic_launcher.png"));
 await sharp(svg,{density:192}).resize(size,size,{fit:"contain"}).png().toFile(path.join(dir,"ic_launcher_round.png"));
}
const foreground=path.join(res,"drawable-nodpi");await fs.mkdir(foreground,{recursive:true});
await sharp(svg,{density:192}).resize(432,432,{fit:"contain"}).png().toFile(path.join(foreground,"pes_launcher_foreground.png"));
const adaptive=path.join(res,"mipmap-anydpi-v26");await fs.mkdir(adaptive,{recursive:true});
await fs.writeFile(path.join(adaptive,"ic_launcher.xml"),'<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/pes_icon_background"/><foreground android:drawable="@drawable/pes_launcher_foreground"/></adaptive-icon>\n');
await fs.writeFile(path.join(adaptive,"ic_launcher_round.xml"),'<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/pes_icon_background"/><foreground android:drawable="@drawable/pes_launcher_foreground"/></adaptive-icon>\n');
const values=path.join(res,"values");await fs.mkdir(values,{recursive:true});
const colorsPath=path.join(values,"pes-icon-colors.xml");
await fs.writeFile(colorsPath,'<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="pes_icon_background">#0B211A</color></resources>\n');
console.log("Iconos PES generados: PNG 1024, Windows ICO multirresolución y Android mipmaps/adaptive icon.");
