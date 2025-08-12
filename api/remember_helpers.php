<?php

declare(strict_types=1);

// ---- config ----
const REMEMBER_COOKIE   = 'ERAREMEM';
const REMEMBER_DAYS     = 30;
const REMEMBER_LIFETIME = REMEMBER_DAYS * 86400;

// base64url helpers
function b64url(string $bin): string
{
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}
function b64url_decode(string $str)
{
    return base64_decode(strtr($str, '-_', '+/'));
}

// Load secret from env or a local file (created on first run)
function remember_secret(): string
{
    $b64 = getenv('ERAREMEM_SECRET') ?: '';
    if ($b64 === '') {
        $path = __DIR__ . '/.remember.secret';
        if (!is_file($path)) {
            $k = random_bytes(32);
            file_put_contents($path, base64_encode($k));
            @chmod($path, 0600);
        }
        $b64 = trim((string)file_get_contents($path));
    }
    $key = base64_decode($b64, true);
    if ($key === false || strlen($key) < 32) {
        throw new RuntimeException('Bad ERAREMEM_SECRET');
    }
    return $key;
}

// Build HMAC-signed token from claims (no DB)
function remember_build_token(array $claims): string
{
    $key = remember_secret();
    $payload = json_encode($claims, JSON_UNESCAPED_SLASHES);
    $sig = hash_hmac('sha256', $payload, $key, true);
    return b64url($payload) . '.' . b64url($sig);
}

// Verify token & return claims or null
function remember_parse_token(string $token): ?array
{
    $parts = explode('.', $token, 2);
    if (count($parts) !== 2) return null;
    [$p64, $s64] = $parts;
    $payload = b64url_decode($p64);
    $sig     = b64url_decode($s64);
    if ($payload === false || $sig === false) return null;

    $key = remember_secret();
    $calc = hash_hmac('sha256', $payload, $key, true);
    if (!hash_equals($calc, $sig)) return null;

    $claims = json_decode($payload, true);
    if (!is_array($claims)) return null;

    if (!isset($claims['exp']) || time() >= (int)$claims['exp']) return null;
    return $claims;
}

function remember_set_cookie(string $token, bool $isHttps): void
{
    setcookie(REMEMBER_COOKIE, $token, [
        'expires'  => time() + REMEMBER_LIFETIME,
        'path'     => '/',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}
function remember_clear_cookie(bool $isHttps): void
{
    setcookie(REMEMBER_COOKIE, '', [
        'expires'  => time() - 3600,
        'path'     => '/',
        'secure'   => $isHttps,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

// Try restoring session from cookie (call early on each request)
function remember_try_restore_session(bool $isHttps): bool
{
    if (empty($_COOKIE[REMEMBER_COOKIE])) return false;
    $claims = remember_parse_token($_COOKIE[REMEMBER_COOKIE]);
    if (!$claims) {
        remember_clear_cookie($isHttps);
        return false;
    }

    // Recreate session from claims
    session_regenerate_id(true);
    $_SESSION['uid']      = (int)$claims['uid'];
    $_SESSION['username'] = (string)$claims['un'];
    $_SESSION['role']     = (string)$claims['role'];

    // Derive your "logincode" serverside, not from the cookie
    $_SESSION['logincode'] = (in_array($_SESSION['role'], ['admin', 'owner', 'Owner', 'Admin'], true) ? '200068' : '200038');

    // Rotate token (refresh exp/iat)
    $claims['iat'] = time();
    $claims['exp'] = time() + REMEMBER_LIFETIME;
    remember_set_cookie(remember_build_token($claims), $isHttps);

    return true;
}
