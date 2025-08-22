<?php
// api/ws_sales_table.php
declare(strict_types=1);

require __DIR__ . '/session_bootstrap.php';
require __DIR__ . '/auth.php';

auth_require_login(['admin', 'owner', 'staff']);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/dbinfo.php'; // provides $pdo

try {
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('PDO connection not initialized. Check dbinfo.php');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $sql = "SELECT 
                sale_id,
                sale_product,
                duration,
                quantity,
                renew,
                customer,
                email,
                purchased_date,
                expired_date,
                manager,
                note,
                price,
                profit
            FROM ws_sale_overview 
            ORDER BY purchased_date DESC, sale_id DESC";

    $stmt = $pdo->query("
        SELECT
            sale_id,
            sale_product,
            duration,
            quantity,
            renew,
            customer,
            email,
            purchased_date,
            expired_date,
            manager,
            note,
            price,
            profit
        FROM ws_sale_overview
        ORDER BY purchased_date DESC, sale_id DESC
    ");
    $rows = $stmt->fetchAll();

    // Normalize types (renew is INT now, not boolean)
    foreach ($rows as &$r) {
        $r['sale_id']        = isset($r['sale_id']) ? (int)$r['sale_id'] : null;
        $r['duration']       = isset($r['duration']) ? (int)$r['duration'] : null;
        $r['quantity']       = isset($r['quantity']) ? (int)$r['quantity'] : 1;
        $r['renew']          = isset($r['renew']) ? (int)$r['renew'] : 0; // <-- INT (0,1,2,3,4,5,6,12)

        $r['price']          = isset($r['price']) ? (float)$r['price'] : 0.0;
        $r['profit']         = isset($r['profit']) ? (float)$r['profit'] : 0.0;

        // Nullable strings/dates
        $r['sale_product']   = $r['sale_product'] ?? null;
        $r['customer']       = $r['customer'] ?? null;
        $r['email']          = $r['email'] ?? null;
        $r['purchased_date'] = $r['purchased_date'] ?? null; // 'YYYY-MM-DD'
        $r['expired_date']   = $r['expired_date'] ?? null;   // 'YYYY-MM-DD' or null
        $r['manager']        = $r['manager'] ?? null;
        $r['note']           = $r['note'] ?? null;
    }
    unset($r);

    echo json_encode(
        ['success' => true, 'data' => $rows],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(
        ['success' => false, 'error' => $e->getMessage()],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
}
