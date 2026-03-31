$ErrorActionPreference = "Stop"

# Start server with desktop mode env vars
$env:DESKTOP_MODE = "1"
$env:DESKTOP_AUTH_TOKEN = "test-token-123"
$env:FFMPEG_BINARY_PATH = "ffmpeg"
$env:FFMPEG_ENCODER = "h264_nvenc"

$serverJob = Start-Job -ScriptBlock {
    param($path)
    Set-Location $path
    npm run server
} -ArgumentList "D:\Vibe Code\Ver 0.1\ResizeVideo-0.1.0"

# Wait for server to start
Start-Sleep -Seconds 5

# Test health endpoint
try {
    $health = Invoke-RestMethod -Uri 'http://localhost:3001/api/health' -Method Get
    Write-Host "Health response:"
    $health | ConvertTo-Json
    
    Write-Host "`nTesting auth endpoint..."
    
    # Test without auth (should get 401)
    try {
        $noAuth = Invoke-WebRequest -Uri 'http://localhost:3001/api/jobs/test-123' -Method Get -ErrorAction SilentlyContinue
        Write-Host "No auth response status: $($noAuth.StatusCode)"
    } catch {
        Write-Host "No auth response status: $($_.Exception.Response.StatusCode.value__)"
    }
    
    # Test with invalid auth
    try {
        $invalidAuth = Invoke-WebRequest -Uri 'http://localhost:3001/api/jobs/test-123' -Method Get -Headers @{Authorization="Bearer invalid"} -ErrorAction SilentlyContinue
        Write-Host "Invalid auth response status: $($invalidAuth.StatusCode)"
    } catch {
        Write-Host "Invalid auth response status: $($_.Exception.Response.StatusCode.value__)"
    }
    
} catch {
    Write-Host "Error: $_"
}

# Cleanup
Stop-Job -Job $serverJob -ErrorAction SilentlyContinue
Remove-Job -Job $serverJob -ErrorAction SilentlyContinue
