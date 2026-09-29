/* =========================================================
   DOMPETKU
   Aplikasi Keuangan Mahasiswa
   ========================================================= */

/* =========================
   DATA & STORAGE
   ========================= */

const STORAGE_KEY = "dompetku";

const DEFAULT_DATA = {
    budget: 500000,
    mode: "weekly",
    transactions: []
};

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return { ...DEFAULT_DATA };
        }

        const parsed = JSON.parse(saved);

        if (!parsed || typeof parsed !== "object") {
            return { ...DEFAULT_DATA };
        }

        return {
            budget: Number(parsed.budget) > 0
                ? Number(parsed.budget)
                : DEFAULT_DATA.budget,

            mode: parsed.mode === "monthly"
                ? "monthly"
                : "weekly",

            transactions: Array.isArray(parsed.transactions)
                ? parsed.transactions
                : []
        };

    } catch (error) {
        console.error("Gagal membaca data:", error);
        return { ...DEFAULT_DATA };
    }
}

let data = loadData();

let selectedCategory = "Makan";


/* =========================
   SAVE DATA
   ========================= */

function saveData() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );
    } catch (error) {
        console.error("Gagal menyimpan data:", error);

        alert(
            "Data tidak dapat disimpan. " +
            "Pastikan penyimpanan browser tersedia."
        );
    }
}


/* =========================
   FORMAT RUPIAH
   ========================= */

function formatRupiah(number) {

    const value = Number(number);

    if (!Number.isFinite(value)) {
        return "Rp0";
    }

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Math.round(value));
}


/* =========================
   TANGGAL
   ========================= */

function getToday() {

    const date = new Date();

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
}


function parseDate(dateString) {

    if (!dateString) {
        return null;
    }

    const parts = String(dateString).split("-");

    if (parts.length !== 3) {
        return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (!year || !month || !day) {
        return null;
    }

    return new Date(
        year,
        month - 1,
        day
    );
}


/* =========================
   MINGGU
   ========================= */

/*
   Minggu dihitung Senin-Minggu.
*/

function getStartOfWeek() {

    const date = new Date();

    const day = date.getDay();

    const difference =
        day === 0
            ? -6
            : 1 - day;

    date.setDate(
        date.getDate() + difference
    );

    date.setHours(0, 0, 0, 0);

    return date;
}


function isThisWeek(transaction) {

    const transactionDate =
        parseDate(transaction.date);

    if (!transactionDate) {
        return false;
    }

    return transactionDate >= getStartOfWeek();
}


/* =========================
   PERIODE ANGGARAN
   ========================= */

/*
   JUMLAH HARI PERIODE
   -------------------

   Mingguan:
   7 hari

   Bulanan:
   jumlah hari pada bulan tersebut.
*/

function getPeriodDays() {

    if (data.mode === "weekly") {

        return 7;

    }

    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
    ).getDate();
}


/* =========================
   SISA HARI PERIODE
   ========================= */

function getDaysRemaining() {

    if (data.mode === "weekly") {

        const day = new Date().getDay();

        return day === 0
            ? 1
            : 8 - day;
    }

    const now = new Date();

    const lastDay = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
    ).getDate();

    return (
        lastDay -
        now.getDate() +
        1
    );
}


/* =========================
   PENGELUARAN HARI INI
   ========================= */

function getTodaySpent() {

    return data.transactions
        .filter(transaction =>
            transaction.date === getToday()
        )
        .reduce(
            (total, transaction) =>
                total + Number(transaction.amount || 0),
            0
        );
}


/* =========================
   PENGELUARAN MINGGU INI
   ========================= */

function getWeekSpent() {

    return data.transactions
        .filter(isThisWeek)
        .reduce(
            (total, transaction) =>
                total + Number(transaction.amount || 0),
            0
        );
}


/* =========================
   PENGELUARAN PERIODE
   ========================= */

function getPeriodSpent() {

    if (data.mode === "weekly") {

        return getWeekSpent();

    }

    const now = new Date();

    return data.transactions
        .filter(transaction => {

            const date =
                parseDate(transaction.date);

            if (!date) {
                return false;
            }

            return (
                date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear()
            );
        })
        .reduce(
            (total, transaction) =>
                total + Number(transaction.amount || 0),
            0
        );
}


/* =========================================================
   BATAS MAKSIMAL PENGELUARAN PER HARI
   ========================================================= */

/*
   INI BAGIAN PALING PENTING.

   Batas harian TIDAK menggunakan:

       saldo tersisa / sisa hari

   Karena cara tersebut membuat batas harian berubah.

   Contoh cara lama:

       Rp500.000 / 7
       = Rp71.429

   Jika hari pertama hanya menghabiskan Rp20.000:

       Rp480.000 / 6
       = Rp80.000

   Ini TIDAK kita gunakan.
*/


