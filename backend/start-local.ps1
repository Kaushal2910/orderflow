# Boot all OrderFlow services locally (no Docker needed). Run: powershell -File start-local.ps1
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$ports = @{ "inventory-service" = 8082; "payment-service" = 8083; "order-service" = 8081; "notification-service" = 8084; "gateway-service" = 8080 }
$logs = Join-Path $base "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
foreach ($s in $ports.Keys) {
  $port = $ports[$s]
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    Write-Output "${s} already listening on ${port} - skipping"
    continue
  }
  $jar = Get-ChildItem -Path "$base\${s}\target\*.jar" | Select-Object -First 1
  if (-not $jar) { Write-Output "${s}: no jar found, run mvn package first"; continue }
  Start-Process -FilePath "java" -ArgumentList "-jar", $jar.FullName `
    -WorkingDirectory "$base\${s}" `
    -RedirectStandardOutput "$logs\${s}.out.log" -RedirectStandardError "$logs\${s}.err.log"
  Write-Output "${s} starting..."
}
Write-Output "Waiting 35s for boot..."
Start-Sleep -Seconds 35
foreach ($s in $ports.Keys) {
  $port = $ports[$s]
  $logf = "$logs\${s}.out.log"
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { Write-Output "${s} port ${port} UP" }
  else { Write-Output "${s} port ${port} DOWN (see ${logf})" }
}
