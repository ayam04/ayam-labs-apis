# Regenerate every generated doc surface from the live specs, then verify it.
#
# The lesson from round 28: the reference pages are built from spec snapshots in .tmp.
# When a spec changed and the snapshot did not, the site kept publishing examples the API
# rejected. This script makes the whole cycle one command so it cannot half-happen.
#
#   pwsh -File scripts/refresh-docs.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$hosts = [ordered]@{
  "emailcheck" = "emailcheck.ayamk.in"
  "seo-audit"  = "seo-audit.ayamk.in"
  "docparse"   = "docparse.ayamk.in"
  "ai-text"    = "textmind.ayamk.in"
  "pii-shield" = "piishield.ayamk.in"
}

Write-Host "1/5 downloading live specs"
foreach ($key in $hosts.Keys) {
  Invoke-WebRequest ("https://" + $hosts[$key] + "/openapi.json") -OutFile ".tmp\spec-$key.json" -UseBasicParsing -TimeoutSec 30
  Write-Host ("    " + $key + "  " + (Get-Item ".tmp\spec-$key.json").Length + " bytes")
}

Write-Host "2/5 regenerating reference pages"
python scripts\build_reference.py

Write-Host "3/5 deploying the site"
Push-Location marketing\site
wrangler deploy 2>&1 | Select-Object -Last 1
Pop-Location
Start-Sleep -Seconds 3

Write-Host "4/5 docs drift check"
node scripts\check-docs.mjs .

Write-Host "5/5 executing every published curl example"
node scripts\check-examples.mjs .

Write-Host ""
Write-Host "done: specs refreshed, references rebuilt, deployed, drift clean, examples green"