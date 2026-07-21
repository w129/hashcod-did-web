<?php
/**
 * PHP built-in server router:
 *   php -S 127.0.0.1:8788 router.php
 */
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if ($uri === '/api' || str_starts_with($uri, '/api/')) {
    require __DIR__ . '/server/api/index.php';
    return true;
}

if ($uri === '/did.json' || $uri === '/.well-known/did.json') {
    $candidates = [
        __DIR__ . '/did.json',
        __DIR__ . '/server/public/did.json',
        __DIR__ . '/gh-pages/did.json',
    ];
    foreach ($candidates as $p) {
        if (is_file($p)) {
            header('Content-Type: application/json; charset=utf-8');
            header('Access-Control-Allow-Origin: *');
            readfile($p);
            return true;
        }
    }
}

if (str_starts_with($uri, '/data/')) {
    $rel = substr($uri, 6);
    $rel = str_replace(['..', '\\'], ['', '/'], $rel);
    $path = __DIR__ . '/server/data/' . $rel;
    if (is_file($path)) {
        $ext = pathinfo($path, PATHINFO_EXTENSION);
        $map = [
            'json' => 'application/json; charset=utf-8',
            'txt' => 'text/plain; charset=utf-8',
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'html' => 'text/html; charset=utf-8',
        ];
        header('Content-Type: ' . ($map[$ext] ?? 'application/octet-stream'));
        header('Access-Control-Allow-Origin: *');
        readfile($path);
        return true;
    }
    http_response_code(404);
    echo 'not found';
    return true;
}

// static UI
$file = __DIR__ . '/static' . ($uri === '/' ? '/index.html' : $uri);
if ($uri === '/' || is_file($file)) {
    if ($uri === '/') {
        $file = __DIR__ . '/static/index.html';
    }
    if (is_file($file)) {
        $ext = pathinfo($file, PATHINFO_EXTENSION);
        $map = [
            'html' => 'text/html; charset=utf-8',
            'css' => 'text/css; charset=utf-8',
            'js' => 'application/javascript; charset=utf-8',
            'json' => 'application/json; charset=utf-8',
        ];
        header('Content-Type: ' . ($map[$ext] ?? 'application/octet-stream'));
        readfile($file);
        return true;
    }
}

return false;
