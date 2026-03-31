$ErrorActionPreference = "SilentlyContinue"

# Start the server in background
$serverJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run server
} -ArgumentList "D:\Vibe Code\Ver 0.1\ResizeVideo-0.1.0"

# Wait for server to start
Start-Sleep -Seconds 5

# Run healthcheck
$result = & npm run desktop:healthcheck 2>&1
Write-Host "Healthcheck result: $result"

if ($result -like "*OK*") {
    # Run smoke test
    $smokeResult = & npm run desktop:smoke 2>&1
    Write-Host "Smoke result: $smokeResult"
}

# Stop the server
Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
