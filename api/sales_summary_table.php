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

ob_start();

try {
    ini_set('display_errors', '0');
    error_reporting(E_ALL);

    require_once __DIR__ . '/dbinfo.php';

    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('DB connection ($pdo) not initialized.');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $today = date('Y-m-d');
    $one_month_from_now = date('Y-m-d', strtotime('+1 month'));

    $stmt = $pdo->prepare("
        SELECT
            sale_id,
            CONCAT('Retail - ', sale_product) as sale_product,
            price,
            profit,
            purchased_date,
            expired_date,
            customer,
            email,
            renew,
            duration,
            'retail' as sale_type
        FROM sale_overview
        WHERE (
            expired_date IS NOT NULL AND expired_date <= ?
            OR renew != 0
        )
        
        UNION ALL
        
        SELECT
            sale_id,
            CONCAT('Wholesale - ', sale_product) as sale_product,
            price,
            profit,
            purchased_date,
            expired_date,
            customer,
            email,
            renew,
            duration,
            'wholesale' as sale_type
        FROM ws_sale_overview
        WHERE (
            expired_date IS NOT NULL AND expired_date <= ?
            OR renew != 0
        )
        
        ORDER BY purchased_date DESC, sale_id DESC
    ");

    $stmt->execute([$one_month_from_now, $one_month_from_now]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($rows as &$r) {
        $r['sale_id']        = isset($r['sale_id'])        ? (int)$r['sale_id']        : null;
        $r['sale_product']   = $r['sale_product']          ?? null;
        $r['price']          = isset($r['price'])          ? (float)$r['price']        : 0.0;
        $r['profit']         = isset($r['profit'])         ? (float)$r['profit']       : 0.0;

        $r['purchased_date'] = $r['purchased_date']        ?? null;
        $r['expired_date']   = $r['expired_date']          ?? null;
        $r['customer']       = $r['customer']              ?? null;
        $r['email']          = $r['email']                 ?? null;

        $r['renew']          = isset($r['renew'])          ? (int)$r['renew']          : 0;

        $r['duration']       = isset($r['duration'])       ? (int)$r['duration']       : null;

        $r['sale_type']      = $r['sale_type']             ?? 'retail';
    }
    unset($r);

    ob_end_clean();
    echo json_encode(
        ['success' => true, 'data' => $rows],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION
    );
} catch (Throwable $e) {
    ob_end_clean();
    http_response_code(500);
    error_log('sales_summary_table.php error: ' . $e->getMessage());
    echo json_encode(
        ['success' => false, 'error' => $e->getMessage()],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
}
