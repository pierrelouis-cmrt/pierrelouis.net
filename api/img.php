<?php
// public_html/api/img.php
declare(strict_types=1);

// Minimal image proxy + transformer with on-disk caching and redirect-to-static
// Designed to keep PHP worker time minimal on Hostinger (25 workers).

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

$fmt = strtolower((string)($_GET['fmt'] ?? 'auto'));
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
$supportsAVIF = function_exists('imageavif'); // rarely available

function choose_format(string $fmt, bool $supportsWebP, bool $supportsAVIF): array {
  $fmt = strtolower($fmt);
  if ($fmt === 'auto') {
    if ($supportsAVIF) return ['avif', 'image/avif'];
    if ($supportsWebP) return ['webp', 'image/webp'];
    return ['jpeg', 'image/jpeg'];
  }
  return match ($fmt) {
    'avif' => $supportsAVIF ? ['avif', 'image/avif'] : ['jpeg', 'image/jpeg'],
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

// If cached file exists, respond with a 301 redirect to static file so Apache serves it.
if (is_file($cacheFile)) {
  header('Cache-Control: public, max-age=31536000, immutable');
  header('Location: ' . '/_cache/img/' . basename($cacheFile));
  http_response_code(301);
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
  case 'avif':
    if ($supportsAVIF) { $ok = imageavif($im, null, $q); }
    break;
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
if ($lock) { flock($lock, LOCK_UN); fclose($lock); @unlink($lockFile); }

// Redirect to static file so future hits bypass PHP
header('Cache-Control: public, max-age=31536000, immutable');
header('Location: ' . '/_cache/img/' . basename($cacheFile));
http_response_code(301);
exit;

