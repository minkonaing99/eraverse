<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

require __DIR__ . '/dbinfo.php'; // $pdo

const TEN_DAYS = 10 * 24 * 60 * 60;

// --- tiny helpers ---
function reply(bool $ok, array $data = []): void
{
    echo json_encode(['success' => $ok] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Read JSON body (fallback to form POST)
$raw  = file_get_contents('php://input');
$body = json_decode($raw ?: '{}', true);
if (!is_array($body)) $body = $_POST;

$username = trim((string)($body['username'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($username === '' || $password === '') {
    reply(false, ['error' => 'Username and password are required.']);
}

// Look up user
$stmt = $pdo->prepare(
    "SELECT user_id, username, pass_hash, role, is_active
       FROM users
      WHERE username = :u
      LIMIT 1"
);
$stmt->execute([':u' => $username]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);

// Verify
$ok = $user && (int)$user['is_active'] === 1 && password_verify($password, $user['pass_hash']);
if (!$ok) {
    reply(false, ['error' => 'Invalid username or password.']);
}

// Best-effort last_login_at
try {
    $pdo->prepare("UPDATE users SET last_login_at = NOW() WHERE user_id = :id")
        ->execute([':id' => (int)$user['user_id']]);
} catch (Throwable $e) { /* ignore */
}

// HTTPS detection
$isHttps = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443)
);

// Session hygiene
@ini_set('session.gc_maxlifetime', (string)TEN_DAYS);
@ini_set('session.use_strict_mode', '1');
@ini_set('session.use_only_cookies', '1');
@ini_set('session.cookie_httponly', '1');
@ini_set('session.cookie_secure', $isHttps ? '1' : '0');
@ini_set('session.cookie_samesite', 'Strict');

session_name('ERASESSID');
session_set_cookie_params([
    'lifetime' => TEN_DAYS,
    'path'     => '/',
    'secure'   => $isHttps,
    'httponly' => true,
    'samesite' => 'Strict',
]);

session_start();
session_regenerate_id(true);

// ---- Your server-side session fields ----
$_SESSION['uid']       = (int)$user['user_id'];
$_SESSION['username']  = (string)$user['username'];
$_SESSION['role']      = (string)$user['role']; // Owner|Admin|Staff
$_SESSION['logincode'] = (in_array($_SESSION['role'], ['Owner', 'Admin', 'owner', 'admin'], true) ? '200068' : '200038');

// ---- NEW: stateless "remember me" cookie (no DB) ----
require __DIR__ . '/remember_helpers.php';
$remember = !empty($body['remember']); // pass true from your login form if you want persistence

if ($remember) {
    $claims = [
        'uid'  => $_SESSION['uid'],
        'un'   => $_SESSION['username'],
        'role' => $_SESSION['role'],
        'iat'  => time(),
        'exp'  => time() + REMEMBER_LIFETIME,
        'v'    => 1,
    ];
    $token = remember_build_token($claims);
    remember_set_cookie($token, $isHttps);
}

reply(true, [
    'redirect' => "/eraverse/sales_overview.html",
    'user' => [
        'id'   => $_SESSION['uid'],
        'name' => $_SESSION['username'],
        'role' => $_SESSION['role'],
    ],
]);
