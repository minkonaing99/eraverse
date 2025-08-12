<?php
// api/user_delete.php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/dbinfo.php';

function json_fail(string $msg, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function json_ok(array $data = []): void
{
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '[]', true);
if (!is_array($body)) $body = [];

$id = $body['id'] ?? null;
$id = filter_var($id, FILTER_VALIDATE_INT);
if (!$id || $id < 1) json_fail('Invalid or missing "id".', 422);

try {
    // Check target user
    $stmt = $pdo->prepare("SELECT username, role FROM users WHERE user_id = :id");
    $stmt->execute([':id' => $id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) json_fail('User not found.', 404);

    if ($user['role'] === 'Owner') {
        json_fail('Cannot delete Owner account.', 403);
    }

    // Optional: prevent self-delete if you keep sessions
    // session_start();
    // if (!empty($_SESSION['user_id']) && (int)$_SESSION['user_id'] === (int)$id) {
    //     json_fail('You cannot delete your own account while logged in.', 403);
    // }

    $del = $pdo->prepare("DELETE FROM users WHERE user_id = :id LIMIT 1");
    $del->execute([':id' => $id]);

    if ($del->rowCount() === 0) json_fail('Delete failed.', 500);

    json_ok(['deleted_id' => $id, 'username' => $user['username']]);
} catch (Throwable $e) {
    json_fail('Delete failed.', 500);
}
