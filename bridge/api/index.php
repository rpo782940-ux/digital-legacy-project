<?php
/**
 * Techno Forma data bridge (HostUkraine hosting).
 *
 * The new site runs in an edge runtime that cannot open raw MySQL/TCP
 * connections, so all database access goes through this small signed HTTP
 * endpoint. It keeps two strictly separated PDO connections:
 *
 *   - catalog: masteraf_new, the old OpenCart shop. SELECT only. Every write
 *     verb is rejected before the query reaches MySQL.
 *   - shop: the new site's own database (customers, orders, cart). Full access.
 *
 * Authentication: HMAC-SHA256 over "<timestamp>.<raw body>" with the shared
 * secret, sent in X-TF-Signature together with X-TF-Timestamp.
 *
 * Request:  POST { "op": "<operation>", "params": { ... } }
 * Response: { "ok": true, "data": ... } | { "ok": false, "error": "..." }
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

function fail(int $status, string $error): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

function ok(mixed $data): never
{
    echo json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fail(500, 'config_missing');
}
/** @var array $config */
$config = require $configFile;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail(405, 'method_not_allowed');
}

$rawBody = file_get_contents('php://input') ?: '';
$timestamp = $_SERVER['HTTP_X_TF_TIMESTAMP'] ?? '';
$signature = $_SERVER['HTTP_X_TF_SIGNATURE'] ?? '';

if ($timestamp === '' || $signature === '') {
    fail(401, 'unsigned');
}
if (abs(time() - (int) $timestamp) > (int) ($config['max_skew'] ?? 300)) {
    fail(401, 'stale_request');
}

$expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, (string) $config['secret']);
if (!hash_equals($expected, $signature)) {
    fail(401, 'bad_signature');
}

$payload = json_decode($rawBody, true);
if (!is_array($payload) || !isset($payload['op']) || !is_string($payload['op'])) {
    fail(400, 'bad_request');
}

$op = $payload['op'];
$params = is_array($payload['params'] ?? null) ? $payload['params'] : [];

// ---------------------------------------------------------------- connections

$connections = [];

