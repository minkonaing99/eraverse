<?php

declare(strict_types=1);

session_start();
require_once 'dbinfo.php';

$username = $_POST['username'] ?? '';
$password = $_POST['password'] ?? '';

if ($username === '' || $password === '') {
    http_response_code(400);
    exit('Username and password are required.');
}

try {
    // match your schema: users(user_id, username, pass_hash, role, is_active, ...)
    $stmt = $pdo->prepare("
        SELECT user_id, username, pass_hash, role, is_active
        FROM users
        WHERE username = :username
        LIMIT 1
    ");
    $stmt->execute([':username' => $username]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // Verify against pass_hash and ensure account is active
    $ok = $row && (int)$row['is_active'] === 1 && password_verify($password, $row['pass_hash']);
    if (!$ok) {
        http_response_code(401);
        exit('Invalid username or password.');
    }

    // Set your legacy session fields
    $_SESSION['username']  = $row['username'];
    $priv = strtolower((string)$row['role']); // 'owner' | 'admin' | 'staff'
    $_SESSION['privilege'] = $priv;
    $_SESSION['logincode'] = in_array($priv, ['admin', 'owner'], true) ? '978979068' : '978979058';

    // Touch last_login_at
    $upd = $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE user_id = :id");
    $upd->execute([':id' => (int)$row['user_id']]);

    // (Optional) your cookies — reminder: these are tamperable
    setcookie('username',  $_SESSION['username'],  time() + 604800, '/');
    setcookie('privilege', $_SESSION['privilege'], time() + 604800, '/');
    setcookie('logincode', $_SESSION['logincode'], time() + 604800, '/');

    exit('success');
} catch (PDOException $e) {
    http_response_code(500);
    exit('Database error: ' . $e->getMessage());
}
