param(
  [string]$Lang = 'ja',
  [string]$Mode = 'fall',
  [string]$Format = 'vertical',
  [string]$EndCard = 'card',
  [int]$First = 1,
  [int]$Last = 2,
  [int]$Dpr = 2,
  [int]$Port = 8731,
  [string]$OutDir = 'C:\claude\PAH_promo\takes'
)

# Records takes of the promo clip. The bot plays Normal difficulty and the
# round sometimes still ends badly, which in a promo means the score visibly
# resetting to zero -- so this takes several and reports which were clean.
#
#     powershell -File tools/promo/record.ps1 -Lang ja -EndCard search

$ErrorActionPreference = 'Continue'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path $chrome)) { throw "Chrome not found at $chrome" }
New-Item -ItemType Directory -Force $OutDir | Out-Null

for ($i = $First; $i -le $Last; $i++) {
  $take = "$Format-$Mode-$EndCard-$Lang-t$i"
  $done = Join-Path $OutDir "done-$take.txt"
  $summary = Join-Path $OutDir "summary-$take.txt"
  $mp4 = Join-Path $OutDir "pah-$take.mp4"

  # A profile per take: sharing one makes the second launch attach to the
  # first browser instead of starting its own, and stopping the launcher then
  # leaves the real process alive to be killed mid-upload later.
  $profile = Join-Path $OutDir ".chrome-$take"
  $url = "http://localhost:$Port/recorder.html?take=$take&lang=$Lang&mode=$Mode&format=$Format&endcard=$EndCard"
  $args = @(
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    "--force-device-scale-factor=$Dpr", '--window-size=1400,1250',
    "--user-data-dir=$profile", $url
  )
  $p = Start-Process -FilePath $chrome -ArgumentList $args -PassThru
  $deadline = (Get-Date).AddSeconds(180)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    if (Test-Path $done) { break }
  }

  # Only this take's own browser, matched on its unique profile path -- never
  # a blanket "stop every chrome", which would take the user's browser too.
  Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains(".chrome-$take") } |
    ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  try { Stop-Process -Id $p.Id -Force -ErrorAction Stop } catch {}
  Remove-Item $profile -Recurse -Force -ErrorAction SilentlyContinue

  if (Test-Path $done) {
    $txt = (Get-Content $summary -Raw).Trim()
    $mb = [math]::Round((Get-Item $mp4).Length / 1MB, 2)
    Write-Output ("{0}: {1} | {2} MB" -f $take, $txt, $mb)
  }
  else {
    Write-Output ("{0}: INCOMPLETE" -f $take)
  }
  Start-Sleep -Seconds 2
}
