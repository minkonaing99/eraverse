<?php

declare(strict_types=1);
require __DIR__ . '/api/session_bootstrap.php';
require __DIR__ . '/api/auth.php';

auth_require_login(['admin', 'staff']);
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
    <title>Eraverse • Sales Overview</title>
    <link rel="stylesheet" href="./style/style.min.css">
    <link rel="stylesheet" href="./style/sales_overview.min.css">
    <style>
        .era-table-wrap {
            display: block;
        }

        .subs-list {
            display: none;
        }

        /* ===== RESPONSIVE TOGGLE: Mobile shows cards, hides table ===== */
        @media (max-width: 640px) {

            .era-table-wrap {
                display: none;
            }

            .subs-list {
                display: block;
            }


            .menu-bar {
                border-radius: 100px;
                border: 0px;

            }

            .subs-list {
                display: block;
            }

            .subs-card {
                background: var(--card);
                border: 1px solid var(--line);
                border-radius: 14px;
                padding: .9rem 1rem;
                color: #e6e9ef;
                box-shadow: 0 10px 30px rgba(0, 0, 0, .25);
                margin: .5rem 0rem;

            }

            .subs-card:hover {
                background: #131722;
            }

            .subs-row {
                margin: .28rem 0;
            }

            .subs-row-top {
                display: grid;
                grid-template-columns: 1fr 72px;
                align-items: center;
                gap: .5rem;
            }

            .subs-product {
                font-size: .8rem;
                text-align: left;
                font-weight: 700;
                line-height: 1.2;
            }

            .subs-renew {
                text-align: center;
                font-size: .8rem;

            }

            .subs-duration .era-badge {
                display: inline-flex;
                min-width: 28px;
                height: 20px;
                font-size: .72rem;
            }

            .subs-name {
                text-align: left;
                font-size: .8rem;

            }

            .subs-email {
                text-align: left;
                overflow-wrap: anywhere;
                font-size: .8rem;

            }

            .subs-dates {
                display: grid;
                grid-template-columns: 1fr 1fr;
                align-items: center;
                font-size: .8rem;

            }

            .subs-purchased {
                text-align: left;

            }

            .subs-expire {
                text-align: right;
            }

            .subs-label {
                display: inline-block;
                font-size: .7rem;
                color: #99a1b3;
                margin-right: rem;
            }

            .subs-price {
                text-align: right;
                font-weight: 500;
                font-variant-numeric: tabular-nums;
                font-size: .9rem;

            }



            /* tighten spacing on very small screens */
            .subs-row-top {
                grid-template-columns: 1fr 64px;
            }
        }

        @media (max-width: 300px) {
            .era-table-wrap {
                display: none;
            }

            .subs-list {
                display: block;
            }


            .subs-row-top {
                grid-template-columns: 1fr 64px;
            }

            .subs-label {
                display: none;
            }
        }
    </style>


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
                <?php if (($_SESSION['user']['role'] ?? '') === 'admin'): ?>
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

        <section class="era-table-card mb" id="add_sales">
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



        <section class="era-table-card" aria-labelledby="subscriptions">
            <div class="menu-bar">
                <h2 id="subscriptions" class="era-table-title">Subscriptions</h2>
                <div class="btn-group">
                    <button class="icon-btn" id="refreshBtn"><img src="./assets/refresh.svg" alt="Refresh"></button>
                    <?php if (($_SESSION['user']['role'] ?? '') === 'admin'): ?>
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

            <div class="era-table-wrap">
                <table class="era-table" role="table" aria-label="Subscriptions table">
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
    <script src="./js/nav.js"></script>
    <script src="./js/sales_overview.js"></script>
    <script src="./js/download_csv.js"></script>



</body>

</html>