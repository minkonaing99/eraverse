<?php

declare(strict_types=1);
require __DIR__ . '/api/session_bootstrap.php';
require __DIR__ . '/api/auth.php';

auth_require_login(['admin', 'staff', 'owner']);

$role = ucfirst($_SESSION['user']['role'] ?? '');
$user = htmlspecialchars($_SESSION['user']['username'] ?? 'Guest', ENT_QUOTES);
?>

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Eraverse • Sales Overview</title>
    <link rel="stylesheet" href="./style/style.min.css">
    <link rel="stylesheet" href="./style/loading.css">
    <link rel="stylesheet" href="./style/sales_overview.min.css">
    <link rel="stylesheet" href="./style/mobile_table.css">



</head>

<body>
    <div id="appLoader" aria-hidden="true">
        <div class="spinner" role="status" aria-label="Loading"></div>
    </div>

    <header id="navbar">
        <div class="logo" aria-label="Home">
            <a href="./sales_overview.php"><img src="./assets/logo_eraverse.png" alt="Logo"></a>
        </div>

        <nav aria-label="Primary">
            <div class="nav-links" id="navLinks">
                <a href="sales_overview.php">Sales Overview</a>
                <?php if (in_array(($_SESSION['user']['role'] ?? ''), ['admin', 'owner'])): ?>
                    <a href="product_catalog.php" aria-label="Product Catalog">Product Catalog</a>
                    <a href="summary.php" aria-label="Summary">Summary</a>
                <?php endif; ?>
                <a href="#" aria-label="LogOut" id="logoutBtn">Log Out</a>


            </div>

            <button class="burger" id="burger" aria-label="Menu Toggle">
                <div></div>
                <div></div>
                <div></div>
            </button>
        </nav>
    </header>

    <main class="page" role="main">

        <section class="sticky-menubar mb">
            <div class="menu-bar mb">
                <h2 id="subscriptions" class="era-table-title">Subscriptions</h2>
                <div class="btn-group">
                    <button class="icon-btn" id="refreshBtn"><img src="./assets/refresh.svg" alt="Refresh"></button>
                    <?php if (in_array(($_SESSION['user']['role'] ?? ''), ['admin', 'owner'])): ?>
                        <button class="icon-btn" id="downloadCsv"><img src="./assets/download.svg" alt="Download"></button>
                    <?php endif; ?>

                    <button class="icon-btn" id="searchBtn" type="button">
                        <img src="./assets/search.svg" alt="Search">
                    </button>
                    <div class="form-col" id="searchCustomerWrapper">
                        <input type="text" id="search_customer" placeholder="Name" autocomplete="off">
                    </div>
                    <button id="addSaleBtn" class="iconLabelBtn"><img src="./assets/add.svg" alt="">
                        <span class="btnLabel">Add Sales</span></button>
                </div>
            </div>


            <section class="era-table-card mb " id="add_sales" style="display: none;">
                <div class="menu-bar">
                    <h2 class="era-table-title">Add Sales</h2>
                </div>
                <div class="inputSalesForm">
                    <div id="inputRow" class="input-form">
                        <form>
                            <div class="form-row">
                                <div class="form-col">
                                    <label for="product" class="form-label text-danger">Product List</label>
                                    <select id="product">
                                        <option selected disabled>Choose...</option>
                                    </select>
                                </div>

                                <div class="form-col">
                                    <label for="customer" class="form-label text-danger">Customer</label>
                                    <input type="text" id="customer" placeholder="Name">
                                </div>

                                <div class="form-col">
                                    <label for="email" class="form-label">Email</label>
                                    <input type="text" id="email" placeholder="...@....">
                                </div>

                                <div class="form-col">
                                    <label for="purchase_date" class="form-label text-danger">Purchase Date</label>
                                    <input type="date" id="purchase_date">
                                </div>

                                <div class="form-col">
                                    <label for="seller" class="form-label">Manager</label>
                                    <input type="text" id="seller" placeholder="Manager">
                                </div>

                                <div class="form-col">
                                    <label for="amount" class="form-label">Amount</label>
                                    <input type="number" id="amount" step="1" placeholder="Enter price (optional)">
                                </div>

                                <div class="form-col">
                                    <label for="Notes" class="form-label">Notes</label>
                                    <input type="text" id="Notes" placeholder="Note" autocomplete="off">
                                </div>

                                <div class="form-col form-submit">
                                    <label class="invisible">Save</label>
                                    <button type="submit" class="form-btn iconLabelBtn"><img src="./assets/save.svg"
                                            alt=""><span class="">Save</span></button>
                                </div>
                                <div class="feedback_text" id="feedback_addSale"></div>

                            </div>

                            <!-- Hidden fields -->
                            <input type="hidden" id="renew">
                            <input type="hidden" id="duration">
                            <input type="hidden" id="end_date">
                        </form>
                    </div>

                </div>

            </section>



        </section>

        <section class="era-table-card" aria-labelledby="subscriptions">
            <div class="era-table-wrap">
                <table class="era-table" role="table">
                    <thead>
                        <tr>
                            <th class="era-num">#</th>
                            <th>Product</th>
                            <th class="era-dur column-hide">Dur</th>
                            <th class="era-renew" style="text-align: center;">Renew</th>
                            <th>Customer</th>
                            <th class=" era-email">Email</th>
                            <th style="text-align: center;">Purchased</th>
                            <th style="text-align: center;">End Date</th>
                            <th class=" era-supplier column-hide" style="text-align: left;">Manager</th>
                            <th class="column-hide">Note</th>
                            <th class=" era-price" style="text-align: right;">Price</th>
                            <th class="era-actions" aria-label="actions"></th>
                        </tr>
                    </thead>
                    <tbody id="sales_table">
                    </tbody>
                </table>
            </div>
        </section>

        <div class="subs-list" id="subsList">
        </div>



        <!-- Put this AFTER BOTH the table wrapper and the card list -->
        <div id="scrollSentinel" aria-hidden="true" style="height:1px;"></div>


    </main>
    <script>
        // ---- loader helpers ----
        const appLoaderEl = document.getElementById("appLoader");
        const showLoader = () => appLoaderEl?.classList.remove("hidden");
        const hideLoader = () => {
            if (!appLoaderEl) return;
            // let the first paint happen, then fade
            requestAnimationFrame(() => appLoaderEl.classList.add("hidden"));
        };
    </script>
    <script src="./js/loading.js"></script>
    <script src="./js/nav.js"></script>
    <script src="./js/sales_overview.js"></script>
    <script src="./js/download_csv.js"></script>



</body>

</html>