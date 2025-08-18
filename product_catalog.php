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
    <title>Eraverse • Product Catalog</title>
    <link rel="stylesheet" href="./style/style.min.css">
    <link rel="stylesheet" href="./style/product_catalog.min.css">
</head>

<body>
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





        <!-- new -->
        <div class="sticky-menubar">
            <section class="era-table-card mb">
                <div class="menu-bar">
                    <h2 id="product_catalog" class="era-table-title">Product Catalog</h2>
                    <div class="btn-group">
                        <button id="userSettingBtn" class="iconLabelBtn catalogPage"><img src="./assets/user.svg"
                                alt="editUser">
                            <span class="btnLabel">User Setting</span></button>
                        <button id="addProductBtn" class="iconLabelBtn catalogPage"><img src="./assets/add.svg" alt="">
                            <span class="btnLabel">Add Product</span></button>
                    </div>
                </div>
            </section>


            <section class="era-table-card mb" id="user_setting">

                <div class="menu-bar">
                    <h2 class="era-table-title">User Setting</h2>
                </div>
                <div id="addUserRow" class="input-form">
                    <form>
                        <div class="form-row">
                            <div class="form-col">
                                <label for="username" class="form-label">Username</label>
                                <input type="text" id="username" placeholder="Username" autocomplete="off">
                            </div>
                            <div class="form-col">
                                <label for="password" class="form-label">Password</label>
                                <input type="password" id="password" placeholder="Passwrod" autocomplete="off">
                            </div>
                            <div class="form-col">
                                <label for="role" class="form-label">Role</label>
                                <select id="role">
                                    <option disabled>Choose...</option>
                                    <option selected>Staff</option>
                                    <option>Admin</option>
                                </select>
                            </div>

                            <div class="form-col form-submit">
                                <label class="invisible">Save</label>
                                <button type="submit" class="form-btn iconLabelBtn" style="width: 150px;">
                                    <img src="./assets/addUser.svg" alt="">Add User
                                </button>
                            </div>
                    </form>
                    <div id="feedback_addUser" class="feedback_text"></div>
                </div>
                <div id="delUserRow" class="input-form mt">
                    <form>
                        <div class="form-row">
                            <div class="form-col">
                                <label for="user" class="form-label">User</label>
                                <select id="user">
                                    <option selected disabled>Choose...</option>
                                </select>
                            </div>

                            <div class="form-col form-submit">
                                <label class="invisible">Save</label>
                                <button type="submit" class="form-btn iconLabelBtn" style="width: 160px;">
                                    <img src="./assets/deleteUser.svg" alt="">Delete User
                                </button>
                            </div>
                    </form>
                    <div id="feedback_delUser" class="form-feedback" style="display:none"></div>
                </div>
            </section>

            <section class="era-table-card mb" id="addProductForm">
                <div class="menu-bar">
                    <h2 class="era-table-title">Add Product</h2>
                </div>
                <div id="inputRow" class="input-form">
                    <form>
                        <div class="form-row">
                            <div class="form-col">
                                <label for="product" class="form-label text-danger">Product Name</label>
                                <input type="text" id="product" placeholder="Product Name">
                            </div>
                            <div class="form-col">
                                <label for="duration" class="form-label text-danger">Duration</label>
                                <input type="number" id="duration" placeholder="Duration">
                            </div>

                            <div class="form-col">
                                <label for="supplier" class="form-label">Supplier</label>
                                <input type="text" id="supplier" placeholder="Supplier">
                            </div>

                            <div class="form-col">
                                <label for="renewable" class="form-label">Need Monthly Renewable</label>
                                <select id="renewable" required>
                                    <option value="0">No</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="6">6</option>
                                    <option value="12">12</option>
                                </select>
                            </div>
                            <div class="form-col notes-col">
                                <label for="note" class="form-label">Note</label>
                                <input type="text" id="note" placeholder="Note" autocomplete="off">
                            </div>
                            <div class="form-col notes-col">
                                <label for="link" class="form-label">Link</label>
                                <input type="text" id="link" placeholder="www...." autocomplete="off">
                            </div>
                            <div class="form-col">
                                <label for="wholesale_amount" class="form-label text-danger">Wholesale Amount</label>
                                <input type="number" id="wholesale_amount" step="1" placeholder="Enter price">
                            </div>
                            <div class="form-col">
                                <label for="retail_amount" class="form-label text-danger">Retail Amount</label>
                                <input type="number" id="retail_amount" step="1" placeholder="Enter price">
                            </div>
                            <div class="form-col form-submit">
                                <label class="invisible">Save</label>
                                <button type="submit" class="form-btn iconLabelBtn disableBtn">
                                    <img src="./assets/save.svg" alt="">Save
                                </button>
                            </div>
                        </div>
                    </form>
                    <div class="feedback_text" id="feedback_addProduct"></div>
                </div>
            </section>

            <section class="era-table-card mb" id="editProductForm" style="display:none">
                <div class="menu-bar">
                    <h2 class="era-table-title">Edit Product</h2>
                </div>
                <div class="input-form">
                    <form id="editForm">
                        <input type="hidden" id="edit_product_id">
                        <div class="form-row">
                            <div class="form-col">
                                <label for="edit_product" class="form-label text-danger">Product Name</label>
                                <input type="text" id="edit_product" placeholder="Product Name">
                            </div>
                            <div class="form-col">
                                <label for="edit_duration" class="form-label text-danger">Duration</label>
                                <input type="number" id="edit_duration" placeholder="Duration">
                            </div>
                            <div class="form-col">
                                <label for="edit_supplier" class="form-label">Supplier</label>
                                <input type="text" id="edit_supplier" placeholder="Supplier">
                            </div>
                            <div class="form-col">
                                <label for="edit_renewable" class="form-label">Need Monthly Renewable</label>
                                <select id="edit_renewable">
                                    <option value="0">No</option>
                                    <option value="1">1</option>
                                    <option value="2">2</option>
                                    <option value="3">3</option>
                                    <option value="4">4</option>
                                    <option value="5">5</option>
                                    <option value="6">6</option>
                                    <option value="12">12</option>
                                </select>
                            </div>
                            <div class="form-col">
                                <label for="edit_note" class="form-label">Note</label>
                                <input type="text" id="edit_note" placeholder="Note" autocomplete="off">
                            </div>
                            <div class="form-col">
                                <label for="edit_link" class="form-label">Link</label>
                                <input type="text" id="edit_link" placeholder="www...." autocomplete="off">
                            </div>
                            <div class="form-col">
                                <label for="edit_wholesale_amount" class="form-label text-danger">Wholesale Amount</label>
                                <input type="number" id="edit_wholesale_amount" step="1" placeholder="Enter price">
                            </div>
                            <div class="form-col">
                                <label for="edit_retail_amount" class="form-label text-danger">Retail Amount</label>
                                <input type="number" id="edit_retail_amount" step="1" placeholder="Enter price">
                            </div>
                            <div class="form-col form-submit">
                                <label class="invisible">Save</label>
                                <button type="submit" class="form-btn iconLabelBtn"><img src="./assets/save.svg"
                                        alt="">Save</button>
                            </div>
                        </div>
                    </form>
                    <div class="feedback_text" id="feedback_editProduct"></div>
                </div>
            </section>
        </div>
        <!-- new -->

        <!-- Table -->
        <section class="era-table-card" aria-labelledby="product_catalog">
            <div class="era-table-wrap">
                <table class="era-table" role="table" aria-label="Catalog table">
                    <thead>
                        <tr>
                            <th class="era-num">#</th>
                            <th class="era-product">Product</th>
                            <th class="era-dur">Dur</th>
                            <th class="era-renew" style="text-align: center;">Renew</th>
                            <th class="era-supplier" style="text-align: center;">Supplier</th>
                            <th class="column-hide">Note</th>
                            <th class="column-hide">Link</th>
                            <th class="era-price" style="text-align: right;">WS Price</th>
                            <th class="era-price" style="text-align: right;">Retail Price</th>

                            <th class="era-actions" aria-label="actions"></th>
                        </tr>
                    </thead>
                    <tbody id="product_table">
                    </tbody>
                </table>
                <div id="scrollSentinel" style="height: 1px;"></div>
            </div>
        </section>
    </main>

    <script src="./js/nav.js"></script>
    <script src="./js/toggle.js"></script>
    <script src="./js/product_catalog.js"></script>
    <script src="./js/about_user.js"></script>
</body>

</html>