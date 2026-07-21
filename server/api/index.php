<?php
/**
 * HASHCOD did:web API — public only.
 * Routes: status | list_cods | list_files | list_concat | publish_cod | publish_file | concat | get
 */
require_once dirname(__DIR__) . '/lib/Store.php';
require_once dirname(__DIR__) . '/lib/Response.php';

Store::ensure();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Response::json(['ok' => true]);
}

$action = $_GET['action'] ?? $_POST['action'] ?? 'status';
$body = [];
$raw = file_get_contents('php://input');
if ($raw) {
    $j = json_decode($raw, true);
    if (is_array($j)) {
        $body = $j;
        if (isset($j['action'])) {
            $action = $j['action'];
        }
    }
}
$action = strtolower((string)$action);

try {
    switch ($action) {
        case 'status':
            Response::json(api_status());
        case 'list_cods':
        case 'cods':
            Response::json(api_list_cods());
        case 'list_files':
        case 'files':
            Response::json(api_list_files());
        case 'list_concat':
        case 'concats':
            Response::json(api_list_concat());
        case 'get':
            Response::json(api_get($body));
        case 'publish_cod':
        case 'publish':
            Response::json(api_publish_cod($body));
        case 'publish_file':
        case 'upload':
            Response::json(api_publish_file($body));
        case 'concat':
            Response::json(api_concat($body));
        case 'did':
            $didPath = dirname(__DIR__) . '/public/did.json';
            if (!is_file($didPath)) {
                $didPath = dirname(__DIR__, 2) . '/did.json';
            }
            Response::json(Store::readJson($didPath, ['error' => 'did.json missing']));
        default:
            Response::json(['ok' => false, 'error' => "unknown action: $action"], 400);
    }
} catch (Throwable $e) {
    Response::json(['ok' => false, 'error' => $e->getMessage(), 'type' => get_class($e)], 500);
}

function api_status(): array
{
    $cods = Store::path('cods');
    $files = Store::path('files');
    $concat = Store::path('concat');
    $nCod = count(glob($cods . '/*.public.cod.json') ?: []);
    $nFiles = 0;
    foreach (glob($files . '/*') ?: [] as $f) {
        if (is_file($f) && !str_ends_with($f, '.meta.json') && basename($f) !== 'index.json') {
            $nFiles++;
        }
    }
    $nConcat = count(glob($concat . '/concat_*.json') ?: []);
    return [
        'ok' => true,
        'service' => 'hashcod-did-web',
        'privacy' => 'public_only',
        'public_cods' => $nCod,
        'public_files' => $nFiles,
        'concats' => $nConcat,
        'did' => 'did:web:w129.github.io:hashcod-did-web',
        'message' => "did:web API · $nCod public cods · $nFiles files · $nConcat concats",
    ];
}

function api_list_cods(): array
{
    $idx = Store::readJson(Store::path('cods', 'index.json'), ['items' => []]);
    return ['ok' => true, 'items' => $idx['items'] ?? [], 'count' => count($idx['items'] ?? [])];
}

function api_list_files(): array
{
    $idx = Store::readJson(Store::path('files', 'index.json'), ['items' => []]);
    return ['ok' => true, 'items' => $idx['items'] ?? [], 'count' => count($idx['items'] ?? [])];
}

function api_list_concat(): array
{
    $items = [];
    foreach (glob(Store::path('concat') . '/concat_*.json') ?: [] as $f) {
        if (str_ends_with($f, '.stream.txt')) {
            continue;
        }
        $j = Store::readJson($f, []);
        $items[] = [
            'id' => basename($f),
            'title' => $j['title'] ?? basename($f),
            'created_at' => $j['created_at'] ?? null,
            'concat_sha512' => $j['concat_sha512'] ?? null,
            'public_keys_n' => count($j['public_keys_required'] ?? []),
            'parts_n' => count($j['parts'] ?? []),
        ];
    }
    usort($items, fn($a, $b) => strcmp($b['id'], $a['id']));
    return ['ok' => true, 'items' => $items, 'count' => count($items)];
}

