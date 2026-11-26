/* =========================================================
   Expense & Budget Visualizer — script.js
   Vanilla JS · Chart.js · LocalStorage
   ========================================================= */

"use strict";

/* ── Constants ─────────────────────────────────────────── */
const STORAGE_KEY  = "ebv_transactions_v1";
const THEME_KEY    = "ebv_theme_v1";

const PALETTE = [
  "#4388ed", "#20b985", "#f28b35", "#e76565",
  "#9575cd", "#ef6f91", "#e8b84a", "#47b8b0"
];

const CATEGORY_ICON = {
  Food:      "🍜",
  Transport: "🚕",
  Fun:       "🎮",
  Shopping:  "🛍️",
  Bills:     "🧾",
  Health:    "💊",
  Other:     "✦"
};

/* ── DOM refs ───────────────────────────────────────────── */
const transactionForm      = document.getElementById("transactionForm");
const itemNameInput        = document.getElementById("itemName");
const amountInput          = document.getElementById("amount");
const amountWrapper        = amountInput.closest(".amount-input");
const categorySelect       = document.getElementById("category");
const customCategoryField  = document.getElementById("customCategoryField");
const customCategoryInput  = document.getElementById("customCategory");
const transactionList      = document.getElementById("transactionList");
const searchInput          = document.getElementById("searchInput");
const toast                = document.getElementById("toast");
const monthDialog          = document.getElementById("monthDialog");

/* ── State ──────────────────────────────────────────────── */
let transactions = loadFromStorage();
let spendingChart = null;
let toastTimer    = null;
let feedbackTimer = null;

/* ═══════════════════════════════════════════════════════
   LOCAL STORAGE
═══════════════════════════════════════════════════════ */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t =>
      t &&
      typeof t.id       === "string" &&
      typeof t.name     === "string" && t.name.trim() !== "" &&
      Number.isFinite(Number(t.amount)) && Number(t.amount) > 0 &&
      typeof t.category === "string" && t.category.trim() !== "" &&
      typeof t.date     === "string"
    );
  } catch {
    return [];
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
function formatUSD(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2
  }).format(Number(value) || 0);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);
}