function calculateDailyLimit() {

    // Batas normal per hari
    const periodDays = getPeriodDays();

    if (periodDays <= 0) {
        return 0;
    }

    const baseDailyLimit =
        data.budget / periodDays;


    // =========================================
    // CARI PENGELUARAN HARI SEBELUMNYA
    // =========================================

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);

    yesterday.setDate(
        yesterday.getDate() - 1
    );

    const yesterdayString =
        `${yesterday.getFullYear()}-${String(
            yesterday.getMonth() + 1
        ).padStart(2, "0")}-${String(
            yesterday.getDate()
        ).padStart(2, "0")}`;


    // =========================================
    // HITUNG TOTAL PENGELUARAN KEMARIN
    // =========================================

    const yesterdaySpent =
        data.transactions
            .filter(transaction =>
                transaction.date ===
                yesterdayString
            )
            .reduce(
                (total, transaction) =>
                    total +
                    Number(
                        transaction.amount || 0
                    ),
                0
            );


    // =========================================
    // HITUNG KELEBIHAN PENGELUARAN KEMARIN
    // =========================================

    const excess =
        Math.max(
            yesterdaySpent -
            baseDailyLimit,
            0
        );


    // =========================================
    // BATAS HARI INI
    // =========================================

    const todayLimit =
        baseDailyLimit -
        excess;


    return Math.max(
        todayLimit,
        0
    );
}


/* =========================
   UPDATE DASHBOARD
   ========================= */

function updateDashboard() {

    const spentToday =
        getTodaySpent();

    const spentPeriod =
        getPeriodSpent();

    /*
       Saldo sebenarnya.
    */

    const remaining =
        Math.max(
            data.budget - spentPeriod,
            0
        );

    /*
       Batas harian TETAP.
    */

    const dailyLimit =
        calculateDailyLimit();

    /*
       Sisa batas pengeluaran
       untuk HARI INI.

       Ini berbeda dengan saldo.
    */

    const todayRemaining =
        dailyLimit - spentToday;


    /* =========================
       SALDO
       ========================= */

    const remainingMoney =
        document.getElementById(
            "remainingMoney"
        );

    if (remainingMoney) {

        remainingMoney.textContent =
            formatRupiah(remaining);
    }


    /* =========================
       SALDO PERIODE
       ========================= */

    const periodRemaining =
        document.getElementById(
            "periodRemaining"
        );

    if (periodRemaining) {

        periodRemaining.textContent =
            formatRupiah(remaining);
    }


    /* =========================
       LABEL PERIODE
       ========================= */

    const periodLabel =
        document.getElementById(
            "periodLabel"
        );

    if (periodLabel) {

        periodLabel.textContent =
            data.mode === "weekly"
                ? "Minggu ini"
                : "Bulan ini";
    }


    /* =========================
       BATAS HARIAN
       ========================= */

    const dailyLimitElement =
        document.getElementById(
            "dailyLimit"
        );

    if (dailyLimitElement) {

        dailyLimitElement.textContent =
            formatRupiah(dailyLimit);
    }


    /* =========================
       PENGELUARAN HARI INI
       ========================= */

    const todaySpent =
        document.getElementById(
            "todaySpent"
        );

    if (todaySpent) {

        todaySpent.textContent =
            "Terpakai " +
            formatRupiah(spentToday);
    }


    /* =========================
       SISA BATAS HARI INI
       ========================= */

    const todayRemainingElement =
        document.getElementById(
            "todayRemaining"
        );

    if (todayRemainingElement) {

        if (todayRemaining >= 0) {

            todayRemainingElement.textContent =
                "Sisa batas " +
                formatRupiah(todayRemaining);

        } else {

            todayRemainingElement.textContent =
                "Melebihi batas " +
                formatRupiah(
                    Math.abs(todayRemaining)
                );
        }
    }


    /* =========================
       TOTAL HARI INI
       ========================= */

    const todayTotal =
        document.getElementById(
            "todayTotal"
        );

    if (todayTotal) {

        todayTotal.textContent =
            formatRupiah(spentToday);
    }


    /* =========================
       TOTAL MINGGU
       ========================= */

    const weekTotal =
        document.getElementById(
            "weekTotal"
        );

    if (weekTotal) {

        weekTotal.textContent =
            formatRupiah(
                getWeekSpent()
            );
    }


    /* =========================
       PROGRESS BAR
       ========================= */

    const progressBar =
        document.getElementById(
            "progressBar"
        );

    if (progressBar) {

        let percentage = 0;

        if (dailyLimit > 0) {

            percentage =
                (spentToday / dailyLimit) * 100;

            percentage =
                Math.min(
                    Math.max(
                        percentage,
                        0
                    ),
                    100
                );
        }

        progressBar.style.width =
            percentage + "%";
    }


    /* =========================
       STATUS
       ========================= */

    const badge =
        document.getElementById(
            "statusBadge"
        );

    if (badge) {

        badge.className = "status";

        if (spentToday > dailyLimit) {

            badge.textContent =
                "Melebihi";

            badge.classList.add(
                "danger"
            );

        } else if (
            spentToday >=
            dailyLimit * 0.8
        ) {

            badge.textContent =
                "Waspada";

            badge.classList.add(
                "warning"
            );

        } else {

            badge.textContent =
                "Aman";
        }
    }


    /* =========================
       TRANSAKSI
       ========================= */

    renderTransactions();
}


