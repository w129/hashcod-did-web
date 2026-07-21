<?php
/**
 * Simple router: serve SPA static or proxy API.
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = preg_replace('#^/.*public#', '', $uri) ?: $uri;

// API
if (str_starts_with($uri, '/api')) {
    require dirname(__DIR__) . '/api/index.php';
    exit;
}

// did.json
if ($uri === '/did.json' || $uri === '/.well-known/did.json') {
    $p = __DIR__ . '/did.json';
    if (!is_file($p)) {
        $p = dirname(__DIR__, 2) . '/did.json';
    }
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    readfile(is_file($p) ? $p : __DIR__ . '/did.fallback.json');
    exit;
}

// data files
if (str_starts_with($uri, '/data/')) {
    $rel = substr($uri, 6);
    $rel = str_replace(['..', '\\'], ['', '/'], $rel);
    $path = dirname(__DIR__) . '/data/' . $rel;
    if (is_file($path)) {
        $ext = pathinfo($path, PATHINFO_EXTENSION);
        $types = [
            'json' => 'application/json; charset=utf-8',
            'txt' => 'text/plain; charset=utf-8',
            'html' => 'text/html; charset=utf-8',
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
        ];
        header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
        header('Access-Control-Allow-Origin: *');
        readfile($path);
        exit;
    }
    http_response_code(404);
    echo 'not found';
    exit;
}

// static frontend
$static = dirname(__DIR__, 2) . '/static/index.html';
if (is_file($static)) {
    header('Content-Type: text/html; charset=utf-8');
    readfile($static);
    exit;
}

header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><html><body style="font-family:Consolas,monospace;background:#fff;color:#000">';
echo '<h1>HASHCOD did:web</h1><p>API: <code>/api?action=status</code></p>';
echo '<p>DID: <code>/did.json</code></p></body></html>';
