<?php

declare(strict_types=1);

// Must be set BEFORE session_start()
ini_set('session.use_strict_mode', '1');        // Reject uninitialized IDs
ini_set('session.use_only_cookies', '1');       // No URL-based session IDs
ini_set('session.cookie_httponly', '1');        // JS can't read it
ini_set('session.cookie_samesite', 'Lax');      // Or 'Strict' if your flows allow
ini_set('session.cookie_secure', isset($_SERVER['HTTPS']) ? '1' : '0'); // HTTPS only in prod
ini_set('session.cookie_lifetime', '0');        // Session cookie (until browser close)
ini_set('session.gc_maxlifetime', '28800');     // 8h server-side max (match absolute timeout)

session_name('ERASESSID');                      // Custom name to avoid defaults
session_start();

// Extra: prevent back-button on protected pages
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
