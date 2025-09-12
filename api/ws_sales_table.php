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
    $limit = isset($input['limit']) ? min(3000, max(1, (int)$input['limit'])) : 3000;
    $offset = ($page - 1) * $limit;

    // Get total count for pagination
    $countStmt = $pdo->query("SELECT COUNT(*) as total FROM ws_sale_overview");
    $totalRecords = (int)$countStmt->fetch()['total'];
    $totalPages = (int)ceil($totalRecords / $limit);

    // Get paginated data
    $stmt = $pdo->prepare("
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
        LIMIT :limit OFFSET :offset
    ");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
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
        [
            'success' => true,
            'data' => $rows,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => $totalPages,
                'total_records' => $totalRecords,
                'per_page' => $limit,
                'has_more' => $page < $totalPages,
                'next_page' => $page < $totalPages ? $page + 1 : null,
                'prev_page' => $page > 1 ? $page - 1 : null
            ]
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
