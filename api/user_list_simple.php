<?php
// api/user_list_simple.php
declare(strict_types=1);


require __DIR__ . '/session_bootstrap.php';
require __DIR__ . '/auth.php';

auth_require_login(['admin', 'staff']);

$role = ucfirst($_SESSION['user']['role'] ?? '');
$user = htmlspecialchars($_SESSION['user']['username'] ?? 'Guest', ENT_QUOTES);
$user_id = $_SESSION['user']['id'];


header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/dbinfo.php';
$ownerRole = 'Owner';
try {
    $stmt = $pdo->prepare(
        "SELECT user_id, username, `role`
     FROM users
     WHERE user_id != :user_id
       AND `role` != :role
     ORDER BY username ASC"
    );
    $stmt->execute([
        'user_id' => (int)$user_id,
        'role'    => $ownerRole,
    ]);

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    echo json_encode(['success' => true, 'data' => $rows], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load users.'], JSON_UNESCAPED_UNICODE);
}
