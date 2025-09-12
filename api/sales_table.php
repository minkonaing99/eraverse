<?php
// api/sales_table.php
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

require __DIR__ . '/dbinfo.php';

try {
    if (! isset($pdo) || ! ($pdo instanceof PDO)) {
        throw new RuntimeException('PDO connection not initialized. Check dbinfo.php');
    }
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Get pagination parameters from request
    $input  = json_decode(file_get_contents('php://input'), true) ?? [];
    $page   = isset($input['page']) ? max(1, (int) $input['page']) : 1;
    // No limit needed since we're filtering by month
    $limit = null;
    $offset = 0;
    $month  = isset($input['month']) ? (int) $input['month'] : null; // Month filter (1-12)

    // Build WHERE clause for month filtering
    $whereClause = "";
    $params = [];
    if ($month && $month >= 1 && $month <= 12) {
        $whereClause = "WHERE MONTH(purchased_date) = :month";
        $params[':month'] = $month;
    }

    // Get total count
    $countSql = "SELECT COUNT(*) as total FROM sale_overview " . $whereClause;
    $countStmt = $pdo->prepare($countSql);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value, PDO::PARAM_INT);
    }
    $countStmt->execute();
    $totalRecords = (int) $countStmt->fetch()['total'];

    // Get all data for the month
    $sql = "
        SELECT
            sale_id,
            sale_product,
            renew,
            customer,
            email,
            purchased_date,
            expired_date,
            manager,
            note,
            price
        FROM sale_overview
        " . $whereClause . "
        ORDER BY purchased_date DESC, sale_id DESC
    ";
    $stmt = $pdo->prepare($sql);

    // Bind month parameter if present
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value, PDO::PARAM_INT);
    }

    $stmt->execute();
    $rows = $stmt->fetchAll();

    // Normalize types (renew is INT now, not boolean)
    foreach ($rows as &$r) {
        $r['sale_id']  = isset($r['sale_id']) ? (int) $r['sale_id'] : null;
        $r['duration'] = isset($r['duration']) ? (int) $r['duration'] : null;
        $r['renew']    = isset($r['renew']) ? (int) $r['renew'] : 0; // <-- INT (0,1,2,3,4,5,6,12)

        $r['price'] = isset($r['price']) ? (float) $r['price'] : 0.0;

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
        [
            'success'    => true,
            'data'       => $rows,
            'total_records' => $totalRecords,
        ],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION
    );
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(
        ['success' => false, 'error' => $e->getMessage()],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
}
