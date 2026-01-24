<?php
// public_html/api/img.php
declare(strict_types=1);

// Minimal image proxy + transformer with on-disk caching
// Simpler pipeline: serve bytes directly (200), no redirects, default JPEG.

// ---- Helpers ----
function abort(int $code, string $msg = 'error'): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => $msg]);
  exit;
}

function cache_dir(): string {
  $dir = dirname(__DIR__, 1) . '/_cache/img';
  if (!is_dir($dir)) @mkdir($dir, 0755, true);
  return $dir;
}

function normalize_int(?string $s, int $min, int $max, int $def): int {
  if ($s === null || $s === '') return $def;
  $v = (int)$s;
  if ($v < $min) return $min;
  if ($v > $max) return $max;
  return $v;
}

// ---- Input ----
if ($_SERVER['REQUEST_METHOD'] !== 'GET') abort(405, 'method_not_allowed');

$srcRaw = $_GET['src'] ?? '';
if ($srcRaw === '') abort(400, 'src_required');

$fmt = strtolower((string)($_GET['fmt'] ?? 'jpeg'));
$w   = normalize_int($_GET['w'] ?? null, 32, 4096, 640);
$dpr = normalize_int($_GET['dpr'] ?? null, 1, 3, 1);
$q   = normalize_int($_GET['q'] ?? null, 40, 95, 80);

// Allowlist Last.fm image hosts only (tighten if needed)
$u   = parse_url($srcRaw);
if (!$u || !isset($u['scheme'], $u['host'])) abort(400, 'invalid_src');
$host = strtolower($u['host']);
$allowedHosts = [
  'lastfm.freetls.fastly.net',
  'lastfm-img2.akamaized.net',
];
if (!in_array($host, $allowedHosts, true)) abort(400, 'host_not_allowed');

// Compute target width considering DPR; do not upscale above source width later.
$targetW = $w * $dpr;

// Decide output format
$supportsWebP = function_exists('imagewebp');
$supportsAVIF = false; // disable AVIF for reliability on shared hosts

function choose_format(string $fmt, bool $supportsWebP, bool $supportsAVIF): array {
  $fmt = strtolower($fmt);
  if ($fmt === 'auto') { return ['jpeg', 'image/jpeg']; }
  return match ($fmt) {
    // 'avif' intentionally disabled
    'webp' => $supportsWebP ? ['webp', 'image/webp'] : ['jpeg', 'image/jpeg'],
    'png'  => ['png', 'image/png'],
    'jpg', 'jpeg' => ['jpeg', 'image/jpeg'],
    default => $supportsWebP ? ['webp', 'image/webp'] : ['jpeg', 'image/jpeg'],
  };
}

[$outExt, $mime] = choose_format($fmt, $supportsWebP, $supportsAVIF);

// Cache key and file paths
$cacheKey = sha1(json_encode([$srcRaw, $targetW, $outExt, $q]));
$cacheDir = cache_dir();
$cacheFile = "$cacheDir/$cacheKey.$outExt";

// If cached file exists, serve it directly with strong caching headers
if (is_file($cacheFile)) {
  $etag = 'W/"' . $cacheKey . '"';
  header('ETag: ' . $etag);
  header('Cache-Control: public, max-age=31536000, immutable');
  header('Content-Type: ' . $mime);
  header('Content-Length: ' . filesize($cacheFile));
  header('Content-Disposition: inline; filename="cover.' . $outExt . '"');
  if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit;
  }
  readfile($cacheFile);
  exit;
}

// Fetch source image (short timeout) — small CPU, early exit on failure.
$ch = curl_init($srcRaw);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 6,
  CURLOPT_CONNECTTIMEOUT => 4,
  CURLOPT_USERAGENT => 'img-proxy/1.0 (+pierrelouis.net)',
]);
$srcBody = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($srcBody === false || $code >= 400) {
  // Graceful fallback: redirect to original to avoid broken LCP
  header('Cache-Control: public, max-age=60');
  header('Location: ' . $srcRaw);
  http_response_code(302);
  exit;
}

// Decode
$im = @imagecreatefromstring($srcBody);
if (!$im) {
  header('Cache-Control: public, max-age=60');
  header('Location: ' . $srcRaw);
  http_response_code(302);
  exit;
}

$srcW = imagesx($im);
$srcH = imagesy($im);

// Compute final width without upscaling
$finalW = min($targetW, $srcW);
if ($finalW < 1) $finalW = $srcW;
$finalH = (int)round($srcH * ($finalW / $srcW));

// Resize if needed
if ($finalW !== $srcW) {
  $dst = imagecreatetruecolor($finalW, $finalH);
  imagealphablending($dst, false);
  imagesavealpha($dst, true);
  imagecopyresampled($dst, $im, 0, 0, 0, 0, $finalW, $finalH, $srcW, $srcH);
  imagedestroy($im);
  $im = $dst;
}

// Ensure cache dir exists
if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);

// Prevent thundering herd on same file
$lockFile = $cacheFile . '.lock';
$lock = fopen($lockFile, 'c');
if ($lock) {
  if (!flock($lock, LOCK_EX)) { /* ignore */ }
}

// Encode and save
$ok = false;
ob_start();
switch ($outExt) {
  case 'webp':
    if ($supportsWebP) { $ok = imagewebp($im, null, $q); }
    break;
  case 'png':
    // Map quality 0-9 (invert scale)
    $level = (int)round((9 - (($q - 40) / (95 - 40)) * 9));
    if ($level < 0) $level = 0; if ($level > 9) $level = 9;
    $ok = imagepng($im, null, $level);
    break;
  case 'jpeg':
  default:
    $ok = imagejpeg($im, null, $q);
}
$blob = ob_get_clean();
imagedestroy($im);

if (!$ok || $blob === false) {
  if ($lock) { flock($lock, LOCK_UN); fclose($lock); @unlink($lockFile); }
  header('Cache-Control: public, max-age=60');
  header('Location: ' . $srcRaw);
  http_response_code(302);
  exit;
}

// Write atomically
@file_put_contents($cacheFile, $blob, LOCK_EX);
@chmod($cacheFile, 0644);
if ($lock) { flock($lock, LOCK_UN); fclose($lock); @unlink($lockFile); }

// Serve bytes directly (no redirect)
$etag = 'W/"' . $cacheKey . '"';
header('ETag: ' . $etag);
header('Cache-Control: public, max-age=31536000, immutable');
header('Content-Type: ' . $mime);
header('Content-Length: ' . strlen($blob));
header('Content-Disposition: inline; filename="cover.' . $outExt . '"');
echo $blob;
exit;
