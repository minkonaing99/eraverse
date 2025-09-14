<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Use POST.']);
    exit;
}

require __DIR__ . '/session_bootstrap.php';
require __DIR__ . '/auth.php';

auth_require_login(['admin', 'owner', 'staff']);

header('X-Content-Type-Options: nosniff');

require __DIR__ . '/dbinfo.php';

try {
    $stmt = $pdo->query("
        SELECT 
            product_id,
            product_name,
            duration,
            renew AS renew_int,
            supplier,
            wholesale,
            retail,
            note,
            link
        FROM products_catalog
        ORDER BY product_name ASC
    ");

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$r) {
        $r['product_id'] = isset($r['product_id']) ? (int)$r['product_id'] : null;
        $r['duration']   = isset($r['duration']) ? (int)$r['duration'] : null;

        $r['renew_int']  = isset($r['renew_int']) ? (int)$r['renew_int'] : 0;

        $r['renew']      = isset($r['renew_bool']) ? ((int)$r['renew_bool'] === 1) : false;

        $r['wholesale']  = isset($r['wholesale']) ? (float)$r['wholesale'] : 0.0;
        $r['retail']     = isset($r['retail']) ? (float)$r['retail'] : 0.0;

        $r['supplier']   = $r['supplier'] ?? null;
        $r['note']       = $r['note'] ?? null;
        $r['link']       = $r['link'] ?? null;

        unset($r['renew_bool']);
    }
    unset($r);

    echo json_encode([
        'success' => true,
        'data'    => $rows
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error'   => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