/* =========================
   TRANSAKSI
   ========================= */

function renderTransactions() {

    const container =
        document.getElementById(
            "transactionList"
        );

    if (!container) {
        return;
    }

    const transactions =
        [...data.transactions]
            .sort(
                (a, b) =>
                    new Date(
                        b.createdAt || b.date
                    ) -
                    new Date(
                        a.createdAt || a.date
                    )
            )
            .slice(0, 5);


    if (!transactions.length) {

        container.innerHTML = `
            <div class="empty">
                <div>💸</div>
                <p>Belum ada pengeluaran</p>
                <small>
                    Catat pengeluaran pertamamu hari ini.
                </small>
            </div>
        `;

        return;
    }


    container.innerHTML =
        transactions
            .map(transactionHTML)
            .join("");
}


/* =========================
   HTML TRANSAKSI
   ========================= */

function transactionHTML(transaction) {

    const icons = {

        Makan: "🍜",
        Transportasi: "🛵",
        Kuliah: "📚",
        Kos: "🏠",
        Belanja: "🛒",
        Hiburan: "🎮",
        Lainnya: "📦"
    };


    return `
        <div class="transaction">

            <div class="transaction-icon">
                ${icons[transaction.category] || "📦"}
            </div>

            <div class="transaction-info">

                <strong>
                    ${escapeHTML(
                        transaction.category ||
                        "Lainnya"
                    )}
                </strong>

                <small>
                    ${escapeHTML(
                        transaction.note ||
                        "Tanpa catatan"
                    )}

                    •

                    ${formatDate(
                        transaction.createdAt ||
                        transaction.date
                    )}
                </small>

            </div>

            <div class="transaction-amount">

                ${formatRupiah(
                    transaction.amount
                )}

            </div>

            <button
                class="delete-btn"
                onclick="deleteTransaction('${escapeHTML(
                    transaction.id
                )}')"
            >
                ×
            </button>

        </div>
    `;
}


/* =========================
   TAMBAH PENGELUARAN
   ========================= */

function addExpense() {

    const amountInput =
        document.getElementById(
            "expenseAmount"
        );

    const noteInput =
        document.getElementById(
            "expenseNote"
        );


    const amount =
        Number(
            amountInput
                ? amountInput.value
                : 0
        );


    const note =
        noteInput
            ? noteInput.value.trim()
            : "";


    /* Validasi */

    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Masukkan nominal pengeluaran yang valid."
        );

        return;
    }


    /*
       Mencegah input angka
       yang tidak masuk akal.
    */

    if (amount > 1000000000) {

        alert(
            "Nominal pengeluaran terlalu besar."
        );

        return;
    }


    /* Simpan transaksi */

    data.transactions.push({

        id:
            Date.now().toString() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2, 8),

        amount:
            Math.round(amount),

        category:
            selectedCategory || "Makan",

        note:

            note,

        date:
            getToday(),

        createdAt:
            new Date().toISOString()
    });


    saveData();

    closeExpenseModal();

    clearExpenseForm();

    updateDashboard();
}


/* =========================
   HAPUS TRANSAKSI
   ========================= */

function deleteTransaction(id) {

    if (
        !confirm(
            "Hapus pengeluaran ini?"
        )
    ) {
        return;
    }


    data.transactions =
        data.transactions.filter(
            transaction =>
                String(transaction.id) !==
                String(id)
        );


    saveData();

    updateDashboard();
}


/* =========================
   MODAL PENGELUARAN
   ========================= */

function openExpenseModal() {

    const modal =
        document.getElementById(
            "expenseModal"
        );

    if (!modal) {
        return;
    }


    modal.classList.add("show");


    setTimeout(() => {

        const input =
            document.getElementById(
                "expenseAmount"
            );

        if (input) {
            input.focus();
        }

    }, 250);
}