function connect(array $config, string $which): PDO
{
    global $connections;
    if (isset($connections[$which])) {
        return $connections[$which];
    }
    $c = $config[$which] ?? null;
    if (!is_array($c)) {
        fail(500, 'connection_not_configured');
    }
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $c['host'],
        (int) ($c['port'] ?? 3306),
        $c['database']
    );
    try {
        $pdo = new PDO($dsn, (string) $c['user'], (string) $c['password'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (Throwable $e) {
        fail(502, 'db_connect_failed');
    }
    return $connections[$which] = $pdo;
}

/** @return array<int, array<string, mixed>> */
function selectRows(PDO $pdo, string $sql, array $params = []): array
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function assertReadOnly(string $sql): void
{
    $normalized = ltrim($sql);
    if (!preg_match('/^(select|with)\b/i', $normalized)) {
        fail(403, 'catalog_is_read_only');
    }
    if (preg_match('/\b(insert|update|delete|replace|drop|alter|create|truncate|grant|call|load\s+data|into\s+outfile)\b/i', $sql)) {
        fail(403, 'catalog_is_read_only');
    }
    if (str_contains($sql, ';')) {
        fail(403, 'single_statement_only');
    }
}

// -------------------------------------------------------------------- catalog

$cat = $config['catalog'];
$p = (string) $cat['prefix'];
$langId = static function (array $params) use ($cat): int {
    return (($params['lang'] ?? 'ru') === 'uk') ? (int) $cat['lang_uk'] : (int) $cat['lang_ru'];
};

switch ($op) {
    case 'ping':
        ok(['time' => time()]);

    case 'catalog.categories': {
        $pdo = connect($config, 'catalog');
        $lang = $langId($params);
        $rows = selectRows($pdo, "
            SELECT c.category_id, c.parent_id, c.image, c.sort_order, c.status,
                   cd.name, cd.description, cd.meta_title, cd.meta_description,
                   (SELECT COUNT(*) FROM {$p}product_to_category p2c
                      JOIN {$p}product pr ON pr.product_id = p2c.product_id AND pr.status = 1
                     WHERE p2c.category_id = c.category_id) AS product_count
              FROM {$p}category c
              JOIN {$p}category_description cd
                ON cd.category_id = c.category_id AND cd.language_id = :lang
             WHERE c.status = 1
             ORDER BY c.sort_order, cd.name
        ", ['lang' => $lang]);
        ok($rows);
    }

    case 'catalog.products': {
        $pdo = connect($config, 'catalog');
        $lang = $langId($params);
        $limit = min(max((int) ($params['limit'] ?? 100), 1), 500);
        $offset = max((int) ($params['offset'] ?? 0), 0);
        $args = ['lang' => $lang];
        $where = 'p.status = 1';
        $join = '';
        if (isset($params['category_id'])) {
            $join = "JOIN {$p}product_to_category p2c ON p2c.product_id = p.product_id AND p2c.category_id = :cat";
            $args['cat'] = (int) $params['category_id'];
        }
        $rows = selectRows($pdo, "
            SELECT p.product_id, p.model, p.sku, p.image, p.quantity, p.price,
                   p.date_added, p.sort_order, p.status,
                   pd.name, pd.description, pd.meta_title, pd.meta_description,
                   (SELECT MIN(ps.price) FROM {$p}product_special ps
                     WHERE ps.product_id = p.product_id
                       AND (ps.date_start = '0000-00-00' OR ps.date_start <= NOW())
                       AND (ps.date_end   = '0000-00-00' OR ps.date_end   >= NOW())) AS special_price,
                   (SELECT GROUP_CONCAT(pi.image ORDER BY pi.sort_order SEPARATOR '|')
                      FROM {$p}product_image pi WHERE pi.product_id = p.product_id) AS gallery,
                   (SELECT MIN(p2c2.category_id) FROM {$p}product_to_category p2c2
                     WHERE p2c2.product_id = p.product_id) AS category_id
              FROM {$p}product p
              JOIN {$p}product_description pd
                ON pd.product_id = p.product_id AND pd.language_id = :lang
              {$join}
             WHERE {$where}
             ORDER BY p.sort_order, pd.name
             LIMIT {$limit} OFFSET {$offset}
        ", $args);
        ok($rows);
    }

    case 'catalog.product': {
        $pdo = connect($config, 'catalog');
        $lang = $langId($params);
        $rows = selectRows($pdo, "
            SELECT p.product_id, p.model, p.sku, p.image, p.quantity, p.price,
                   p.date_added, p.status,
                   pd.name, pd.description, pd.meta_title, pd.meta_description,
                   (SELECT MIN(ps.price) FROM {$p}product_special ps
                     WHERE ps.product_id = p.product_id
                       AND (ps.date_start = '0000-00-00' OR ps.date_start <= NOW())
                       AND (ps.date_end   = '0000-00-00' OR ps.date_end   >= NOW())) AS special_price,
                   (SELECT GROUP_CONCAT(pi.image ORDER BY pi.sort_order SEPARATOR '|')
                      FROM {$p}product_image pi WHERE pi.product_id = p.product_id) AS gallery,
                   (SELECT MIN(p2c2.category_id) FROM {$p}product_to_category p2c2
                     WHERE p2c2.product_id = p.product_id) AS category_id
              FROM {$p}product p
              JOIN {$p}product_description pd
                ON pd.product_id = p.product_id AND pd.language_id = :lang
             WHERE p.product_id = :id AND p.status = 1
             LIMIT 1
        ", ['lang' => $lang, 'id' => (int) ($params['product_id'] ?? 0)]);
        ok($rows[0] ?? null);
    }

    case 'catalog.search': {
        $pdo = connect($config, 'catalog');
        $lang = $langId($params);
        $needle = '%' . trim((string) ($params['q'] ?? '')) . '%';
        $rows = selectRows($pdo, "
            SELECT p.product_id, p.model, p.sku, p.image, p.quantity, p.price,
                   pd.name,
                   (SELECT MIN(p2c2.category_id) FROM {$p}product_to_category p2c2
                     WHERE p2c2.product_id = p.product_id) AS category_id
              FROM {$p}product p
              JOIN {$p}product_description pd
                ON pd.product_id = p.product_id AND pd.language_id = :lang
             WHERE p.status = 1
               AND (pd.name LIKE :q OR p.model LIKE :q OR p.sku LIKE :q)
             ORDER BY pd.name
             LIMIT 120
        ", ['lang' => $lang, 'q' => $needle]);
        ok($rows);
    }

    case 'catalog.query': {
        // Escape hatch for ad-hoc reporting reads. SELECT only, single statement.
        $sql = (string) ($params['sql'] ?? '');
        assertReadOnly($sql);
        $pdo = connect($config, 'catalog');
        ok(selectRows($pdo, $sql, (array) ($params['args'] ?? [])));
    }

    // ------------------------------------------------------------------- shop

    case 'shop.query': {
        $sql = (string) ($params['sql'] ?? '');
        if ($sql === '' || str_contains($sql, ';')) {
            fail(400, 'single_statement_only');
        }
        $pdo = connect($config, 'shop');
        $stmt = $pdo->prepare($sql);
        $stmt->execute((array) ($params['args'] ?? []));
        $isSelect = (bool) preg_match('/^\s*(select|with|show|describe)\b/i', $sql);
        ok([
            'rows'      => $isSelect ? $stmt->fetchAll() : [],
            'affected'  => $stmt->rowCount(),
            'insert_id' => $isSelect ? null : $pdo->lastInsertId(),
        ]);
    }

    case 'shop.transaction': {
        $statements = (array) ($params['statements'] ?? []);
        $pdo = connect($config, 'shop');
        $pdo->beginTransaction();
        try {
            $results = [];
            foreach ($statements as $s) {
                $sql = (string) ($s['sql'] ?? '');
                if ($sql === '' || str_contains($sql, ';')) {
                    throw new RuntimeException('single_statement_only');
                }
                $stmt = $pdo->prepare($sql);
                $stmt->execute((array) ($s['args'] ?? []));
                $isSelect = (bool) preg_match('/^\s*(select|with)\b/i', $sql);
                $results[] = [
                    'rows'      => $isSelect ? $stmt->fetchAll() : [],
                    'affected'  => $stmt->rowCount(),
                    'insert_id' => $isSelect ? null : $pdo->lastInsertId(),
                ];
            }
            $pdo->commit();
            ok($results);
        } catch (Throwable $e) {
            $pdo->rollBack();
            fail(400, 'transaction_failed');
        }
    }

    default:
        fail(404, 'unknown_op');
}
