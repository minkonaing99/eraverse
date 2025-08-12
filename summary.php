<?php

declare(strict_types=1);
require __DIR__ . '/api/session_bootstrap.php';
require __DIR__ . '/api/auth.php';

auth_require_login(['admin']);
?>

<?php
$role = ucfirst($_SESSION['user']['role'] ?? '');
$user = htmlspecialchars($_SESSION['user']['username'] ?? 'Guest', ENT_QUOTES);
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Eraverse • Summary</title>
    <link rel="stylesheet" href="./style/style.css">
    <link rel="stylesheet" href="./style/summary.css">



</head>

<body>
    <header id="navbar">
        <div class="logo" aria-label="Home">
            <a href="./sales_overview.php"><img src="./assets/logo_eraverse.png" alt="Logo"></a>
        </div>

        <nav aria-label="Primary">
            <div class="nav-links" id="navLinks">
                <a href="sales_overview.php">Sales Overview</a>
                <?php if (($_SESSION['user']['role'] ?? '') === 'admin'): ?>
                    <a href="product_catalog.php" aria-label="Product Catalog">Product Catalog</a>
                    <a href="summary.php" aria-label="Summary">Summary</a>
                <?php endif; ?>
                <a href="./api/logout.php" aria-label="LogOut" id="logoutBtn">Log Out</a>
            </div>

            <button class="burger" id="burger" aria-label="Menu Toggle">
                <div></div>
                <div></div>
                <div></div>
            </button>
        </nav>
    </header>

    <main class="page" role="main">


        <section class="era-table-card mb" aria-labelledby="tbl-title">
            <div class="menu-bar">
                <h2 id="tbl-title" class="era-table-title">Summary</h2>
            </div>
            <!-- KPI Summary -->
            <div class="kpi-grid">
                <article class="kpi-card">
                    <div class="kpi-label">Daily Sales</div>
                    <div class="kpi-value" data-target="0" data-suffix=" Ks">123456789
                    </div>
                </article>

                <article class="kpi-card">
                    <div class="kpi-label">Daily Profits</div>
                    <div class="kpi-value" data-target="0" data-suffix=" Ks">111100000</div>
                </article>

                <article class="kpi-card">
                    <div class="kpi-label">Monthly Sales</div>
                    <div class="kpi-value" data-target="1007500" data-suffix=" Ks">123456789</div>
                </article>

                <article class="kpi-card">
                    <div class="kpi-label">Monthly Profits</div>
                    <div class="kpi-value" data-target="407500" data-suffix=" Ks">123456789</div>
                </article>
            </div>
        </section>

        <section class="era-table-card mb" aria-labelledby="tbl-title">
            <div class="menu-bar">
                <h2 id="tbl-title" class="era-table-title">Expire Soon</h2>
            </div>

            <!-- Table -->
            <div class="era-table-wrap">
                <table class="era-table" role="table" aria-label="Subscriptions table">
                    <thead>
                        <tr>
                            <th class="era-num">#</th>
                            <th>Product</th>
                            <th style="text-align: center;">Customer</th>
                            <th class="era-email">Email</th>
                            <th style="text-align: center;">Purchased</th>
                            <th style="text-align: center;">End Date</th>
                            <th style="text-align: right;">Date Left</th>
                        </tr>
                    </thead>
                    <tbody id="expire_soon">

                    </tbody>
                </table>
            </div>
        </section>


        <section class="era-table-card mb" aria-labelledby="tbl-title">
            <div class="menu-bar">
                <h2 id="tbl-title" class="era-table-title">Daily Product Sold</h2>
            </div>

            <!-- Table -->
            <div class="era-table-wrap">

                <div class="charts-row">
                    <div class="chart-card"><canvas id="chartDailySales" aria-label="Daily Sales by Product"></canvas>
                    </div>
                    <div class="chart-card"><canvas id="chartDailyProfit" aria-label="Daily Profit by Product"></canvas>
                    </div>
                    <div class="chart-card"><canvas id="chartDailyCount" aria-label="Daily Count by Product"></canvas>
                    </div>
                </div>
            </div>
        </section>

        <section class="era-table-card mb" aria-labelledby="tbl-title">
            <div class="menu-bar">
                <h2 id="tbl-title" class="era-table-title">Need Renewable</h2>
            </div>

            <!-- Table -->
            <div class="era-table-wrap">
                <table class="era-table" role="table" aria-label="Subscriptions table">
                    <thead>
                        <tr>
                            <th class="era-num">#</th>
                            <th>Product</th>
                            <th style="text-align: center;">Customer</th>
                            <th class="era-email">Email</th>
                            <th style="text-align: center;">Purchased</th>
                            <th style="text-align: center;">Renewable Date</th>
                            <th style="text-align: right;">Date Left</th>
                        </tr>
                    </thead>
                    <tbody id="need_renew">

                    </tbody>
                </table>
            </div>
        </section>

        <section class="era-table-card mb" aria-labelledby="tbl-title">
            <div class="menu-bar">
                <h2 id="tbl-title" class="era-table-title">30-day Sales & Profit Summary</h2>
            </div>

            <div class="era-table-wrap">
                <div class="chart-card"
                    style="height:360px;background:transparent;border:1px solid #1b1f2a;border-radius:12px;padding:10px;">
                    <canvas id="salesProfitLine" aria-label="Daily Sales & Profit (Last 30 Days)"></canvas>
                </div>
            </div>
        </section>

    </main>

    <script src="./js/nav.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
    <script src="./js/deplay_chart.js"></script>
    <script src="./js/summary_table.js"></script>

</body>

</html>