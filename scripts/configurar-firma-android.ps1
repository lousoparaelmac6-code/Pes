$ErrorActionPreference = "Stop"
$repo = "lousoparaelmac6-code/Pes"
$alias = "pes-release"
$keystore = Join-Path $PSScriptRoot "pes-release.keystore"
$backup = Join-Path $PSScriptRoot "PES-FIRMA-ANDROID-PRIVADO.txt"

if (!(Get-Command keytool -ErrorAction SilentlyContinue)) { throw "No se encontró keytool. Instalá un JDK y volvé a ejecutar este script." }
if (!(Get-Command gh -ErrorAction SilentlyContinue)) { throw "Falta GitHub CLI (gh). Instalalo desde https://cli.github.com/ y luego ejecutá: gh auth login" }
gh auth status
if ($LASTEXITCODE -ne 0) { throw "GitHub CLI no está autenticado. Ejecutá gh auth login y asegurate de tener permiso de administración sobre $repo." }

if ((Test-Path $keystore) -and (Test-Path $backup)) {
  $line = Get-Content $backup | Where-Object { $_ -like "Contraseña:*" } | Select-Object -First 1
  if (!$line) { throw "Existe el keystore pero no se encontró su contraseña en el archivo de respaldo. No se regenerará la clave." }
  $password = $line.Substring("Contraseña:".Length).Trim()
} elseif (Test-Path $keystore) {
  throw "Ya existe $keystore pero no el respaldo con su contraseña. No se sobrescribirá una clave de firma existente."
} else {
  $bytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $password = [BitConverter]::ToString($bytes).Replace("-", "")
  $env:PES_KEY_PASS = $password
  & keytool -genkeypair -v -keystore $keystore -storetype PKCS12 -alias $alias -keyalg RSA -keysize 3072 -validity 10000 -storepass:env PES_KEY_PASS -keypass:env PES_KEY_PASS -dname "CN=PES Android, OU=Application, O=GYJ, C=AR"
  $keytoolExit = $LASTEXITCODE
  Remove-Item Env:PES_KEY_PASS -ErrorAction SilentlyContinue
  if ($keytoolExit -ne 0) { throw "No se pudo generar la clave de firma." }
  @"
CLAVE DE FIRMA PRIVADA DE PES
Repositorio: $repo
Alias: $alias
Contraseña: $password
Archivo: $keystore

Conservá este archivo y pes-release.keystore fuera de repositorios públicos y en una copia segura.
No regeneres la clave: las próximas APK deben firmarse con este mismo archivo para poder actualizar sin desinstalar.
"@ | Set-Content -Path $backup -Encoding UTF8
}

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))
gh secret set ANDROID_KEYSTORE_BASE64 --repo $repo --body $base64
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEYSTORE_BASE64. El keystore y su respaldo local se conservaron." }
gh secret set ANDROID_KEYSTORE_PASSWORD --repo $repo --body $password
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEYSTORE_PASSWORD. Volvé a ejecutar este script para reintentar." }
gh secret set ANDROID_KEY_ALIAS --repo $repo --body $alias
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEY_ALIAS. Volvé a ejecutar este script para reintentar." }
gh secret set ANDROID_KEY_PASSWORD --repo $repo --body $password
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEY_PASSWORD. Volvé a ejecutar este script para reintentar." }

Write-Host "Firma Android configurada correctamente en GitHub Secrets."
Write-Host "Conservá de forma privada el archivo: $keystore"
Write-Host "Conservá de forma privada el respaldo: $backup"
Write-Host "Después avisame para volver a ejecutar el workflow Android."
