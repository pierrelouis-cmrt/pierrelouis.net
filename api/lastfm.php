<?php

declare(strict_types=1);

const LASTFM_API_URL = 'https://ws.audioscrobbler.com/2.0/';
const FRESH_TTL_SECONDS = 15;
const STALE_TTL_SECONDS = 21600;
const REQUEST_TIMEOUT_SECONDS = 8;
const PLACEHOLDER_IMAGE_HASH = '2a96cbd8b46e442fc41c2b86b821562f';

header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
header('Cross-Origin-Resource-Policy: same-origin');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function is_allowed_url(string $value, string $allowedHost): bool
{
    $parts = parse_url($value);

    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https') {
        return false;
    }

    $host = strtolower((string) ($parts['host'] ?? ''));
    return $host === $allowedHost || str_ends_with($host, '.' . $allowedHost);
}

function find_artwork(mixed $images): string
{
    if (!is_array($images)) {
        return '';
    }

    for ($index = count($images) - 1; $index >= 0; $index -= 1) {
        $candidate = trim((string) ($images[$index]['#text'] ?? ''));

        if (
            $candidate !== '' &&
            !str_contains($candidate, PLACEHOLDER_IMAGE_HASH) &&
            (
                is_allowed_url($candidate, 'lastfm.freetls.fastly.net') ||
                is_allowed_url($candidate, 'lastfm-img.freetls.fastly.net') ||
                is_allowed_url($candidate, 'lastfm-img2.akamaized.net')
            )
        ) {
            return $candidate;
        }
    }

    return '';
}

function normalize_lastfm_response(array $data, int $fetchedAt): array
{
    $tracks = $data['recenttracks']['track'] ?? [];
    $track = is_array($tracks) ? ($tracks[0] ?? null) : null;

    if (!is_array($track)) {
        return [
            'track' => null,
            'stale' => false,
            'updatedAt' => gmdate(DATE_ATOM, $fetchedAt),
        ];
    }

    $name = trim((string) ($track['name'] ?? ''));
    $artist = trim((string) ($track['artist']['#text'] ?? ''));

    if ($name === '' || $artist === '') {
        throw new RuntimeException('Last.fm response did not contain a valid track');
    }

    $trackUrl = trim((string) ($track['url'] ?? ''));
    $playedAt = filter_var($track['date']['uts'] ?? null, FILTER_VALIDATE_INT);

    return [
        'track' => [
            'name' => $name,
            'artist' => $artist,
            'album' => trim((string) ($track['album']['#text'] ?? '')),
            'url' => is_allowed_url($trackUrl, 'last.fm') ? $trackUrl : '',
            'image' => find_artwork($track['image'] ?? []),
            'nowPlaying' => ($track['@attr']['nowplaying'] ?? '') === 'true',
            'playedAt' => $playedAt !== false
                ? gmdate(DATE_ATOM, (int) $playedAt)
                : null,
        ],
        'stale' => false,
        'updatedAt' => gmdate(DATE_ATOM, $fetchedAt),
    ];
}

function read_cache(string $cacheFile): ?array
{
    if (!is_file($cacheFile)) {
        return null;
    }

    $contents = file_get_contents($cacheFile);
    $cache = is_string($contents) ? json_decode($contents, true) : null;

    if (
        !is_array($cache) ||
        !isset($cache['fetchedAt']) ||
        !is_array($cache['payload'] ?? null)
    ) {
        return null;
    }

    return $cache;
}

function write_cache(string $cacheFile, array $cache): void
{
    $directory = dirname($cacheFile);

    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        throw new RuntimeException('Could not create the Last.fm cache directory');
    }

    $temporaryFile = tempnam($directory, 'lastfm-');

    if ($temporaryFile === false) {
        throw new RuntimeException('Could not create a Last.fm cache file');
    }

    $json = json_encode($cache, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    if ($json === false || file_put_contents($temporaryFile, $json, LOCK_EX) === false) {
        @unlink($temporaryFile);
        throw new RuntimeException('Could not write the Last.fm cache');
    }

    chmod($temporaryFile, 0640);

    if (!rename($temporaryFile, $cacheFile)) {
        @unlink($temporaryFile);
        throw new RuntimeException('Could not publish the Last.fm cache');
    }
}

function fetch_lastfm(string $apiKey, string $username): array
{
    $query = http_build_query([
        'method' => 'user.getrecenttracks',
        'user' => $username,
        'api_key' => $apiKey,
        'format' => 'json',
        'limit' => 1,
    ], '', '&', PHP_QUERY_RFC3986);

    $handle = curl_init(LASTFM_API_URL . '?' . $query);

    if ($handle === false) {
        throw new RuntimeException('Could not initialize cURL');
    }

    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => REQUEST_TIMEOUT_SECONDS,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'pierrelouis.net-lastfm-proxy/2.0',
    ]);

    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $error = curl_error($handle);
    curl_close($handle);

    if (!is_string($body) || $status !== 200) {
        throw new RuntimeException($error !== '' ? $error : 'Last.fm request failed');
    }

    $data = json_decode($body, true);

    if (!is_array($data) || isset($data['error'])) {
        throw new RuntimeException('Last.fm returned an API error');
    }

    return $data;
}

function as_stale(array $payload): array
{
    $payload['stale'] = true;

    if (is_array($payload['track'] ?? null)) {
        $payload['track']['nowPlaying'] = false;
    }

    return $payload;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    respond(['error' => 'method_not_allowed'], 405);
}

try {
    $configPath = dirname(__DIR__, 2) . '/private/lastfm.php';

    if (!is_file($configPath)) {
        throw new RuntimeException('Last.fm private config is missing');
    }

    $config = require $configPath;
    $apiKey = trim((string) ($config['api_key'] ?? ''));
    $username = trim((string) ($config['username'] ?? ''));
    $cacheFile = (string) ($config['cache_file'] ?? '');

    if ($apiKey === '' || $username === '' || $cacheFile === '') {
        throw new RuntimeException('Last.fm private config is incomplete');
    }

    $now = time();
    $cache = read_cache($cacheFile);
    $cacheAge = $cache !== null
        ? $now - (int) $cache['fetchedAt']
        : PHP_INT_MAX;

    if ($cache !== null && $cacheAge < FRESH_TTL_SECONDS) {
        respond($cache['payload']);
    }

    $lockFile = $cacheFile . '.lock';
    $lockDirectory = dirname($lockFile);

    if (!is_dir($lockDirectory) && !mkdir($lockDirectory, 0750, true) && !is_dir($lockDirectory)) {
        throw new RuntimeException('Could not create the Last.fm cache directory');
    }

    $lock = fopen($lockFile, 'c');

    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Could not lock the Last.fm cache');
    }

    try {
        $cache = read_cache($cacheFile);
        $cacheAge = $cache !== null
            ? time() - (int) $cache['fetchedAt']
            : PHP_INT_MAX;

        if ($cache !== null && $cacheAge < FRESH_TTL_SECONDS) {
            respond($cache['payload']);
        }

        $fetchedAt = time();
        $payload = normalize_lastfm_response(
            fetch_lastfm($apiKey, $username),
            $fetchedAt,
        );
        write_cache($cacheFile, [
            'fetchedAt' => $fetchedAt,
            'payload' => $payload,
        ]);
        respond($payload);
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
} catch (Throwable $error) {
    error_log('Last.fm proxy: ' . $error->getMessage());

    if (isset($cache, $cacheAge) && is_array($cache) && $cacheAge < STALE_TTL_SECONDS) {
        respond(as_stale($cache['payload']));
    }

    respond(['error' => 'temporarily_unavailable'], 502);
}
