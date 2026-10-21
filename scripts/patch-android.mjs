import fs from "node:fs/promises";
import path from "node:path";
const root=path.resolve("android"),appDir=path.join(root,"app");
const version=process.env.PES_VERSION||"1.0.0",versionCode=Number(process.env.PES_VERSION_CODE||1);
await import("./generate-icons.mjs");
const javaDir=path.join(appDir,"src","main","java","com","gyj","pes");
await fs.mkdir(javaDir,{recursive:true});
const mainActivity=[
 "package com.gyj.pes;","import android.os.Bundle;","import com.getcapacitor.BridgeActivity;",
 "public class MainActivity extends BridgeActivity {","  @Override",
 "  public void onCreate(Bundle savedInstanceState) {","    registerPlugin(PESUpdaterPlugin.class);",
 "    super.onCreate(savedInstanceState);","  }",
 "}"
].join("\n");
await fs.writeFile(path.join(javaDir,"MainActivity.java"),mainActivity,"utf8");
const plugin=[
 "package com.gyj.pes;","import android.content.Intent;","import android.net.Uri;","import android.os.Build;",
 "import android.provider.Settings;","import androidx.core.content.FileProvider;","import com.getcapacitor.Plugin;",
 "import com.getcapacitor.PluginCall;","import com.getcapacitor.JSObject;","import com.getcapacitor.PluginMethod;","import com.getcapacitor.annotation.CapacitorPlugin;",
 "import java.io.File;","import java.io.FileOutputStream;","import java.io.InputStream;","import java.net.HttpURLConnection;",
 "import java.net.URL;","import java.security.MessageDigest;","import java.util.Locale;","import java.io.ByteArrayOutputStream;","import java.nio.charset.StandardCharsets;","import java.util.ArrayList;","import java.util.Collections;","import java.util.List;","import org.json.JSONArray;","import org.json.JSONObject;",
 "@CapacitorPlugin(name = \"PESUpdater\")","public class PESUpdaterPlugin extends Plugin {", "  @PluginMethod",
 "  public void getLatestAndroidManifest(PluginCall call) {",
 "    new Thread(() -> {",
 "      try {",
 "        JSONArray releases = new JSONArray(readUrl(\"https://api.github.com/repos/lousoparaelmac6-code/pes-releases/releases?per_page=100\"));",
 "        List<JSONObject> candidates = new ArrayList<>();",
 "        for (int i = 0; i < releases.length(); i++) { JSONObject release = releases.getJSONObject(i); String tag = release.optString(\"tag_name\", \"\"); if (!release.optBoolean(\"draft\") && !release.optBoolean(\"prerelease\") && tag.startsWith(\"apk-v\") && validVersion(versionFromTag(tag))) candidates.add(release); }",
 "        Collections.sort(candidates, (left, right) -> compareVersion(versionFromTag(right.optString(\"tag_name\")), versionFromTag(left.optString(\"tag_name\"))));",
 "        for (JSONObject release : candidates) { JSONArray assets = release.optJSONArray(\"assets\"); if (assets == null) continue; String manifestUrl = \"\"; for (int i = 0; i < assets.length(); i++) { JSONObject asset = assets.getJSONObject(i); if (\"PES-Android-manifest.json\".equals(asset.optString(\"name\"))) { manifestUrl = asset.optString(\"browser_download_url\"); break; } } if (manifestUrl.isEmpty()) continue;",
 "          JSONObject manifest = new JSONObject(readUrl(manifestUrl)); String apkUrl = manifest.optString(\"url\"); String hash = manifest.optString(\"sha256\"); if (\"android\".equals(manifest.optString(\"platform\")) && !manifest.optString(\"version\").isEmpty() && apkUrl.startsWith(\"https://\") && hash.length() == 64 && hash.matches(\"[a-fA-F0-9]{64}\")) { JSObject result = new JSObject(); result.put(\"platform\", manifest.optString(\"platform\")); result.put(\"version\", manifest.optString(\"version\")); result.put(\"url\", apkUrl); result.put(\"sha256\", hash); result.put(\"size\", manifest.optLong(\"size\", 0)); call.resolve(result); return; }",
 "        }",
 "        throw new Exception(\"No hay una publicación APK válida con manifiesto y SHA-256.\");",
 "      } catch (Exception e) { call.reject(\"No se pudo consultar el servidor de actualizaciones Android: \" + e.getMessage(), e); }",
 "    }, \"PES-Android-Manifest\").start();",
 "  }",
 "  private String versionFromTag(String tag) { return tag.startsWith(\"apk-v\") ? tag.substring(5) : tag; }",
 "  private boolean validVersion(String version) { String[] parts = version.split(\"[.]\"); if (parts.length != 3) return false; for (String part : parts) { try { Integer.parseInt(part); } catch (Exception e) { return false; } } return true; }",
 "  private int compareVersion(String a, String b) { String[] aa = a.split(\"[.]\"), bb = b.split(\"[.]\"); for (int i = 0; i < Math.max(aa.length, bb.length); i++) { int x = i < aa.length ? parseVersionPart(aa[i]) : 0; int y = i < bb.length ? parseVersionPart(bb[i]) : 0; if (x != y) return Integer.compare(x, y); } return 0; }",
 "  private int parseVersionPart(String value) { try { return Integer.parseInt(value); } catch (Exception e) { return 0; } }",
 "  private String readUrl(String source) throws Exception { HttpURLConnection connection = (HttpURLConnection) new URL(source).openConnection(); connection.setConnectTimeout(15000); connection.setReadTimeout(30000); connection.setInstanceFollowRedirects(true); connection.setRequestProperty(\"User-Agent\", \"PES-Android-Updater\"); try { int status = connection.getResponseCode(); if (status < 200 || status >= 300) throw new Exception(\"HTTP \" + status + \" al consultar \" + source); try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) { byte[] buffer = new byte[16384]; int count; while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count); return new String(out.toByteArray(), StandardCharsets.UTF_8); } } finally { connection.disconnect(); } }",
"  @PluginMethod",
 "  public void installApk(PluginCall call) {","    final String source = call.getString(\"url\");",
 "    final String expected = call.getString(\"sha256\");\n    final Long expectedSize = call.getLong(\"size\");",
 "    if (source == null || !source.startsWith(\"https://\") || expected == null || expected.length() != 64) { call.reject(\"La URL o la verificación SHA-256 no es válida.\"); return; }",
 "    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {",
 "      Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse(\"package:\" + getContext().getPackageName()));",
 "      settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(settings);",
 "      call.reject(\"Permití instalar aplicaciones desde PES en Ajustes y volvé a pulsar Descargar e instalar.\"); return;","    }",
 "    new Thread(() -> {","      File out = new File(getContext().getCacheDir(), \"PES-update.apk\");","      try {",
 "        HttpURLConnection connection = (HttpURLConnection) new URL(source).openConnection();",
 "        connection.setConnectTimeout(20000); connection.setReadTimeout(60000); connection.setInstanceFollowRedirects(true);",
 "        connection.setRequestProperty(\"User-Agent\", \"PES-Android-Updater\");","        int status = connection.getResponseCode();",
 "        if (status < 200 || status >= 300) throw new Exception(\"El servidor respondió HTTP \" + status + \".\");",
 "        long total = connection.getContentLengthLong(); if (total <= 0 && expectedSize != null) total = expectedSize; long received = 0;",
 "        notifyListeners(\"downloadProgress\", progressPayload(\"Descargando actualización…\", 0, total), true);",
 "        MessageDigest digest = MessageDigest.getInstance(\"SHA-256\");",
 "        try (InputStream in = connection.getInputStream(); FileOutputStream file = new FileOutputStream(out)) {",
 "          byte[] buffer = new byte[65536]; int count;",
 "          while ((count = in.read(buffer)) != -1) { file.write(buffer, 0, count); digest.update(buffer, 0, count); received += count; notifyListeners(\"downloadProgress\", progressPayload(\"Descargando actualización…\", received, total), true); }",
 "          file.flush();","        } finally { connection.disconnect(); }",
 "        notifyListeners(\"downloadProgress\", progressPayload(\"Verificando archivo…\", received, total), true);",
 "        StringBuilder hash = new StringBuilder();",
 "        for (byte b : digest.digest()) hash.append(String.format(Locale.US, \"%02x\", b));",
 "        if (!expected.equalsIgnoreCase(hash.toString())) { out.delete(); throw new Exception(\"La verificación SHA-256 no coincide. El APK no se instalará.\"); }",
 "        notifyListeners(\"downloadProgress\", progressPayload(\"Preparando instalación…\", received, total), true);",
 "        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + \".fileprovider\", out);",
 "        Intent intent = new Intent(Intent.ACTION_VIEW); intent.setDataAndType(uri, \"application/vnd.android.package-archive\");",
 "        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(intent); call.resolve();",
 "      } catch (Exception e) { call.reject(\"No se pudo preparar la actualización: \" + e.getMessage(), e); }",
 "    }, \"PES-APK-Updater\").start();","  }",
 "  private JSObject progressPayload(String stage, long received, long total) {",
 "    JSObject data = new JSObject(); data.put(\"stage\", stage); data.put(\"received\", received); data.put(\"total\", total);",
 "    data.put(\"percent\", total > 0 ? Math.min(100.0, (received * 100.0) / total) : -1); return data;",
 "  }","}"
].join("\n");
await fs.writeFile(path.join(javaDir,"PESUpdaterPlugin.java"),plugin,"utf8");
const pathsDir=path.join(appDir,"src","main","res","xml");await fs.mkdir(pathsDir,{recursive:true});
await fs.writeFile(path.join(pathsDir,"pes_file_paths.xml"),
 '<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android"><cache-path name="pes_updates" path="."/></paths>\n',"utf8");
