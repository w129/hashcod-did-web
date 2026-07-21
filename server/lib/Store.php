<?php
/**
 * Public data store for HASHCOD did:web (no private keys).
 */
class Store
{
    public static function root(): string
    {
        return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
    }

    public static function path(string ...$parts): string
    {
        $p = self::root();
        foreach ($parts as $part) {
            $part = str_replace(['..', '\\'], ['', '/'], $part);
            $p .= DIRECTORY_SEPARATOR . $part;
        }
        return $p;
    }

    public static function ensure(): void
    {
        foreach (['cods', 'files', 'concat'] as $d) {
            $dir = self::path($d);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
        }
    }

    public static function readJson(string $path, $default = [])
    {
        if (!is_file($path)) {
            return $default;
        }
        $j = json_decode(file_get_contents($path), true);
        return is_array($j) ? $j : $default;
    }

    public static function writeJson(string $path, $data): void
    {
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents(
            $path,
            json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n"
        );
    }

    public static function isPrivateName(string $name): bool
    {
        $n = strtolower($name);
        $blocked = [
            'private', 'private_key', 'secret', 'seed', 'master_key',
            'ed25519_private', 'hmac_secret', 'password', 'api_key',
        ];
        foreach ($blocked as $b) {
            if ($n === $b || str_contains($n, $b)) {
                return true;
            }
        }
        if (str_contains($n, '.priv') || str_contains($n, 'private.key')) {
            return true;
        }
        return false;
    }

    /** Recursively strip private-looking keys from arrays. */
    public static function sanitizePublic($obj)
    {
        if (!is_array($obj)) {
            if (is_string($obj)) {
                $low = strtolower(str_replace('\\', '/', $obj));
                foreach (['ed25519_private', 'master.key', '.ed25519.priv', 'private.key'] as $m) {
                    if (str_contains($low, $m)) {
                        return '[REDACTED_PRIVATE_PATH]';
                    }
                }
            }
            return $obj;
        }
        $isList = array_keys($obj) === range(0, count($obj) - 1);
        $out = [];
        foreach ($obj as $k => $v) {
            if (!$isList && self::isPrivateName((string)$k)) {
                continue;
            }
            $out[$k] = self::sanitizePublic($v);
        }
        return $out;
    }
}