function api_get(array $body): array
{
    $kind = $body['kind'] ?? $_GET['kind'] ?? 'cod';
    $id = $body['id'] ?? $_GET['id'] ?? '';
    if ($id === '' || str_contains($id, '..')) {
        return ['ok' => false, 'error' => 'bad id'];
    }
    $map = [
        'cod' => Store::path('cods', $id),
        'file' => Store::path('files', $id),
        'concat' => Store::path('concat', $id),
    ];
    $path = $map[$kind] ?? null;
    if (!$path || !is_file($path)) {
        return ['ok' => false, 'error' => 'not found'];
    }
    if ($kind === 'file' && !str_ends_with($id, '.json')) {
        return [
            'ok' => true,
            'kind' => 'file',
            'id' => $id,
            'bytes' => filesize($path),
            'sha512' => hash_file('sha512', $path),
            'content_base64' => base64_encode(file_get_contents($path)),
        ];
    }
    return ['ok' => true, 'kind' => $kind, 'id' => $id, 'data' => Store::readJson($path, [])];
}

function api_publish_cod(array $body): array
{
    $cod = $body['cod'] ?? $body['document'] ?? null;
    if (!$cod || !is_array($cod)) {
        return ['ok' => false, 'error' => 'cod object required (public .cod JSON)'];
    }
    $public = Store::sanitizePublic($cod);
    // If already a public bundle, keep structure
    if (($public['type'] ?? '') === 'hashcod.public_cod/v1') {
        $bundle = $public;
    } else {
        $publicKeys = [];
        $walk = function ($node, $path = []) use (&$walk, &$publicKeys) {
            if (!is_array($node)) {
                return;
            }
            foreach ($node as $k => $v) {
                $p = array_merge($path, [(string)$k]);
                if ($k === 'public_key_b64' && is_string($v) && strlen($v) > 20) {
                    $publicKeys[] = [
                        'path' => implode('.', $p),
                        'public_key_b64' => $v,
                        'alg' => 'Ed25519',
                    ];
                }
                if (is_array($v)) {
                    $walk($v, $p);
                }
            }
        };
        $walk($public);
        $seen = [];
        $uniq = [];
        foreach ($publicKeys as $k) {
            if (!isset($seen[$k['public_key_b64']])) {
                $seen[$k['public_key_b64']] = true;
                $uniq[] = $k;
            }
        }
        $bundle = [
            'type' => 'hashcod.public_cod/v1',
            'published_at' => gmdate('c'),
            'privacy' => 'public_only',
            'redaction' => [
                'policy' => 'strip_private_keys_and_secret_paths',
                'note' => 'Private keys belonging to .cod must not appear on did:web.',
            ],
            'public_keys' => $uniq,
            'cod' => $public,
            'publisher_note' => $body['note'] ?? '',
        ];
        $tmp = $bundle;
        $canon = json_encode($tmp, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $bundle['integrity'] = [
            'public_bundle_sha512' => hash('sha512', $canon),
            'original_payload_jcs_sha512' => $public['payload_jcs_sha512'] ?? $public['payload_sha512'] ?? null,
            'original_signature_ed25519_b64' => $public['signature_ed25519_b64'] ?? null,
        ];
    }

    $id = preg_replace('/[^\w.\-]+/', '_', ($body['id'] ?? 'cod')) . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(2)) . '.public.cod.json';
    $path = Store::path('cods', $id);
    Store::writeJson($path, $bundle);

    $idxPath = Store::path('cods', 'index.json');
    $idx = Store::readJson($idxPath, ['items' => []]);
    array_unshift($idx['items'], [
        'id' => $id,
        'published_at' => $bundle['published_at'] ?? gmdate('c'),
        'public_keys_n' => count($bundle['public_keys'] ?? []),
        'sha512' => $bundle['integrity']['public_bundle_sha512'] ?? null,
        'command' => $bundle['cod']['command'] ?? null,
        'note' => $body['note'] ?? '',
    ]);
    $idx['items'] = array_slice($idx['items'], 0, 500);
    $idx['updated_at'] = gmdate('c');
    $idx['count'] = count($idx['items']);
    Store::writeJson($idxPath, $idx);

    return ['ok' => true, 'id' => $id, 'public_keys' => $bundle['public_keys'] ?? [], 'message' => "published $id"];
}

