[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,

  [string]$WorkspaceRoot = '',

  [int]$MaxDimension = 1920,

  [ValidateRange(1, 100)]
  [int]$JpegQuality = 82
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Get-NaturalSortKey {
  param([string]$Value)

  return [regex]::Replace($Value, '\d+', {
    param($match)
    $match.Value.PadLeft(12, '0')
  })
}

function Assert-WorkspaceChild {
  param(
    [string]$Candidate,
    [string]$Root
  )

  $normalRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
  $normalCandidate = [System.IO.Path]::GetFullPath($Candidate)
  if (-not $normalCandidate.StartsWith($normalRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside the workspace: $normalCandidate"
  }
}

function Set-ImageOrientation {
  param([System.Drawing.Image]$Image)

  try {
    if (-not ($Image.PropertyIdList -contains 0x0112)) {
      return
    }

    $orientation = $Image.GetPropertyItem(0x0112).Value[0]
    switch ($orientation) {
      2 { $Image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
      3 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
      4 { $Image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY) }
      5 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
      6 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
      7 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
      8 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
    }
  }
  catch {
    Write-Warning "Could not read EXIF orientation: $($_.Exception.Message)"
  }
}

function Convert-ProjectPhoto {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [int]$Dimension,
    [int]$Quality,
    [System.Drawing.Imaging.ImageCodecInfo]$JpegCodec
  )

  $source = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    Set-ImageOrientation -Image $source

    $largestSide = [math]::Max($source.Width, $source.Height)
    $scale = if ($largestSide -gt $Dimension) { $Dimension / $largestSide } else { 1.0 }
    $width = [math]::Max(1, [math]::Round($source.Width * $scale))
    $height = [math]::Max(1, [math]::Round($source.Height * $scale))

    $bitmap = New-Object System.Drawing.Bitmap(
      $width,
      $height,
      [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
    )
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $width, $height)
      }
      finally {
        $graphics.Dispose()
      }

      $encoderParameters = New-Object System.Drawing.Imaging.EncoderParameters(1)
      try {
        $qualityParameter = New-Object System.Drawing.Imaging.EncoderParameter(
          [System.Drawing.Imaging.Encoder]::Quality,
          [long]$Quality
        )
        try {
          $encoderParameters.Param[0] = $qualityParameter
          $bitmap.Save($DestinationPath, $JpegCodec, $encoderParameters)
        }
        finally {
          $qualityParameter.Dispose()
        }
      }
      finally {
        $encoderParameters.Dispose()
      }
    }
    finally {
      $bitmap.Dispose()
    }
  }
  finally {
    $source.Dispose()
  }
}

$sourceRootPath = (Resolve-Path -LiteralPath $SourceRoot).Path
if (-not $WorkspaceRoot) {
  $WorkspaceRoot = Split-Path -Parent $PSScriptRoot
}
$workspaceRootPath = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$contentPath = Join-Path $workspaceRootPath 'storage\data\site-content.json'
$stagingRoot = Join-Path $workspaceRootPath '.tmp-project-photo-import'
$stagingGalleryRoot = Join-Path $stagingRoot 'portfolio-2026'
$manifestPath = Join-Path $stagingRoot 'manifest.json'

Assert-WorkspaceChild -Candidate $stagingRoot -Root $workspaceRootPath
if (Test-Path -LiteralPath $stagingRoot) {
  Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}
[System.IO.Directory]::CreateDirectory($stagingGalleryRoot) | Out-Null

$content = Get-Content -LiteralPath $contentPath -Raw -Encoding UTF8 | ConvertFrom-Json
$projects = @($content.horizontalGallery.items | Sort-Object { [int]$_.order })
if ($projects.Count -ne 22) {
  throw "Expected 22 projects in site-content.json, found $($projects.Count)."
}

$projectsByOrder = @{}
$projectsById = @{}
foreach ($project in $projects) {
  $projectsByOrder[[int]$project.order] = $project
  $projectsById[[string]$project.id] = $project
}

$imageExtensions = @('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff')
$sourceFoldersByOrder = @{}
$records = New-Object System.Collections.Generic.List[object]

foreach ($folder in (Get-ChildItem -LiteralPath $sourceRootPath -Directory -Force)) {
  if ($folder.Name -notmatch '^(\d{2})\s*-') {
    continue
  }

  $order = [int]$Matches[1]
  if (-not $projectsByOrder.ContainsKey($order)) {
    throw "No project matches source folder order $order ($($folder.Name))."
  }

  $project = $projectsByOrder[$order]
  $sourceFoldersByOrder[$order] = $folder
  $files = @(Get-ChildItem -LiteralPath $folder.FullName -File -Recurse -Force |
    Where-Object { $imageExtensions -contains $_.Extension.ToLowerInvariant() } |
    Sort-Object @{ Expression = { Get-NaturalSortKey $_.Name } }, FullName)

  foreach ($file in $files) {
    $records.Add([pscustomobject]@{
      SourceProjectId = [string]$project.id
      SourceProjectOrder = $order
      SourceFolder = $folder.Name
      Name = $file.Name
      SourcePath = $file.FullName
      Hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
    })
  }
}