function formatDate(isoDate) {
  /* avoid UTC/local shift by forcing noon */
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueId() {
  return (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function categoryIcon(cat) {
  return CATEGORY_ICON[cat] || "✦";
}

/* ── Toast ──────────────────────────────────────────────── */
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

/* ── Form feedback ──────────────────────────────────────── */
function setFeedback(msg) {
  const el = document.getElementById("formFeedback");
  el.textContent = msg;
  clearTimeout(feedbackTimer);
  if (msg) feedbackTimer = setTimeout(() => { el.textContent = ""; }, 3000);
}

/* ═══════════════════════════════════════════════════════
   FORM VALIDATION
═══════════════════════════════════════════════════════ */
function clearFieldError(inputEl, errorId) {
  document.getElementById(errorId).textContent = "";
  inputEl.classList.remove("invalid");
  /* amount wrapper also needs the class removed */
  if (inputEl === amountInput) amountWrapper.classList.remove("invalid");
}

function setFieldError(inputEl, errorId, msg) {
  document.getElementById(errorId).textContent = msg;
  inputEl.classList.add("invalid");
  if (inputEl === amountInput) amountWrapper.classList.add("invalid");
}

function clearAllErrors() {
  clearFieldError(itemNameInput,       "nameError");
  clearFieldError(amountInput,         "amountError");
  clearFieldError(categorySelect,      "categoryError");
  clearFieldError(customCategoryInput, "customCategoryError");
}

/**
 * Validates the form.
 * @returns {Object|null} { name, amount, category } on success, null on failure.
 */
function validateForm() {
  clearAllErrors();
  let ok = true;

  /* — name — */
  const name = itemNameInput.value.trim();
  if (!name) {
    setFieldError(itemNameInput, "nameError", "Please enter an item name.");
    ok = false;
  }

  /* — amount — */
  const rawAmount = amountInput.value;
  const amount    = parseFloat(rawAmount);
  if (rawAmount === "" || rawAmount === null) {
    setFieldError(amountInput, "amountError", "Please enter an amount.");
    ok = false;
  } else if (!Number.isFinite(amount) || amount <= 0) {
    setFieldError(amountInput, "amountError", "Amount must be a positive number.");
    ok = false;
  }

  /* — category — */
  let category = categorySelect.value;
  if (!category) {
    setFieldError(categorySelect, "categoryError", "Please select a category.");
    ok = false;
  } else if (category === "__custom__") {
    const custom = customCategoryInput.value.trim();
    if (!custom) {
      setFieldError(customCategoryInput, "customCategoryError", "Please enter a category name.");
      ok = false;
    } else {
      category = custom;
    }
  }

  if (!ok) return null;
  return { name, amount: Math.round(amount * 100) / 100, category };
}

/* ── Clear errors on user input ─────────────────────────── */
itemNameInput.addEventListener("input", () =>
  clearFieldError(itemNameInput, "nameError")
);
amountInput.addEventListener("input", () =>
  clearFieldError(amountInput, "amountError")
);
categorySelect.addEventListener("change", () => {
  clearFieldError(categorySelect, "categoryError");
  const isCustom = categorySelect.value === "__custom__";
  customCategoryField.hidden = !isCustom;
  if (isCustom) customCategoryInput.focus();
});
customCategoryInput.addEventListener("input", () =>
  clearFieldError(customCategoryInput, "customCategoryError")
);

/* ═══════════════════════════════════════════════════════
   ADD TRANSACTION
═══════════════════════════════════════════════════════ */
transactionForm.addEventListener("submit", e => {
  e.preventDefault();

  const data = validateForm();
  if (!data) return;          /* validation failed — errors already shown */

  /* Build transaction object */
  const tx = {
    id:       uniqueId(),
    name:     data.name,
    amount:   data.amount,
    category: data.category,
    date:     todayISO()
  };

  /* Prepend so newest appears first */
  transactions.unshift(tx);
  saveToStorage();

  /* Reset form */
  transactionForm.reset();
  customCategoryField.hidden = true;
  /* Restore the placeholder option after reset */
  categorySelect.value = "";

  /* Feedback */
  setFeedback("✓ Transaction added successfully.");
  showToast(`"${data.name}" added!`);

  /* Re-render everything */
  render();

  /* Return focus to first field for quick re-entry */
  itemNameInput.focus();
});

/* ═══════════════════════════════════════════════════════
   DELETE TRANSACTION
═══════════════════════════════════════════════════════ */
transactionList.addEventListener("click", e => {
  const btn = e.target.closest("[data-delete]");
  if (!btn) return;

  const id = btn.dataset.delete;
  const tx = transactions.find(t => t.id === id);
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  render();
  showToast(tx ? `"${tx.name}" deleted.` : "Transaction deleted.");
});

/* ═══════════════════════════════════════════════════════
   SEARCH
═══════════════════════════════════════════════════════ */
searchInput.addEventListener("input", renderTransactions);

function filteredTransactions() {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) return transactions;
  return transactions.filter(t =>
    t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
  );
}

/* ═══════════════════════════════════════════════════════
   RENDER: SUMMARY CARDS
═══════════════════════════════════════════════════════ */
function renderSummary() {
  const total   = transactions.reduce((s, t) => s + t.amount, 0);
  const monthKey = currentMonthKey();
  const monthly  = transactions
    .filter(t => t.date.slice(0, 7) === monthKey)
    .reduce((s, t) => s + t.amount, 0);

  document.getElementById("totalBalance").textContent     = formatUSD(total);
  document.getElementById("transactionCount").textContent = transactions.length;
  document.getElementById("monthlyTotal").textContent     = formatUSD(monthly);
}

/* ═══════════════════════════════════════════════════════
   RENDER: TRANSACTION LIST
═══════════════════════════════════════════════════════ */
function renderTransactions() {
  const list = filteredTransactions();
  document.getElementById("listCount").textContent = list.length;
  transactionList.innerHTML = "";

  if (list.length === 0) {
    const isSearch = searchInput.value.trim() !== "";
    transactionList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">${isSearch ? "🔍" : "📋"}</span>
        <h3>${isSearch ? "No matching transactions" : "No transactions yet"}</h3>
        <p>${isSearch
          ? "Try a different name or category."
          : "Add your first expense using the form above."
        }</p>
      </div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach(tx => {
    const item = document.createElement("div");
    item.className = "transaction-item";
    item.innerHTML = `
      <div class="transaction-symbol" aria-hidden="true">${categoryIcon(tx.category)}</div>
      <div class="transaction-info">
        <p class="transaction-name">${escapeHTML(tx.name)}</p>
        <div class="transaction-meta">
          <span class="category-tag">${escapeHTML(tx.category)}</span>
          <span>${formatDate(tx.date)}</span>
        </div>
      </div>
      <strong class="transaction-amount">${formatUSD(tx.amount)}</strong>
      <button
        class="delete-button"
        type="button"
        data-delete="${escapeHTML(tx.id)}"
        aria-label="Delete ${escapeHTML(tx.name)}"
        title="Delete transaction"
      >×</button>`;
    fragment.appendChild(item);
  });
  transactionList.appendChild(fragment);
}

/* ═══════════════════════════════════════════════════════
   RENDER: PIE CHART
═══════════════════════════════════════════════════════ */
function categoryTotals() {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});
}

function renderChart() {
  const totals = categoryTotals();
  const labels = Object.keys(totals);
  const values = Object.values(totals);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  const chartEmpty  = document.getElementById("chartEmpty");
  const legendEl    = document.getElementById("chartLegend");
  const canvas      = document.getElementById("spendingChart");

  /* Empty state */
  chartEmpty.style.display = labels.length ? "none" : "flex";

  /* Legend */
  legendEl.innerHTML = labels.map((label, i) => `
    <span class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      ${escapeHTML(label)}
    </span>`).join("");

  if (!labels.length) {
    /* Destroy chart if it exists so canvas is clean next time */
    if (spendingChart) { spendingChart.destroy(); spendingChart = null; }
    return;
  }

  if (typeof Chart === "undefined") {
    const small = chartEmpty.querySelector("small");
    if (small) small.textContent = "Chart.js could not load. Check your internet connection.";
    chartEmpty.style.display = "flex";
    return;
  }

  const borderColor = getComputedStyle(document.body)
    .getPropertyValue("--surface").trim() || "#ffffff";

  if (spendingChart) {
    /* Update existing chart in-place */
    spendingChart.data.labels                        = labels;
    spendingChart.data.datasets[0].data              = values;
    spendingChart.data.datasets[0].backgroundColor   = colors;
    spendingChart.data.datasets[0].borderColor       = borderColor;
    spendingChart.update();
    return;
  }

  /* Create fresh chart */
  spendingChart = new Chart(canvas, {
    type: "pie",
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: colors,
        borderColor:     borderColor,
        borderWidth:     3,
        hoverOffset:     8
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatUSD(ctx.raw)}`
          }
        }
      }
    }
  });
}

/* ── Master render call ─────────────────────────────────── */
function render() {
  renderSummary();
  renderTransactions();
  renderChart();
}

/* ═══════════════════════════════════════════════════════
   MONTHLY SUMMARY DIALOG
═══════════════════════════════════════════════════════ */
function openMonthlySummary() {
  /* Group by YYYY-MM */
  const grouped = {};
  transactions.forEach(t => {
    const key = t.date.slice(0, 7);
    grouped[key] = (grouped[key] || 0) + t.amount;
  });

  const entries = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  const content = document.getElementById("monthSummaryContent");

  if (!entries.length) {
    content.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon" aria-hidden="true">📅</span>
        <h3>No monthly data yet</h3>
        <p>Add transactions to see your monthly spending summary.</p>
      </div>`;
  } else {
    const rows = entries.map(([key, total]) => {
      const [year, month] = key.split("-");
      const label = new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const count = transactions.filter(t => t.date.slice(0, 7) === key).length;
      return `
        <div class="month-row">
          <span>${escapeHTML(label)}<br>
            <small>${count} transaction${count === 1 ? "" : "s"}</small>
          </span>
          <strong>${formatUSD(total)}</strong>
        </div>`;
    }).join("");

    const allTime = entries.reduce((s, [, v]) => s + v, 0);
    content.innerHTML = rows + `
      <div class="month-row total">
        <span>All-time expenses</span>
        <strong>${formatUSD(allTime)}</strong>
      </div>`;
  }

  if (typeof monthDialog.showModal === "function") {
    monthDialog.showModal();
  } else {
    alert("Monthly Summary\n" + entries.map(([k, v]) => `${k}: ${formatUSD(v)}`).join("\n"));
  }
}

document.getElementById("monthlyTotal").addEventListener("click",  openMonthlySummary);
document.getElementById("monthCaption").addEventListener("click",  openMonthlySummary);
document.getElementById("closeMonthDialog").addEventListener("click", () => monthDialog.close());

/* Close dialog when clicking the backdrop */
monthDialog.addEventListener("click", e => {
  if (e.target === monthDialog) monthDialog.close();
});

/* ═══════════════════════════════════════════════════════
   CLEAR ALL DATA
═══════════════════════════════════════════════════════ */
document.getElementById("clearAllButton").addEventListener("click", () => {
  if (!transactions.length) {
    showToast("No transactions to clear.");
    return;
  }
  if (!confirm("Delete ALL transactions? This cannot be undone.")) return;
  transactions = [];
  saveToStorage();
  render();
  showToast("All transactions cleared.");
});

/* ═══════════════════════════════════════════════════════
   DARK / LIGHT THEME
═══════════════════════════════════════════════════════ */
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  document.getElementById("themeIcon").textContent = theme === "dark" ? "☀" : "☾";
  localStorage.setItem(THEME_KEY, theme);

  /* Update chart border to match new surface color */
  if (spendingChart) {
    const bc = getComputedStyle(document.body).getPropertyValue("--surface").trim() || "#fff";
    spendingChart.data.datasets[0].borderColor = bc;
    spendingChart.update();
  }
}

document.getElementById("themeToggle").addEventListener("click", () => {
  applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
});

/* ═══════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════ */
(function init() {
  /* Restore theme */
  applyTheme(localStorage.getItem(THEME_KEY) || "light");

  /* Date label in topbar */
  document.getElementById("todayLabel").textContent =
    new Date().toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric"
    });

  /* Initial render from stored data */
  render();
})();