function closeExpenseModal() {

    const modal =
        document.getElementById(
            "expenseModal"
        );

    if (modal) {

        modal.classList.remove(
            "show"
        );
    }
}


function clearExpenseForm() {

    const amount =
        document.getElementById(
            "expenseAmount"
        );

    const note =
        document.getElementById(
            "expenseNote"
        );


    if (amount) {
        amount.value = "";
    }

    if (note) {
        note.value = "";
    }
}


/* =========================
   KATEGORI
   ========================= */

function selectCategory(
    button,
    category
) {

    document
        .querySelectorAll(
            ".categories button"
        )
        .forEach(item =>
            item.classList.remove(
                "selected"
            )
        );


    if (button) {

        button.classList.add(
            "selected"
        );
    }


    selectedCategory =
        category;
}


/* =========================
   SETTINGS
   ========================= */

function openSettings() {

    const modal =
        document.getElementById(
            "settingsModal"
        );

    if (!modal) {
        return;
    }


    modal.classList.add("show");


    const budgetInput =
        document.getElementById(
            "budgetAmount"
        );

    const modeInput =
        document.getElementById(
            "budgetMode"
        );


    if (budgetInput) {

        budgetInput.value =
            data.budget;
    }


    if (modeInput) {

        modeInput.value =
            data.mode;
    }
}


function closeSettings() {

    const modal =
        document.getElementById(
            "settingsModal"
        );

    if (modal) {

        modal.classList.remove(
            "show"
        );
    }
}


/* =========================
   SIMPAN SETTINGS
   ========================= */

function saveSettings() {

    const budgetInput =
        document.getElementById(
            "budgetAmount"
        );

    const modeInput =
        document.getElementById(
            "budgetMode"
        );


    const amount =
        Number(
            budgetInput
                ? budgetInput.value
                : 0
        );


    const mode =
        modeInput
            ? modeInput.value
            : "weekly";


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Masukkan jumlah uang yang valid."
        );

        return;
    }


    if (
        mode !== "weekly" &&
        mode !== "monthly"
    ) {

        alert(
            "Mode anggaran tidak valid."
        );

        return;
    }


    data.budget =
        Math.round(amount);

    data.mode =
        mode;


    saveData();

    closeSettings();

    updateDashboard();
}


/* =========================
   RESET DATA
   ========================= */

function resetAllData() {

    if (
        !confirm(
            "Semua data pengeluaran akan dihapus. Lanjutkan?"
        )
    ) {

        return;
    }


    localStorage.removeItem(
        STORAGE_KEY
    );


    data = {
        ...DEFAULT_DATA,
        transactions: []
    };


    saveData();

    updateDashboard();
}


/* =========================
   LIHAT SEMUA TRANSAKSI
   ========================= */

function showAllTransactions() {

    if (!data.transactions.length) {

        alert(
            "Belum ada transaksi."
        );

        return;
    }


    const total =
        data.transactions.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.amount || 0
                ),
            0
        );


    alert(
        "Total seluruh pengeluaran: " +
        formatRupiah(total)
    );
}


/* =========================
   FORMAT TANGGAL
   ========================= */

function formatDate(dateString) {

    if (!dateString) {
        return "-";
    }


    const date =
        new Date(
            dateString.includes("T")
                ? dateString
                : dateString + "T00:00:00"
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";
    }


    return date.toLocaleDateString(
        "id-ID",
        {
            day: "numeric",
            month: "short"
        }
    );
}


/* =========================
   SECURITY
   ========================= */

function escapeHTML(text) {

    return String(
        text ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

updateDashboard();


/* =========================
   TUTUP MODAL
   SAAT KLIK DI LUAR
   ========================= */

const expenseModal =
    document.getElementById(
        "expenseModal"
    );

if (expenseModal) {

    expenseModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target === this
            ) {

                closeExpenseModal();
            }
        }
    );
}


const settingsModal =
    document.getElementById(
        "settingsModal"
    );

if (settingsModal) {

    settingsModal.addEventListener(
        "click",
        function(event) {

            if (
                event.target === this
            ) {

                closeSettings();
            }
        }
    );
}


/* =========================================================
   AUTO UPDATE SAAT HARI BERGANTI
   ========================================================= */

let lastKnownDate =
    getToday();


setInterval(() => {

    const currentDate =
        getToday();


    if (
        currentDate !==
        lastKnownDate
    ) {

        lastKnownDate =
            currentDate;

        updateDashboard();
    }

}, 30000);