const manifestPath=path.join(appDir,"src","main","AndroidManifest.xml");let manifest=await fs.readFile(manifestPath,"utf8");
manifest=manifest.replace(/<application\b([^>]*)>/,(_match,attrs)=>{let next=attrs;if(!/\bandroid:icon=/.test(next))next+=' android:icon="@mipmap/ic_launcher"';if(!/\bandroid:roundIcon=/.test(next))next+=' android:roundIcon="@mipmap/ic_launcher_round"';return "<application"+next+">";});
if(!manifest.includes("android.permission.REQUEST_INSTALL_PACKAGES"))manifest=manifest.replace(/<manifest\b[^>]*>/,m=>m+'\n    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />');
if(!manifest.includes(".fileprovider")){
 const provider='\n        <provider android:name="androidx.core.content.FileProvider" android:authorities="com.gyj.pes.fileprovider" android:exported="false" android:grantUriPermissions="true"><meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/pes_file_paths" /></provider>\n';
 manifest=manifest.replace(/<\/application>/,provider+'\n    </application>');
}
await fs.writeFile(manifestPath,manifest,"utf8");
const gradlePath=path.join(appDir,"build.gradle");let gradle=await fs.readFile(gradlePath,"utf8");
gradle=gradle.replace(/versionCode\s+\d+/,"versionCode "+versionCode);
gradle=gradle.replace(/versionName\s+["'][^"']+["']/,'versionName "'+version+'"');
if(!gradle.includes("signingConfigs { release")){
 const signing='signingConfigs { release { storeFile file("release.keystore"); storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD"); keyAlias System.getenv("ANDROID_KEY_ALIAS"); keyPassword System.getenv("ANDROID_KEY_PASSWORD") } }\n    ';
 if(!/buildTypes\s*\{\s*release\s*\{/.test(gradle))throw new Error("No se encontró buildTypes.release en android/app/build.gradle.");
 gradle=gradle.replace(/buildTypes\s*\{\s*release\s*\{/,signing+'buildTypes { release { signingConfig signingConfigs.release');
}
await fs.writeFile(gradlePath,gradle,"utf8");
console.log("Android package/version/updater/signing configured:",version,versionCode);
