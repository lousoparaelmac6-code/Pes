$ErrorActionPreference = "Stop"
$repo = "lousoparaelmac6-code/Pes"
$alias = "pes-release"
$keystore = Join-Path $PSScriptRoot "pes-release.keystore"
$backup = Join-Path $PSScriptRoot "PES-FIRMA-ANDROID-PRIVADO.txt"

if (!(Get-Command keytool -ErrorAction SilentlyContinue)) { throw "No se encontró keytool. Instalá un JDK y volvé a ejecutar este script." }
if (!(Get-Command gh -ErrorAction SilentlyContinue)) { throw "Falta GitHub CLI (gh). Instalalo desde https://cli.github.com/ y luego ejecutá: gh auth login" }
gh auth status
if (Test-Path $keystore) { throw "Ya existe $keystore. No se sobrescribirá una clave de firma existente." }

$bytes = New-Object byte[] 24
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$password = [Convert]::ToHexString($bytes)

& keytool -genkeypair -v -keystore $keystore -storetype PKCS12 -alias $alias -keyalg RSA -keysize 3072 -validity 10000 -storepass $password -keypass $password -dname "CN=PES Android, OU=Application, O=GYJ, C=AR"
if ($LASTEXITCODE -ne 0) { throw "No se pudo generar la clave de firma." }

$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($keystore))
$base64 | gh secret set ANDROID_KEYSTORE_BASE64 --repo $repo
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEYSTORE_BASE64." }
$password | gh secret set ANDROID_KEYSTORE_PASSWORD --repo $repo
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEYSTORE_PASSWORD." }
$alias | gh secret set ANDROID_KEY_ALIAS --repo $repo
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEY_ALIAS." }
$password | gh secret set ANDROID_KEY_PASSWORD --repo $repo
if ($LASTEXITCODE -ne 0) { throw "No se pudo guardar ANDROID_KEY_PASSWORD." }

@"
CLAVE DE FIRMA PRIVADA DE PES
Repositorio: $repo
Alias: $alias
Contraseña: $password
Archivo: $keystore

Conservá este archivo y pes-release.keystore fuera de repositorios públicos y en una copia segura.
No regeneres la clave: las próximas APK deben firmarse con este mismo archivo para poder actualizar sin desinstalar.
"@ | Set-Content -Path $backup -Encoding UTF8
Write-Host "Firma de Android creada y secretos configurados. Guardá de forma segura:"
Write-Host "  $keystore"
Write-Host "  $backup"
Write-Host "Después avisame para volver a ejecutar el workflow Android."
