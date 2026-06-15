# RecarregaAi! V.1.4.6

$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$zipPath = Join-Path $dist "recarregaai.zip"
$includePaths = @(
    "assets",
    "CSS",
    "JS",
    "manifest.json",
    "options.html",
    "popup.html",
    "uninstall.html",
    "welcome.html"
)

New-Item -ItemType Directory -Force -Path $dist | Out-Null

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$items = $includePaths | ForEach-Object {
    Join-Path $root $_
}

Compress-Archive -Path $items -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Pacote criado em $zipPath"