for ($order = 1; $order -le $projects.Count; $order += 1) {
  if (-not $sourceFoldersByOrder.ContainsKey($order)) {
    throw "Missing source folder with order $order."
  }
}

# These three files exist in both Marconi and Sole. Each hash is published once.
$duplicateOwnerByFile = @{
  'WhatsApp Image 2024-09-26 at 13.03.52_1c75669a.jpg' = 'marconi-italy'
  'WhatsApp Image 2024-09-26 at 13.04.10_5a236e85.jpg' = 'marconi-italy'
  'WhatsApp Image 2024-09-26 at 13.04.10_c60871a7.jpg' = 'sole-italy'
}

$selectedRecords = New-Object System.Collections.Generic.List[object]
foreach ($group in ($records | Group-Object Hash)) {
  $groupRecords = @($group.Group | Sort-Object SourceProjectOrder, SourcePath)
  if ($groupRecords.Count -eq 1) {
    $selectedRecords.Add($groupRecords[0])
    continue
  }

  $ownerId = $duplicateOwnerByFile[[string]$groupRecords[0].Name]
  $selected = if ($ownerId) {
    @($groupRecords | Where-Object { $_.SourceProjectId -eq $ownerId })[0]
  }
  else {
    $groupRecords[0]
  }

  if (-not $selected) {
    throw "Could not select an owner for duplicate file $($groupRecords[0].Name)."
  }
  $selectedRecords.Add($selected)
}

# Source folders without photos receive three broad, non-identifying frames.
$fallbackSpecs = @(
  [pscustomobject]@{ TargetId = 'pfv-guillena-spain'; SourceId = 'burgos-spain'; FileName = 'spania burgos (1).jpeg' },
  [pscustomobject]@{ TargetId = 'pfv-guillena-spain'; SourceId = 'burgos-spain'; FileName = 'spania burgos (25).jpeg' },
  [pscustomobject]@{ TargetId = 'pfv-guillena-spain'; SourceId = 'burgos-spain'; FileName = 'spania burgos (4).jpeg' },
  [pscustomobject]@{ TargetId = 'ottana-italy'; SourceId = 'valter-maracineanu-romania'; FileName = 'valter (1).png' },
  [pscustomobject]@{ TargetId = 'ottana-italy'; SourceId = 'valter-maracineanu-romania'; FileName = 'valter (4).jpg' },
  [pscustomobject]@{ TargetId = 'ottana-italy'; SourceId = 'valter-maracineanu-romania'; FileName = 'valter 1 (1).jpg' },
  [pscustomobject]@{ TargetId = 'sandalia-cagliari-italy'; SourceId = 'codigoro-italy'; FileName = '2.jpg' },
  [pscustomobject]@{ TargetId = 'sandalia-cagliari-italy'; SourceId = 'codigoro-italy'; FileName = '6.jpg' },
  [pscustomobject]@{ TargetId = 'sandalia-cagliari-italy'; SourceId = 'valter-maracineanu-romania'; FileName = 'valter (2).png' },
  [pscustomobject]@{ TargetId = 'celeste-italy'; SourceId = 'anguillara-italy'; FileName = 'WhatsApp Image 2024-09-26 at 13.04.19_a82a9ad5.jpg' },
  [pscustomobject]@{ TargetId = 'celeste-italy'; SourceId = 'anguillara-italy'; FileName = 'WhatsApp Image 2024-09-26 at 13.04.20_a30aec9e.jpg' },
  [pscustomobject]@{ TargetId = 'celeste-italy'; SourceId = 'anguillara-italy'; FileName = 'WhatsApp Image 2024-09-26 at 13.04.21_05a014ba.jpg' },
  [pscustomobject]@{ TargetId = 'it003-piombino-italy'; SourceId = 'anguillara-italy'; FileName = 'WhatsApp Image 2024-09-26 at 13.04.22_66f56f12.jpg' },
  [pscustomobject]@{ TargetId = 'it003-piombino-italy'; SourceId = 'anguillara-italy'; FileName = 'WhatsApp Image 2024-09-26 at 13.04.23_4319480c.jpg' },
  [pscustomobject]@{ TargetId = 'it003-piombino-italy'; SourceId = 'anguillara-italy'; FileName = 'WhatsApp Image 2024-09-26 at 13.04.24_c87bc2f2.jpg' },
  [pscustomobject]@{ TargetId = 'rinnovabili-italy'; SourceId = 'butimanu-romania'; FileName = 'butimanu 2 (10).jpg' },
  [pscustomobject]@{ TargetId = 'rinnovabili-italy'; SourceId = 'burgos-spain'; FileName = 'WhatsApp Image 2026-08-26 at 16.15.35 (1).jpeg' },
  [pscustomobject]@{ TargetId = 'rinnovabili-italy'; SourceId = 'bombardia-palencia-spain'; FileName = 'Palencia (4 of 153).jpg' }
)

