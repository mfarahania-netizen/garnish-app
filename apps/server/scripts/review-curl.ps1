param(
  [Parameter(Mandatory = $true)]
  [string]$Token,
  [string]$BaseUrl = "http://localhost:3000",
  [string]$OutputPath = ".\docs\real-review-output.json"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

$result = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  baseUrl = $BaseUrl
  reviewReport = Invoke-RestMethod -Method Get -Uri "$BaseUrl/review-report" -Headers $headers
  report = Invoke-RestMethod -Method Get -Uri "$BaseUrl/report" -Headers $headers
  compare = Invoke-RestMethod -Method Get -Uri "$BaseUrl/recommendations/compare" -Headers $headers
  recommendations = Invoke-RestMethod -Method Get -Uri "$BaseUrl/recommendations?limit=10" -Headers $headers
}

$json = $result | ConvertTo-Json -Depth 20
$fullOutputPath = Join-Path (Get-Location) $OutputPath
$directory = Split-Path $fullOutputPath -Parent
if ($directory -and -not (Test-Path $directory)) {
  New-Item -ItemType Directory -Path $directory | Out-Null
}

[System.IO.File]::WriteAllText($fullOutputPath, $json, [System.Text.Encoding]::UTF8)
Write-Host "Review output written to $fullOutputPath"
