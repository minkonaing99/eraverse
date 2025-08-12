<?php

declare(strict_types=1);

/**
 * Call after session_start(). Use on login and every request.
 */

const IDLE_TIMEOUT_SECONDS     = 15 * 60;  // auto-logout after 15 minutes idle
const ABSOLUTE_TIMEOUT_SECONDS = 8  * 60 * 60; // force re-login after 8 hours
const REGENERATE_EVERY_SECONDS = 5  * 60;  // rotate session ID every 5 minutes

function auth_is_logged_in(): bool
{
    return isset($_SESSION['auth']) && $_SESSION['auth'] === true
        && isset($_SESSION['user']['username'], $_SESSION['user']['role']);
}

function auth_mark_login(array $dbUserRow): void
{
    // Minimal user payload in session; never store secrets
    $_SESSION['auth'] = true;
    $_SESSION['user'] = [
        'id'       => (int)$dbUserRow['user_id'],
        'username' => (string)$dbUserRow['username'],
        'role'     => strtolower((string)$dbUserRow['role']),
    ];

    // Bind session to UA (+ optionally first 2 octets of IP)
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ipMask = preg_replace('~^((\d+\.){2}).*$~', '$1', $ip); // e.g., "203.0."
    $_SESSION['fingerprint'] = hash('sha256', $ua . '|' . $ipMask);

    // Time bookkeeping
    $now = time();
    $_SESSION['created_at']  = $now;
    $_SESSION['last_seen_at'] = $now;
    $_SESSION['last_regen_at'] = $now;

    // Fixation protection
    session_regenerate_id(true);
}

function auth_require_login(array $allowedRoles = []): void
{
    // 1) Must be logged in
    if (!auth_is_logged_in()) {
        auth_fail();
    }

    $now = time();

    // 2) Fingerprint (basic hijack mitigation)
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ipMask = preg_replace('~^((\d+\.){2}).*$~', '$1', $ip);
    $expected = hash('sha256', $ua . '|' . $ipMask);
    if (!hash_equals($_SESSION['fingerprint'] ?? '', $expected)) {
        auth_fail();
    }

    // 3) Absolute timeout
    if (($now - ($_SESSION['created_at'] ?? 0)) > ABSOLUTE_TIMEOUT_SECONDS) {
        auth_fail();
    }

    // 4) Idle timeout
    if (($now - ($_SESSION['last_seen_at'] ?? 0)) > IDLE_TIMEOUT_SECONDS) {
        auth_fail();
    }

    // 5) Periodic ID rotation
    if (($now - ($_SESSION['last_regen_at'] ?? 0)) > REGENERATE_EVERY_SECONDS) {
        session_regenerate_id(true);
        $_SESSION['last_regen_at'] = $now;
    }

    // 6) Role check (case-insensitive)
    if ($allowedRoles) {
        $role = strtolower($_SESSION['user']['role'] ?? '');
        $allowed = array_map('strtolower', $allowedRoles);
        if (!in_array($role, $allowed, true)) {
            http_response_code(403);
            exit('Forbidden');
        }
    }

    // 7) Update last seen
    $_SESSION['last_seen_at'] = $now;
}

function auth_fail(): void
{
    // Clean + redirect to login
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
    header('Location: index.php');
    exit;
}