$assignmentsByProject = @{}
foreach ($project in $projects) {
  $assignmentsByProject[[string]$project.id] = New-Object System.Collections.Generic.List[object]
}

$reservedPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
$fallbackRecords = New-Object System.Collections.Generic.List[object]
foreach ($spec in $fallbackSpecs) {
  if (-not $projectsById.ContainsKey([string]$spec.TargetId)) {
    throw "Unknown fallback target $($spec.TargetId)."
  }

  $matches = @($selectedRecords | Where-Object {
    $_.SourceProjectId -eq $spec.SourceId -and $_.Name -ieq $spec.FileName
  })
  if ($matches.Count -ne 1) {
    throw "Expected one fallback source $($spec.SourceId)/$($spec.FileName), found $($matches.Count)."
  }

  $record = $matches[0]
  if (-not $reservedPaths.Add([string]$record.SourcePath)) {
    throw "Fallback source was selected twice: $($record.SourcePath)"
  }
  $fallbackRecords.Add([pscustomobject]@{
    TargetId = [string]$spec.TargetId
    Record = $record
  })
}

foreach ($record in $selectedRecords) {
  if ($reservedPaths.Contains([string]$record.SourcePath)) {
    continue
  }
  $assignmentsByProject[[string]$record.SourceProjectId].Add([pscustomobject]@{
    Record = $record
    Representative = $false
  })
}

foreach ($fallback in $fallbackRecords) {
  $assignmentsByProject[[string]$fallback.TargetId].Add([pscustomobject]@{
    Record = $fallback.Record
    Representative = $true
  })
}

$assignedHashes = New-Object 'System.Collections.Generic.HashSet[string]'
$assignedCount = 0
foreach ($project in $projects) {
  $projectAssignments = @($assignmentsByProject[[string]$project.id] | ForEach-Object { $_ })
  if ($projectAssignments.Count -eq 0) {
    throw "Project $($project.id) has no assigned photos."
  }

  foreach ($assignment in $projectAssignments) {
    $assignedCount += 1
    if (-not $assignedHashes.Add([string]$assignment.Record.Hash)) {
      throw "Duplicate image content assigned to more than one project: $($assignment.Record.SourcePath)"
    }
  }
}

if ($assignedCount -ne $selectedRecords.Count) {
  throw "Assigned $assignedCount photos, expected $($selectedRecords.Count)."
}

