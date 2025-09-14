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

auth_require_login(['admin', 'owner']);

header('X-Content-Type-Options: nosniff');

require __DIR__ . '/dbinfo.php';

try {
    $webStmt = $pdo->prepare(
        "SELECT user_id, username, is_active, role, last_login_at, created_at
         FROM users where role != 'Owner'
         ORDER BY username ASC "
    );
    $webStmt->execute();
    $webUsers = $webStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $botStmt = $pdo->prepare(
        "SELECT id, telegram_id, username, is_active, last_login, created_at
         FROM bot_users
         ORDER BY username ASC"
    );
    $botStmt->execute();
    $botUsers = $botStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

    $formattedWebUsers = array_map(function ($row) {
        return [
            'id' => $row['user_id'],
            'username' => $row['username'],
            'telegram_id' => '-',
            'is_active' => (bool)$row['is_active'],
            'role' => $row['role'],
            'last_login' => $row['last_login_at'] ? date('Y-m-d H:i:s', strtotime($row['last_login_at'])) : 'Never',
            'created_at' => date('Y-m-d H:i:s', strtotime($row['created_at'])),
            'type' => 'web'
        ];
    }, $webUsers);

    $formattedBotUsers = array_map(function ($row) {
        return [
            'id' => $row['id'],
            'username' => $row['username'],
            'telegram_id' => $row['telegram_id'],
            'is_active' => (bool)$row['is_active'],
            'role' => 'Bot User',
            'last_login' => $row['last_login'] ? date('Y-m-d H:i:s', strtotime($row['last_login'])) : 'Never',
            'created_at' => date('Y-m-d H:i:s', strtotime($row['created_at'])),
            'type' => 'bot'
        ];
    }, $botUsers);

    $allUsers = array_merge($formattedWebUsers, $formattedBotUsers);

    usort($allUsers, function ($a, $b) {
        return strcasecmp($a['username'], $b['username']);
    });

    echo json_encode(['success' => true, 'data' => $allUsers], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to load users.'], JSON_UNESCAPED_UNICODE);
}
