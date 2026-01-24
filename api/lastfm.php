<?php
// public_html/api/lastfm.php
declare(strict_types=1);

// ---- Config ----
$cfg = require dirname(__DIR__, 1) . '/../secrets/lastfm.php';
$API_KEY = $cfg['LASTFM_API_KEY'] ?? '';
$BASE = 'https://ws.audioscrobbler.com/2.0/';
$USER = 'pierrelouis-c';

// CORS (restrict to your domain in production)
header('Access-Control-Allow-Origin: https://pierrelouis.net');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
header('Content-Type: application/json; charset=utf-8');

// Only GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405); echo json_encode(['error'=>'method_not_allowed']); exit;
}

// --- tiny cache (filesystem) ---
function cache_dir(): string {
  $dir = __DIR__ . '/../_cache';
  if (!is_dir($dir)) @mkdir($dir, 0755, true);
  return $dir;
}
function cache_get(string $key, int $ttl): ?string {
  $file = cache_dir() . '/' . md5($key) . '.json';
  if (is_file($file) && (time() - filemtime($file) < $ttl)) {
    return file_get_contents($file);
  }
  return null;
}
function cache_put(string $key, string $data): void {
  $file = cache_dir() . '/' . md5($key) . '.json';
  @file_put_contents($file, $data, LOCK_EX);
}

// --- HTTP GET via cURL ---
function http_get(string $url, int $timeout = 8): array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => $timeout,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_USERAGENT => 'lastfm-proxy/1.0',
  ]);
  $body = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  if ($body === false || $code >= 500) throw new RuntimeException($err ?: "HTTP $code");
  return [$code, $body];
}

// --- Router ---
$endpoint = $_GET['endpoint'] ?? '';
try {
  if ($endpoint === 'now-playing') {
    // Cache it briefly to slash API calls
    $qs = http_build_query([
      'method' => 'user.getrecenttracks',
      'user'   => $USER,
      'api_key'=> $API_KEY,
      'format' => 'json',
      'limit'  => 1,
    ]);
    $url = $BASE . '?' . $qs;

    $cacheKey = "now_playing:$USER";
    if (($cached = cache_get($cacheKey, 10)) !== null) { echo $cached; exit; }

    [, $body] = http_get($url);
    cache_put($cacheKey, $body);
    echo $body;
    exit;

  } elseif ($endpoint === 'cover') {
    $artist = trim((string)($_GET['artist'] ?? ''));
    $track  = trim((string)($_GET['track']  ?? ''));
    if ($artist === '' || $track === '') {
      http_response_code(400); echo json_encode(['error'=>'artist_and_track_required']); exit;
    }

    $qs = http_build_query([
      'method' => 'track.getInfo',
      'artist' => $artist,
      'track'  => $track,
      'api_key'=> $API_KEY,
      'format' => 'json',
    ]);
    $url = $BASE . '?' . $qs;

    $cacheKey = "cover:$artist|$track";
    if (($cached = cache_get($cacheKey, 300)) !== null) { echo $cached; exit; }

    [, $body] = http_get($url);
    cache_put($cacheKey, $body);
    echo $body;
    exit;

  } else {
    http_response_code(404); echo json_encode(['error'=>'unknown_endpoint']); exit;
  }
} catch (Throwable $e) {
  http_response_code(502);
  echo json_encode(['error' => 'upstream_error']);
}
