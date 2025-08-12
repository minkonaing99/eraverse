<?php

declare(strict_types=1);

// ... your same session ini settings as above ...
session_name('ERASESSID');
session_start();

$isHttps = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443)
);

if (empty($_SESSION['uid'])) {
    require __DIR__ . '/remember_helpers.php';
    remember_try_restore_session($isHttps);
}

// Now check auth:
if (empty($_SESSION['uid'])) {
    header('Location: /login.html');
    exit;
}
