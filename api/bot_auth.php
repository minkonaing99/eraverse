<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require_once __DIR__ . '/dbinfo.php';

function json_fail(string $msg, int $code = 400): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function json_ok(array $data = [], int $code = 200): void
{
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

// Read JSON body
$raw = file_get_contents('php://input');
$body = json_decode($raw ?: '[]', true);
if (!is_array($body)) $body = [];

$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    json_fail('Username and password are required.', 400);
}

try {
    // Check user credentials using same logic as login.php
    $stmt = $pdo->prepare("
        SELECT user_id, username, pass_hash, role, is_active
        FROM users
        WHERE username = :username
        LIMIT 1
    ");
    $stmt->execute([':username' => $username]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $active = $row && (int)$row['is_active'] === 1;
    $ok = $active && password_verify($password, $row['pass_hash'] ?? '');

    if (!$ok) {
        json_fail('Invalid username or password.', 401);
    }

    // Success - return user info
    json_ok([
        'user_id' => (int)$row['user_id'],
        'username' => $row['username'],
        'role' => $row['role']
    ]);
} catch (PDOException $e) {
    json_fail('Database error.', 500);
}
