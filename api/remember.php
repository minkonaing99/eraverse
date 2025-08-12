<?php

declare(strict_types=1);

// ===== Config =====
const REMEMBER_COOKIE = 'era_remember';
const REMEMBER_DAYS   = 7;

// Put this in an env/secret manager. DO NOT commit a real key.
$REMEMBER_SECRET = getenv('ERAVERSE_REMEMBER_SECRET') ?: 'change-me-please-32bytes-min';

// ===== Helpers =====
function b64u(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}
function b64u_dec(string $str): string
{
    $pad = 4 - (strlen($str) % 4);
    if ($pad < 4) $str .= str_repeat('=', $pad);
    return base64_decode(strtr($str, '-_', '+/'), true) ?: '';
}
function remember_cookie_opts(): array
{
    return [
        'expires'  => time() + REMEMBER_DAYS * 86400,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

// Create + set cookie (absolute 7-day expiry)
// remember.php

// ... config + helpers unchanged ...

function remember_issue_cookie(int $userId, string $username, string $role): void
{
    global $REMEMBER_SECRET;
    $payload = [
        'uid' => $userId,
        'u'   => $username,
        'r'   => strtolower($role),
        'iat' => time(),
        'exp' => time() + REMEMBER_DAYS * 86400,
        // use HEX (text), not raw binary
        'uah' => hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? ''),
    ];
    $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        // optional: log json_last_error_msg() for diagnostics
        return;
    }
    $sig  = hash_hmac('sha256', $json, $REMEMBER_SECRET, true);
    $token = b64u($json) . '.' . b64u($sig);
    setcookie(REMEMBER_COOKIE, $token, remember_cookie_opts());
}

function remember_try_login_from_cookie(): bool
{
    // Already authenticated?
    if (!empty($_SESSION['auth'])) {
        return true;
    }

    $raw = $_COOKIE[REMEMBER_COOKIE] ?? '';
    if (!$raw || strpos($raw, '.') === false) {
        return false;
    }

    [$p64, $s64] = explode('.', $raw, 2);
    $json = b64u_dec($p64);
    $sig  = b64u_dec($s64);
    if ($json === '' || $sig === '') {
        return false;
    }

    // Verify HMAC signature
    global $REMEMBER_SECRET;
    $calc = hash_hmac('sha256', $json, $REMEMBER_SECRET, true);
    if (!hash_equals($sig, $calc)) {
        // Bad signature → toss the cookie
        remember_forget_cookie();
        return false;
    }

    // Decode payload
    $data = json_decode($json, true);
    if (!is_array($data)) {
        remember_forget_cookie();
        return false;
    }

    // Basic payload validation
    $uid = $data['uid'] ?? null;
    $usr = $data['u']   ?? '';
    $rol = $data['r']   ?? '';
    $exp = $data['exp'] ?? 0;

    // Normalize numeric fields
    if (!is_int($uid))  $uid = ctype_digit((string)$uid) ? (int)$uid : null;
    if (!is_int($exp))  $exp = ctype_digit((string)$exp) ? (int)$exp : 0;

    if ($uid === null || $usr === '' || $rol === '' || $exp <= 0) {
        remember_forget_cookie();
        return false;
    }

    // Expired?
    if ($exp < time()) {
        remember_forget_cookie();
        return false;
    }

    // Optional UA binding check (hex-to-hex)
    $uahCookie = (string)($data['uah'] ?? '');
    if ($uahCookie !== '') {
        $uahNow = hash('sha256', $_SERVER['HTTP_USER_AGENT'] ?? '');
        if (!hash_equals($uahCookie, $uahNow)) {
            return false;
        }
    }

    // Rebuild session (mirror auth_mark_login essentials)
    $_SESSION['auth'] = true;
    $_SESSION['user'] = [
        'id'       => (int)$uid,
        'username' => (string)$usr,
        'role'     => strtolower((string)$rol),
    ];

    // Fingerprint + timers so auth_require_login() won’t reject us
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $ipMask = preg_replace('~^((\d+\.){2}).*$~', '$1', $ip); // e.g. "203.0."
    $_SESSION['fingerprint'] = hash('sha256', $ua . '|' . $ipMask);

    $now = time();
    $_SESSION['created_at']    = $_SESSION['created_at'] ?? $now; // keep original if somehow present
    $_SESSION['last_seen_at']  = $now;
    $_SESSION['last_regen_at'] = $now;

    // Fixation protection
    session_regenerate_id(true);

    // Optional: sliding window refresh (extend cookie on use)
    // setcookie(REMEMBER_COOKIE, $raw, remember_cookie_opts());

    return true;
}



// Clear cookie
function remember_forget_cookie(): void
{
    if (isset($_COOKIE[REMEMBER_COOKIE])) {
        setcookie(REMEMBER_COOKIE, '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'secure'   => !empty($_SERVER['HTTPS']),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}
