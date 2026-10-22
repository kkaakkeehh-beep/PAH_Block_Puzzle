param(
  [Parameter(Mandatory = $true)][string]$Root,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Port = 8731
)

# Static server for the recorder, plus an upload endpoint it posts the
# finished video back through. A server rather than file:// because the
# recorder reaches into the game in an iframe, and because a finished
# recording has no other way out of the browser.

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "serving $Root on http://localhost:$Port/ -> $OutDir"

$types = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.json' = 'application/json'
  '.xml'  = 'application/xml'
}

$running = $true
while ($running) {
  # A disposed or never-started listener would otherwise spin here forever
  # throwing the same exception, with no sign of trouble but silence.
  try { $ctx = $listener.GetContext() }
  catch { Write-Output ("[fatal] " + $_.Exception.Message); break }
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = $req.Url.AbsolutePath
    if ($req.HttpMethod -eq 'POST' -and $path -eq '/upload') {
      $name = $req.QueryString['name']
      if (-not $name) { $name = 'upload.bin' }
      $name = [IO.Path]::GetFileName($name)
      $part = $req.QueryString['part']
      $target = Join-Path $OutDir $name
      $fs = $null
      try {
        # part=0 (or no part) starts the file and later parts append, because
        # a single multi-megabyte POST is aborted partway through here.
        if ($part -and $part -ne '0') { $fs = [IO.File]::Open($target, 'Append', 'Write') }
        else { $fs = [IO.File]::Create($target) }
        $req.InputStream.CopyTo($fs)
        Write-Output ("[upload] " + $name + " now " + $fs.Length + " bytes")
      }
      finally {
        # Without this a client that goes away mid-upload leaves the handle
        # open and every later upload of that name fails to open the file.
        if ($fs) { $fs.Dispose() }
      }
      $res.StatusCode = 200
    }
    elseif ($req.HttpMethod -eq 'POST' -and $path -eq '/log') {
      $sr = New-Object IO.StreamReader($req.InputStream)
      Write-Output ("[log] " + $sr.ReadToEnd())
      $res.StatusCode = 200
    }
    elseif ($path -eq '/shutdown') {
      $running = $false
      $res.StatusCode = 200
    }
    else {
      if ($path -eq '/') { $path = '/recorder.html' }
      $file = Join-Path $Root ($path.TrimStart('/') -replace '/', '\')
      if (Test-Path $file -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($file).ToLower()
        if ($types.ContainsKey($ext)) { $res.ContentType = $types[$ext] }
        else { $res.ContentType = 'application/octet-stream' }
        $bytes = [IO.File]::ReadAllBytes($file)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      }
      else {
        Write-Output ("[404] " + $path)
        $res.StatusCode = 404
      }
    }
  }
  catch { Write-Output ("[err] " + $_.Exception.Message) }
  finally { try { $res.OutputStream.Close() } catch {} }
}
$listener.Stop()
$listener.Close()
Write-Output "server stopped"
