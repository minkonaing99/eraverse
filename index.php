<?php

declare(strict_types=1);
require __DIR__ . '/api/session_bootstrap.php';
require __DIR__ . '/api/remember.php';

if (!empty($_SESSION['auth']) || remember_try_login_from_cookie()) {
    header('Location: sales_overview.php');
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Eraverse • Login </title>
    <link rel="stylesheet" href="./style/style.min.css">
    <link rel="stylesheet" href="./style/login.min.css">
</head>

<body>
    <main class="auth-wrapper">
        <section class="auth-card" role="dialog" aria-labelledby="title">
            <h1 id="title" class="auth-title">Sign in to Eraverse</h1>

            <form id="loginForm" novalidate>
                <div class="field">
                    <label for="username" class="label">Username</label>
                    <input class="input" id="username" name="username" type="text" placeholder="username"
                        autocomplete="off" required />
                </div>

                <div class="field">
                    <label for="password" class="label">Password</label>
                    <div class="row">
                        <input class="input" id="password" name="password" type="password"
                            placeholder="*****************" autocomplete="off" required />
                        <button type="button" class="icon-btn" id="togglePass" aria-label="Show password">
                            <img id="toggleIcon" src="./assets/eye.svg" alt="" />
                        </button>
                    </div>

                </div>
                <button class="submit" type="submit" id="loginBtn">Log In</button>
                <div id="feedbackLogin" class="feedback"></div>
            </form>
        </section>
    </main>
    <script src="./js/auth.js"></script>
</body>

</html>