$coverFileByProject = @{
  'butimanu-romania' = 'IMG_6109.jpg'
  'corbii-mari-romania' = 'post 2.jpg'
  'pfv-guillena-spain' = 'spania burgos (1).jpeg'
  'burgos-spain' = 'WhatsApp Image 2026-08-26 at 16.15.35 (3).jpeg'
  'valter-maracineanu-romania' = 'valter 1 (3).jpg'
  'ottana-italy' = 'valter (1).png'
  'codigoro-italy' = 'Grenntech (4 of 20).jpg'
  'sunkingdom-giurgiu-romania' = 'IMG_2415.jpg'
  'pielesti-robanesti-craiova-romania' = 'Craiova (36 of 112).jpg'
  'anguillara-italy' = 'WhatsApp Image 2024-09-26 at 13.04.20_75c23c15.jpg'
  'marconi-italy' = 'WhatsApp Image 2024-09-26 at 13.03.52_1c75669a.jpg'
  'sandalia-cagliari-italy' = '2.jpg'
  'pontinia-italy' = 'WhatsApp Image 2024-09-26 at 13.04.05_29e4ec47.jpg'
  'sole-italy' = 'WhatsApp Image 2024-09-26 at 13.04.10_c60871a7.jpg'
  'celeste-italy' = 'WhatsApp Image 2024-09-26 at 13.04.19_a82a9ad5.jpg'
  'bombardia-palencia-spain' = 'Palencia (13 of 153).jpg'
  'maas-catania-italy' = 'Catania (49 of 247).jpg'
  'it003-piombino-italy' = 'WhatsApp Image 2024-09-26 at 13.04.22_66f56f12.jpg'
  'rinnovabili-italy' = 'butimanu 2 (10).jpg'
  'volta-italy' = 'WhatsApp Image 2024-09-26 at 13.03.40_e2f044b2.jpg'
  'porto-torres-italy' = 'WhatsApp Image 2024-09-26 at 13.04.13_a699fb2c.jpg'
  'sabaudia-italy' = 'WhatsApp Image 2024-09-26 at 13.04.10_5c9c80b3.jpg'
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' } |
  Select-Object -First 1
if (-not $jpegCodec) {
  throw 'JPEG encoder is unavailable.'
}

$manifestProjects = New-Object System.Collections.Generic.List[object]
$processed = 0
foreach ($project in $projects) {
  $projectId = [string]$project.id
  $coverFile = [string]$coverFileByProject[$projectId]
  if (-not $coverFile) {
    throw "Missing cover selection for $projectId."
  }

  $orderedAssignments = @($assignmentsByProject[$projectId] |
    Sort-Object @{ Expression = { Get-NaturalSortKey $_.Record.Name } }, @{ Expression = { $_.Record.SourcePath } })
  $coverMatches = @($orderedAssignments | Where-Object { $_.Record.Name -ieq $coverFile })
  if ($coverMatches.Count -ne 1) {
    throw "Expected one cover named $coverFile for $projectId, found $($coverMatches.Count)."
  }

  $coverAssignment = $coverMatches[0]
  $orderedAssignments = @($coverAssignment) + @($orderedAssignments | Where-Object {
    $_.Record.SourcePath -ne $coverAssignment.Record.SourcePath
  })

  $projectOutputDirectory = Join-Path $stagingGalleryRoot $projectId
  [System.IO.Directory]::CreateDirectory($projectOutputDirectory) | Out-Null
  $gallery = New-Object System.Collections.Generic.List[object]

  for ($index = 0; $index -lt $orderedAssignments.Count; $index += 1) {
    $assignment = $orderedAssignments[$index]
    $outputName = '{0}-{1:D3}.jpg' -f $projectId, ($index + 1)
    $destinationPath = Join-Path $projectOutputDirectory $outputName
    Convert-ProjectPhoto `
      -SourcePath $assignment.Record.SourcePath `
      -DestinationPath $destinationPath `
      -Dimension $MaxDimension `
      -Quality $JpegQuality `
      -JpegCodec $jpegCodec

    $processed += 1
    if ($processed % 10 -eq 0 -or $processed -eq $assignedCount) {
      Write-Progress `
        -Activity 'Optimizing project photos' `
        -Status "$processed / $assignedCount" `
        -PercentComplete (($processed / $assignedCount) * 100)
      Write-Output "Processed $processed / $assignedCount"
    }

    $publicPath = "/projects/portfolio-2026/$projectId/$outputName"
    $alt = if ($assignment.Representative) {
      "Lucrari fotovoltaice Greentech - imagine reprezentativa pentru $($project.title), cadrul $($index + 1)"
    }
    else {
      "$($project.title) - fotografie $($index + 1) din santier"
    }

    $galleryEntry = [ordered]@{
      src = $publicPath
      alt = $alt
    }
    if ($assignment.Representative) {
      $galleryEntry.representative = $true
    }
    $gallery.Add([pscustomobject]$galleryEntry)
  }

  $sourceFolder = $sourceFoldersByOrder[[int]$project.order]
  $manifestProjects.Add([pscustomobject][ordered]@{
    id = $projectId
    title = [string]$project.title
    sourceFolder = [string]$sourceFolder.Name
    cover = [string]$gallery[0].src
    gallery = @($gallery | ForEach-Object { $_ })
    sourcePhotoCount = @($orderedAssignments | Where-Object { -not $_.Representative }).Count
    representativePhotoCount = @($orderedAssignments | Where-Object { $_.Representative }).Count
  })
}

Write-Progress -Activity 'Optimizing project photos' -Completed
$outputFiles = @(Get-ChildItem -LiteralPath $stagingGalleryRoot -File -Recurse)
$manifest = [pscustomobject][ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  sourceRoot = $sourceRootPath
  maxDimension = $MaxDimension
  jpegQuality = $JpegQuality
  sourceFileCount = $records.Count
  uniquePhotoCount = $selectedRecords.Count
  duplicateFilesRemoved = $records.Count - $selectedRecords.Count
  outputSizeBytes = ($outputFiles | Measure-Object Length -Sum).Sum
  projects = @($manifestProjects | ForEach-Object { $_ })
}

$json = $manifest | ConvertTo-Json -Depth 12
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestPath, $json + [Environment]::NewLine, $utf8WithoutBom)

Write-Output "Manifest: $manifestPath"
Write-Output "Photos: $($outputFiles.Count)"
Write-Output ('Output size: {0:N1} MB' -f ($manifest.outputSizeBytes / 1MB))