function api_publish_file(array $body): array
{
    $name = $body['filename'] ?? 'upload.bin';
    if (Store::isPrivateName($name)) {
        return ['ok' => false, 'error' => 'refusing private key filename'];
    }
    $b64 = $body['content_base64'] ?? '';
    $text = $body['content'] ?? null;
    if ($b64) {
        $bin = base64_decode($b64, true);
        if ($bin === false) {
            return ['ok' => false, 'error' => 'bad base64'];
        }
    } elseif ($text !== null) {
        $bin = (string)$text;
    } else {
        return ['ok' => false, 'error' => 'content or content_base64 required'];
    }

    $safe = date('Ymd_His') . '_' . preg_replace('/[^\w.\-]+/', '_', $name);
    $path = Store::path('files', $safe);
    file_put_contents($path, $bin);
    $meta = [
        'id' => $safe,
        'title' => $body['title'] ?? $name,
        'original_name' => $name,
        'bytes' => strlen($bin),
        'sha512' => hash('sha512', $bin),
        'published_at' => gmdate('c'),
        'privacy' => 'public_file',
    ];
    Store::writeJson($path . '.meta.json', $meta);
    $idxPath = Store::path('files', 'index.json');
    $idx = Store::readJson($idxPath, ['items' => []]);
    array_unshift($idx['items'], $meta);
    $idx['items'] = array_slice($idx['items'], 0, 500);
    $idx['updated_at'] = gmdate('c');
    Store::writeJson($idxPath, $idx);
    return ['ok' => true, 'file' => $meta, 'message' => "published file $safe"];
}

function api_concat(array $body): array
{
    $fileIds = $body['file_ids'] ?? [];
    $codIds = $body['cod_ids'] ?? [];
    $title = $body['title'] ?? 'concat-public';
    if (!$fileIds && !$codIds) {
        return ['ok' => false, 'error' => 'file_ids and/or cod_ids required'];
    }

    $parts = [];
    $keys = [];
    foreach ($codIds as $cid) {
        $path = Store::path('cods', $cid);
        if (!is_file($path)) {
            $hits = glob(Store::path('cods') . '/*' . preg_replace('/[^\w.\-]+/', '', $cid) . '*');
            if (!$hits) {
                return ['ok' => false, 'error' => "public cod not found: $cid"];
            }
            $path = $hits[0];
        }
        $bundle = Store::readJson($path, []);
        $pks = $bundle['public_keys'] ?? [];
        if (!$pks) {
            return ['ok' => false, 'error' => basename($path) . ' has no public_keys — cannot concat'];
        }
        foreach ($pks as $k) {
            $keys[] = $k;
        }
        $parts[] = [
            'kind' => 'public_cod',
            'id' => basename($path),
            'sha512' => $bundle['integrity']['public_bundle_sha512'] ?? null,
            'public_keys' => $pks,
            'command' => $bundle['cod']['command'] ?? null,
        ];
    }
    foreach ($fileIds as $fid) {
        $path = Store::path('files', $fid);
        if (!is_file($path)) {
            return ['ok' => false, 'error' => "file not found: $fid"];
        }
        $bin = file_get_contents($path);
        $parts[] = [
            'kind' => 'public_file',
            'id' => basename($path),
            'sha512' => hash('sha512', $bin),
            'bytes' => strlen($bin),
        ];
    }

    $uniq = [];
    $seen = [];
    foreach ($keys as $k) {
        $pk = $k['public_key_b64'] ?? '';
        if ($pk && !isset($seen[$pk])) {
            $seen[$pk] = true;
            $uniq[] = $k;
        }
    }

    $doc = [
        'type' => 'hashcod.did_web.concat/v1',
        'title' => $title,
        'created_at' => gmdate('c'),
        'privacy' => 'public_only',
        'rule' => 'Concat requires public_keys from referenced .cod (never private keys).',
        'public_keys_required' => $uniq,
        'parts' => $parts,
    ];
    $canon = json_encode($doc, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $doc['concat_sha512'] = hash('sha512', $canon);

    $id = 'concat_' . date('Ymd_His') . '_' . bin2hex(random_bytes(3)) . '.json';
    Store::writeJson(Store::path('concat', $id), $doc);

    return [
        'ok' => true,
        'id' => $id,
        'public_keys_n' => count($uniq),
        'parts_n' => count($parts),
        'concat_sha512' => $doc['concat_sha512'],
        'message' => "concat published with " . count($uniq) . " public key(s)",
    ];
}
