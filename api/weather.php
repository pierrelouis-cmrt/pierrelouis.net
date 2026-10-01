<?php

declare(strict_types=1);

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_FRESH_TTL_SECONDS = 900;
const WEATHER_STALE_TTL_SECONDS = 10800;
const WEATHER_REQUEST_TIMEOUT_SECONDS = 5;

function respond_weather(array $payload, int $status = 200, int $maxAge = 300): never
{
    http_response_code($status);
    header($status === 200
        ? sprintf('Cache-Control: public, max-age=%d', $maxAge)
        : 'Cache-Control: no-store');
    header('Content-Type: application/json; charset=utf-8');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function normalize_weather(array $data): array
{
    $temperature = filter_var(
        $data['current']['temperature_2m'] ?? null,
        FILTER_VALIDATE_FLOAT,
    );
    $weatherCode = filter_var(
        $data['current']['weather_code'] ?? null,
        FILTER_VALIDATE_INT,
    );

    if ($temperature === false || $weatherCode === false) {
        throw new RuntimeException('Open-Meteo returned invalid current weather');
    }

    return [
        'current' => [
            'temperature_2m' => (float) $temperature,
            'weather_code' => (int) $weatherCode,
        ],
        'stale' => false,
    ];
}

function read_weather_cache(string $cacheFile): ?array
{
    if (!is_file($cacheFile)) {
        return null;
    }

    $contents = file_get_contents($cacheFile);
    $payload = is_string($contents) ? json_decode($contents, true) : null;

    if (!is_array($payload)) {
        return null;
    }

    try {
        return normalize_weather($payload);
    } catch (Throwable) {
        return null;
    }
}

function write_weather_cache(string $cacheFile, array $payload): void
{
    $temporaryFile = tempnam(dirname($cacheFile), 'pierrelouis-weather-');

    if ($temporaryFile === false) {
        throw new RuntimeException('Could not create a weather cache file');
    }

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);

    if ($json === false || file_put_contents($temporaryFile, $json) === false) {
        @unlink($temporaryFile);
        throw new RuntimeException('Could not write the weather cache');
    }

    chmod($temporaryFile, 0600);

    if (!rename($temporaryFile, $cacheFile)) {
        @unlink($temporaryFile);
        throw new RuntimeException('Could not publish the weather cache');
    }
}

function fetch_weather(): array
{
    $query = http_build_query([
        'latitude' => '45.7640',
        'longitude' => '4.8357',
        'current' => 'temperature_2m,weather_code',
    ], '', '&', PHP_QUERY_RFC3986);
    $handle = curl_init(WEATHER_API_URL . '?' . $query);

    if ($handle === false) {
        throw new RuntimeException('Could not initialize cURL');
    }

    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => WEATHER_REQUEST_TIMEOUT_SECONDS,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'pierrelouis.net-weather-proxy/1.0',
    ]);

    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $error = curl_error($handle);
    curl_close($handle);

    if (!is_string($body) || $status !== 200) {
        throw new RuntimeException(
            $error !== '' ? $error : sprintf('Open-Meteo returned HTTP %d', $status),
        );
    }

    $data = json_decode($body, true);

    if (!is_array($data) || isset($data['error'])) {
        throw new RuntimeException('Open-Meteo returned an API error');
    }

    return normalize_weather($data);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    respond_weather(['error' => 'method_not_allowed'], 405);
}

$cacheFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pierrelouis-weather-v2.json';
$cache = read_weather_cache($cacheFile);
$cacheModifiedAt = is_file($cacheFile) ? filemtime($cacheFile) : false;
$cacheAge = $cacheModifiedAt !== false ? time() - $cacheModifiedAt : PHP_INT_MAX;

if ($cache !== null && $cacheAge < WEATHER_FRESH_TTL_SECONDS) {
    respond_weather($cache);
}

try {
    $weather = fetch_weather();

    try {
        write_weather_cache($cacheFile, $weather);
    } catch (Throwable $cacheError) {
        error_log('Weather cache: ' . $cacheError->getMessage());
    }

    respond_weather($weather);
} catch (Throwable $error) {
    error_log('Weather proxy: ' . $error->getMessage());

    if ($cache !== null && $cacheAge < WEATHER_STALE_TTL_SECONDS) {
        $cache['stale'] = true;
        respond_weather($cache, 200, 60);
    }

    respond_weather(['error' => 'temporarily_unavailable'], 502);
}
