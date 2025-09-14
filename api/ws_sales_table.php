<?php
// api/ws_sales_table.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST'); // POST only

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

require __DIR__ . '/dbinfo.php'; // provides $pdo

try {
    if (!isset($pdo) || !($pdo instanceof PDO)) {
        throw new RuntimeException('PDO connection not initialized. Check dbinfo.php');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Get pagination parameters from request
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $page = isset($input['page']) ? max(1, (int)$input['page']) : 1;
    $limit = null;
    $offset = 0;
    $month = isset($input['month']) ? (int) $input['month'] : null; // Month filter (1-12)

    // Build WHERE clause for month filtering
    $whereClause = "";
    $params = [];
    if ($month && $month >= 1 && $month <= 12) {
        // Use date range instead of MONTH() function for better index usage
        $year = date('Y');
        $startDate = "$year-" . str_pad((string)$month, 2, '0', STR_PAD_LEFT) . "-01";
        $endDate = date('Y-m-t', strtotime($startDate)); // Last day of month

        $whereClause = "WHERE purchased_date >= :start_date AND purchased_date <= :end_date";
        $params[':start_date'] = $startDate;
        $params[':end_date'] = $endDate;
    }

    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM ws_sale_overview " . $whereClause;
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $countStmt->execute();
    $totalRecords = (int)$countStmt->fetch()['total'];

    // Get paginated data
    $sql = "
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
        " . $whereClause . "
        ORDER BY purchased_date DESC, sale_id DESC
    ";
    $stmt = $pdo->prepare($sql);

    // Bind parameters
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_STR);
    }
    $stmt->execute();
    $rows = $stmt->fetchAll();

    // Optimized data processing - only process what's needed
    foreach ($rows as &$r) {
        // Only cast to int/float if needed for calculations
        $r['sale_id'] = (int) ($r['sale_id'] ?? 0);
        $r['duration'] = (int) ($r['duration'] ?? 0);
        $r['quantity'] = (int) ($r['quantity'] ?? 1);
        $r['renew'] = (int) ($r['renew'] ?? 0);
        $r['price'] = (float) ($r['price'] ?? 0.0);
        $r['profit'] = (float) ($r['profit'] ?? 0.0);

        // Keep other fields as strings (faster than null coalescing)
        $r['sale_product'] = $r['sale_product'] ?? '';
        $r['customer'] = $r['customer'] ?? '';
        $r['email'] = $r['email'] ?? '';
        $r['purchased_date'] = $r['purchased_date'] ?? '';
        $r['expired_date'] = $r['expired_date'] ?? '';
        $r['manager'] = $r['manager'] ?? '';
        $r['note'] = $r['note'] ?? '';
    }
    unset($r);

    // Optimize JSON output
    $response = [
        'success' => true,
        'data' => $rows,
        'total_records' => $totalRecords,
    ];

    // Use faster JSON encoding without unnecessary flags
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(
        ['success' => false, 'error' => $e->getMessage()],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
}
