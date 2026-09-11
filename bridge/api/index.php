<?php
/**
 * Techno Forma data bridge (HostUkraine hosting, PHP 7.4 compatible).
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
 *
 * IMPORTANT: PHP 7.4 only. No union types, no "mixed"/"never" declarations,
 * no str_contains()/str_starts_with(), no match expressions, no enums.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');

// Errors must never leak stack traces or credentials into the JSON response.
ini_set('display_errors', '0');
error_reporting(E_ALL);

function fail($status, $error)
{
    http_response_code($status);
    echo json_encode(array('ok' => false, 'error' => $error), JSON_UNESCAPED_UNICODE);
    exit;
}

function ok($data)
{
    echo json_encode(array('ok' => true, 'data' => $data), JSON_UNESCAPED_UNICODE);
    exit;
}

set_exception_handler(function ($e) {
    error_log('[bridge] ' . $e->getMessage());
    fail(500, 'server_error');
});

function contains($haystack, $needle)
{
    return $needle !== '' && strpos($haystack, $needle) !== false;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    fail(500, 'config_missing');
}
$config = require $configFile;

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'method_not_allowed');
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false) {
    $rawBody = '';
}
$timestamp = isset($_SERVER['HTTP_X_TF_TIMESTAMP']) ? $_SERVER['HTTP_X_TF_TIMESTAMP'] : '';
$signature = isset($_SERVER['HTTP_X_TF_SIGNATURE']) ? $_SERVER['HTTP_X_TF_SIGNATURE'] : '';

if ($timestamp === '' || $signature === '') {
    fail(401, 'unsigned');
}
$maxSkew = isset($config['max_skew']) ? (int) $config['max_skew'] : 300;
if (abs(time() - (int) $timestamp) > $maxSkew) {
    fail(401, 'stale_request');
}

$expected = hash_hmac('sha256', $timestamp . '.' . $rawBody, (string) $config['secret']);
if (!hash_equals($expected, (string) $signature)) {
    fail(401, 'bad_signature');
}

$payload = json_decode($rawBody, true);
if (!is_array($payload) || !isset($payload['op']) || !is_string($payload['op'])) {
    fail(400, 'bad_request');
}

$op = $payload['op'];
$params = (isset($payload['params']) && is_array($payload['params'])) ? $payload['params'] : array();

// ---------------------------------------------------------------- connections

$connections = array();

function connect($config, $which)
{
    global $connections;
    if (isset($connections[$which])) {
        return $connections[$which];
    }
    $c = isset($config[$which]) ? $config[$which] : null;
    if (!is_array($c)) {
        fail(500, 'connection_not_configured');
    }
    $port = isset($c['port']) ? (int) $c['port'] : 3306;
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], $port, $c['database']);
    try {
        $pdo = new PDO($dsn, (string) $c['user'], (string) $c['password'], array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => true,
        ));
    } catch (Exception $e) {
        error_log('[bridge] connect ' . $which . ': ' . $e->getMessage());
        fail(502, 'db_connect_failed');
    }
    $connections[$which] = $pdo;
    return $pdo;
}

function selectRows($pdo, $sql, $params = array())
{
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function assertReadOnly($sql)
{
    $normalized = ltrim($sql);
    if (!preg_match('/^(select|with|show|describe|desc)\b/i', $normalized)) {
        fail(403, 'catalog_is_read_only');
    }
    if (preg_match('/\b(insert|update|delete|replace|drop|alter|create|truncate|grant|call|load\s+data|into\s+outfile)\b/i', $sql)) {
        fail(403, 'catalog_is_read_only');
    }
    if (contains($sql, ';')) {
        fail(403, 'single_statement_only');
    }
}

function tableExists($pdo, $name)
{
    $rows = selectRows(
        $pdo,
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = :t',
        array('t' => $name)
    );
    return isset($rows[0]['n']) && (int) $rows[0]['n'] > 0;
}

// -------------------------------------------------------------------- catalog

$cat = isset($config['catalog']) ? $config['catalog'] : array();
$p = isset($cat['prefix']) ? (string) $cat['prefix'] : 'oc_';

function langId($params, $cat)
{
    $lang = isset($params['lang']) ? $params['lang'] : 'ru';
    if ($lang === 'uk') {
        return isset($cat['lang_uk']) ? (int) $cat['lang_uk'] : 2;
    }
    return isset($cat['lang_ru']) ? (int) $cat['lang_ru'] : 1;
}

/**
 * SEO keyword lookup. OpenCart 1.5-3.x keeps them in url_alias
 * ("category_id=20" -> keyword), OpenCart 4 in seo_url.
 * Returns array like array('category_id=20' => 'forms-stolbov').
 */
function seoMap($pdo, $prefix, $kind)
{
    $out = array();
    if (tableExists($pdo, $prefix . 'seo_url')) {
        $rows = selectRows(
            $pdo,
            "SELECT `key`, `value`, keyword FROM {$prefix}seo_url WHERE `key` = :k",
            array('k' => $kind)
        );
        foreach ($rows as $r) {
            $out[$r['key'] . '=' . $r['value']] = $r['keyword'];
        }
        return $out;
    }
    if (tableExists($pdo, $prefix . 'url_alias')) {
        $rows = selectRows(
            $pdo,
            "SELECT query, keyword FROM {$prefix}url_alias WHERE query LIKE :k",
            array('k' => $kind . '=%')
        );
        foreach ($rows as $r) {
            $out[$r['query']] = $r['keyword'];
        }
    }
    return $out;
}

switch ($op) {
    case 'ping':
        ok(array('time' => time(), 'php' => PHP_VERSION));
        break;

    /** Diagnostics used while wiring the new site: schema shape and row counts. */
    case 'catalog.meta': {
        $pdo = connect($config, 'catalog');
        $tables = selectRows(
            $pdo,
            'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name'
        );
        $languages = tableExists($pdo, $p . 'language')
            ? selectRows($pdo, "SELECT language_id, name, code, status FROM {$p}language")
            : array();
        $counts = array();
        foreach (array('category', 'category_description', 'product', 'product_description', 'product_image', 'product_special', 'product_to_category') as $t) {
            if (tableExists($pdo, $p . $t)) {
                $rows = selectRows($pdo, "SELECT COUNT(*) AS n FROM {$p}{$t}");
                $counts[$t] = (int) $rows[0]['n'];
            }
        }
        $stores = tableExists($pdo, $p . 'product_to_store')
            ? selectRows($pdo, "SELECT store_id, COUNT(*) AS n FROM {$p}product_to_store GROUP BY store_id")
            : array();
        ok(array(
            'prefix'    => $p,
            'tables'    => $tables,
            'languages' => $languages,
            'counts'    => $counts,
            'stores'    => $stores,
            'seo_table' => tableExists($pdo, $p . 'seo_url') ? 'seo_url' : (tableExists($pdo, $p . 'url_alias') ? 'url_alias' : null),
        ));
        break;
    }

    case 'catalog.categories': {
        $pdo = connect($config, 'catalog');
        $lang = langId($params, $cat);
        $rows = selectRows($pdo, "
            SELECT c.category_id, c.parent_id, c.image, c.sort_order, c.status,
                   cd.name, cd.description, cd.meta_title, cd.meta_description,
                   (SELECT COUNT(*) FROM {$p}product_to_category p2c
                      JOIN {$p}product pr ON pr.product_id = p2c.product_id AND pr.status = 1
                     WHERE p2c.category_id = c.category_id) AS product_count
              FROM {$p}category c
              JOIN {$p}category_description cd
                ON cd.category_id = c.category_id AND cd.language_id = :lang
             ORDER BY c.sort_order, cd.name
        ", array('lang' => $lang));
        $seo = seoMap($pdo, $p, 'category_id');
        foreach ($rows as $i => $r) {
            $key = 'category_id=' . $r['category_id'];
            $rows[$i]['slug'] = isset($seo[$key]) ? $seo[$key] : null;
        }
        ok($rows);
        break;
    }

    case 'catalog.products': {
        $pdo = connect($config, 'catalog');
        $lang = langId($params, $cat);
        $limit = min(max(isset($params['limit']) ? (int) $params['limit'] : 100, 1), 1000);
        $offset = max(isset($params['offset']) ? (int) $params['offset'] : 0, 0);
        $args = array('lang' => $lang);
        $join = '';
        if (isset($params['category_id'])) {
            $join = "JOIN {$p}product_to_category p2c ON p2c.product_id = p.product_id AND p2c.category_id = :cat";
            $args['cat'] = (int) $params['category_id'];
        }
        $rows = selectRows($pdo, "
            SELECT p.product_id, p.model, p.sku, p.image, p.quantity, p.price, p.status,
                   p.date_added, p.date_modified, p.sort_order,
                   pd.name, pd.description, pd.meta_title, pd.meta_description,
                   (SELECT MIN(ps.price) FROM {$p}product_special ps
                     WHERE ps.product_id = p.product_id
                       AND (ps.date_start = '0000-00-00' OR ps.date_start <= NOW())
                       AND (ps.date_end   = '0000-00-00' OR ps.date_end   >= NOW())) AS special_price,
                   (SELECT GROUP_CONCAT(pi.image ORDER BY pi.sort_order SEPARATOR '|')
                      FROM {$p}product_image pi WHERE pi.product_id = p.product_id) AS gallery,
                   (SELECT GROUP_CONCAT(p2c2.category_id) FROM {$p}product_to_category p2c2
                     WHERE p2c2.product_id = p.product_id) AS category_ids
              FROM {$p}product p
              JOIN {$p}product_description pd
                ON pd.product_id = p.product_id AND pd.language_id = :lang
              {$join}
             WHERE p.status = 1
             ORDER BY p.sort_order, pd.name
             LIMIT {$limit} OFFSET {$offset}
        ", $args);
        $seo = seoMap($pdo, $p, 'product_id');
        foreach ($rows as $i => $r) {
            $key = 'product_id=' . $r['product_id'];
            $rows[$i]['slug'] = isset($seo[$key]) ? $seo[$key] : null;
        }
        ok($rows);
        break;
    }

    case 'catalog.product': {
        $pdo = connect($config, 'catalog');
        $lang = langId($params, $cat);
        $productId = isset($params['product_id']) ? (int) $params['product_id'] : 0;

        if ($productId === 0 && isset($params['slug']) && $params['slug'] !== '') {
            $seo = seoMap($pdo, $p, 'product_id');
            foreach ($seo as $query => $keyword) {
                if ($keyword === $params['slug']) {
                    $productId = (int) substr($query, strlen('product_id='));
                    break;
                }
            }
        }

        $rows = selectRows($pdo, "
            SELECT p.product_id, p.model, p.sku, p.image, p.quantity, p.price, p.status,
                   p.date_added, p.date_modified,
                   pd.name, pd.description, pd.meta_title, pd.meta_description,
                   (SELECT MIN(ps.price) FROM {$p}product_special ps
                     WHERE ps.product_id = p.product_id
                       AND (ps.date_start = '0000-00-00' OR ps.date_start <= NOW())
                       AND (ps.date_end   = '0000-00-00' OR ps.date_end   >= NOW())) AS special_price,
                   (SELECT GROUP_CONCAT(pi.image ORDER BY pi.sort_order SEPARATOR '|')
                      FROM {$p}product_image pi WHERE pi.product_id = p.product_id) AS gallery,
                   (SELECT GROUP_CONCAT(p2c2.category_id) FROM {$p}product_to_category p2c2
                     WHERE p2c2.product_id = p.product_id) AS category_ids
              FROM {$p}product p
              JOIN {$p}product_description pd
                ON pd.product_id = p.product_id AND pd.language_id = :lang
             WHERE p.product_id = :id AND p.status = 1
             LIMIT 1
        ", array('lang' => $lang, 'id' => $productId));

        if (!isset($rows[0])) {
            ok(null);
        }
        $row = $rows[0];
        $attributes = tableExists($pdo, $p . 'product_attribute')
            ? selectRows($pdo, "
                SELECT ad.name, pa.text
                  FROM {$p}product_attribute pa
                  JOIN {$p}attribute_description ad
                    ON ad.attribute_id = pa.attribute_id AND ad.language_id = :lang
                 WHERE pa.product_id = :id AND pa.language_id = :lang
            ", array('lang' => $lang, 'id' => $productId))
            : array();
        $row['attributes'] = $attributes;
        $seo = seoMap($pdo, $p, 'product_id');
        $key = 'product_id=' . $row['product_id'];
        $row['slug'] = isset($seo[$key]) ? $seo[$key] : null;
        ok($row);
        break;
    }

    case 'catalog.search': {
        $pdo = connect($config, 'catalog');
        $lang = langId($params, $cat);
        $needle = '%' . trim(isset($params['q']) ? (string) $params['q'] : '') . '%';
        // Named placeholders are bound once per occurrence, so each LIKE gets
        // its own parameter name (works with and without emulated prepares).
        $rows = selectRows($pdo, "
            SELECT p.product_id, p.model, p.sku, p.image, p.quantity, p.price,
                   pd.name, pd.description,
                   (SELECT MIN(ps.price) FROM {$p}product_special ps
                     WHERE ps.product_id = p.product_id
                       AND (ps.date_start = '0000-00-00' OR ps.date_start <= NOW())
                       AND (ps.date_end   = '0000-00-00' OR ps.date_end   >= NOW())) AS special_price,
                   (SELECT GROUP_CONCAT(pi.image ORDER BY pi.sort_order SEPARATOR '|')
                      FROM {$p}product_image pi WHERE pi.product_id = p.product_id) AS gallery,
                   (SELECT GROUP_CONCAT(p2c2.category_id) FROM {$p}product_to_category p2c2
                     WHERE p2c2.product_id = p.product_id) AS category_ids
              FROM {$p}product p
              JOIN {$p}product_description pd
                ON pd.product_id = p.product_id AND pd.language_id = :lang
             WHERE p.status = 1
               AND (pd.name LIKE :q1 OR p.model LIKE :q2 OR p.sku LIKE :q3)
             ORDER BY pd.name
             LIMIT 120
        ", array('lang' => $lang, 'q1' => $needle, 'q2' => $needle, 'q3' => $needle));
        $seo = seoMap($pdo, $p, 'product_id');
        foreach ($rows as $i => $r) {
            $key = 'product_id=' . $r['product_id'];
            $rows[$i]['slug'] = isset($seo[$key]) ? $seo[$key] : null;
        }
        ok($rows);
        break;
    }

    case 'catalog.query': {
        // Escape hatch for ad-hoc reporting reads. SELECT only, single statement.
        $sql = isset($params['sql']) ? (string) $params['sql'] : '';
        assertReadOnly($sql);
        $pdo = connect($config, 'catalog');
        $args = (isset($params['args']) && is_array($params['args'])) ? $params['args'] : array();
        ok(selectRows($pdo, $sql, $args));
        break;
    }

    // ------------------------------------------------------------------- shop

    case 'shop.query': {
        $sql = isset($params['sql']) ? (string) $params['sql'] : '';
        if ($sql === '' || contains($sql, ';')) {
            fail(400, 'single_statement_only');
        }
        $pdo = connect($config, 'shop');
        $args = (isset($params['args']) && is_array($params['args'])) ? $params['args'] : array();
        $stmt = $pdo->prepare($sql);
        $stmt->execute($args);
        $isSelect = (bool) preg_match('/^\s*(select|with|show|describe)\b/i', $sql);
        ok(array(
            'rows'      => $isSelect ? $stmt->fetchAll() : array(),
            'affected'  => $stmt->rowCount(),
            'insert_id' => $isSelect ? null : $pdo->lastInsertId(),
        ));
        break;
    }

    case 'shop.transaction': {
        $statements = (isset($params['statements']) && is_array($params['statements'])) ? $params['statements'] : array();
        $pdo = connect($config, 'shop');
        $pdo->beginTransaction();
        try {
            $results = array();
            foreach ($statements as $s) {
                $sql = isset($s['sql']) ? (string) $s['sql'] : '';
                if ($sql === '' || contains($sql, ';')) {
                    throw new RuntimeException('single_statement_only');
                }
                $args = (isset($s['args']) && is_array($s['args'])) ? $s['args'] : array();
                $stmt = $pdo->prepare($sql);
                $stmt->execute($args);
                $isSelect = (bool) preg_match('/^\s*(select|with)\b/i', $sql);
                $results[] = array(
                    'rows'      => $isSelect ? $stmt->fetchAll() : array(),
                    'affected'  => $stmt->rowCount(),
                    'insert_id' => $isSelect ? null : $pdo->lastInsertId(),
                );
            }
            $pdo->commit();
            ok($results);
        } catch (Exception $e) {
            $pdo->rollBack();
            error_log('[bridge] transaction: ' . $e->getMessage());
            fail(400, 'transaction_failed');
        }
        break;
    }

    default:
        fail(404, 'unknown_op');
}
