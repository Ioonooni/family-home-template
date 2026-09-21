import "../styles.css";
import { FINANCE_CATEGORIES, filterTransactions, summarizeTransactions } from "./domain/transaction.js";
import { createGoogleSheetsTransactionRepository } from "./adapters/googleSheetsTransactionRepository.js";
import { createLocalReceiptPreview } from "./adapters/localReceiptPreview.js";
import { createFinanceService } from "./application/financeService.js";
import { createFinanceSetupService } from "./application/financeSetupService.js";
import { discardReceiptDraft, releaseSavedReceipts, removeReceiptFromDraft } from "./application/receiptDraft.js";
import { createGoogleAuthorization } from "./adapters/googleAuthorization.js";
import { createGoogleDriveBootstrap } from "./adapters/googleDriveBootstrap.js";
import { createGoogleDriveReceiptStorage } from "./adapters/googleDriveReceiptStorage.js";
import { escapeHtml } from "../ui/escape.js";

const repository = createGoogleSheetsTransactionRepository();
const receiptStorage = createGoogleDriveReceiptStorage();
const service = createFinanceService({ repository, receiptPreview: createLocalReceiptPreview(), receiptStorage });
const financeSetup = createFinanceSetupService({ authorization: createGoogleAuthorization({ clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID }), resourceBootstrap: createGoogleDriveBootstrap(), transactionRepository: repository, receiptStorage });
const now = new Date();
const state = { items: [], accountType: "family", month: now.getMonth() + 1, year: now.getFullYear(), formAccount: "family", transactionType: "expense", receipts: [] };
const byId = (id) => document.getElementById(id);
const el = {
  list: byId("transaction-list"), empty: byId("finance-empty"), loading: byId("finance-loading"), month: byId("month-filter"), year: byId("year-filter"),
  modal: byId("finance-modal"), backdrop: byId("finance-backdrop"), form: byId("finance-form"), id: byId("finance-id"), date: byId("finance-date"), amount: byId("finance-amount"),
  category: byId("finance-category"), categories: byId("finance-categories"), note: byId("finance-note"), receiptsInput: byId("finance-receipts"), previews: byId("receipt-previews"),
  deleteButton: byId("delete-transaction"), saveButton: byId("save-transaction"), formError: byId("finance-form-error"), flash: byId("flash"), error: byId("finance-error"),
};
const connectGoogleButton = byId("connect-google");
const googleSetupStatus = byId("google-setup-status");

const currency = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { day: "numeric", month: "short", year: "numeric" });
function formatMoney(value) { return `${currency.format(value)} บาท`; }
function dateLabel(value) { return thaiDate.format(new Date(`${value}T12:00:00`)); }
function today() { const offset = new Date().getTimezoneOffset() * 60000; return new Date(Date.now() - offset).toISOString().slice(0, 10); }

function visibleItems() { return filterTransactions(state.items, state); }
function render() {
  const items = visibleItems();
  const summary = summarizeTransactions(items);
  byId("sum-income").textContent = formatMoney(summary.income);
  byId("sum-expense").textContent = formatMoney(summary.expense);
  byId("sum-balance").textContent = formatMoney(summary.balance);
  byId("sum-balance").className = `mt-1 text-xl font-bold ${summary.balance < 0 ? "text-rose-500" : "text-[#33314A]"}`;
  el.empty.classList.toggle("hidden", items.length > 0);
  el.list.innerHTML = items.map((item) => `<button type="button" data-id="${escapeHtml(item.id)}" class="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 text-left">
    <span class="w-1.5 self-stretch rounded-full ${item.transactionType === "income" ? "bg-emerald-500" : "bg-rose-500"}"></span>
    <span class="min-w-0 flex-1"><span class="block text-xs text-gray-500">${dateLabel(item.transactionDate)}</span><span class="block font-semibold">${escapeHtml(item.category)}</span><span class="block truncate text-xs text-gray-500">${escapeHtml(item.note || (item.transactionType === "income" ? "รับเข้า" : "จ่ายออก"))}${item.receipts.length ? ` · 🧾 ${item.receipts.length}` : ""}</span></span>
    <span class="font-bold ${item.transactionType === "income" ? "text-emerald-600" : "text-rose-500"}">${item.transactionType === "income" ? "+" : "−"}${formatMoney(item.amount)}</span>
  </button>`).join("");
}

function setButtonGroup(selector, key, activeClasses = ["bg-[#7B8FD4]", "text-white"]) {
  document.querySelectorAll(selector).forEach((button) => {
    const active = button.dataset.account === key || button.dataset.formAccount === key || button.dataset.type === key;
    button.classList.toggle(activeClasses[0], active); button.classList.toggle(activeClasses[1], active);
    button.classList.toggle("border", !active); button.classList.toggle("border-gray-200", !active);
  });
}
function renderTypeButtons() {
  document.querySelectorAll(".type-btn").forEach((button) => {
    const active = button.dataset.type === state.transactionType;
    button.className = `type-btn min-h-11 rounded-xl ${active ? `text-white ${state.transactionType === "income" ? "bg-emerald-500" : "bg-rose-500"}` : "border border-gray-200"}`;
  });
}
function renderCategoryOptions() { el.categories.innerHTML = FINANCE_CATEGORIES[state.formAccount].map((item) => `<option value="${item}"></option>`).join(""); }
function clearErrors() { document.querySelectorAll("[data-error]").forEach((node) => { node.textContent = ""; }); el.formError.classList.add("hidden"); }
function releaseDraftReceipts() { discardReceiptDraft(state.receipts, service.releaseReceipt); state.receipts = []; }
function renderReceipts() { el.previews.innerHTML = state.receipts.map((receipt, index) => `<figure class="relative aspect-square overflow-hidden rounded-xl bg-gray-100"><img class="h-full w-full object-cover" src="${receipt.previewUrl}" alt="${escapeHtml(receipt.name)}"><button type="button" data-receipt-index="${index}" aria-label="ลบ ${escapeHtml(receipt.name)}" class="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">✕</button></figure>`).join(""); }
async function openModal(item = null) {
  clearErrors(); releaseDraftReceipts(); renderReceipts(); el.form.reset();
  el.id.value = item?.id || ""; el.date.value = item?.transactionDate || today(); el.amount.value = item?.amount || ""; el.category.value = item?.category || ""; el.note.value = item?.note || "";
  state.formAccount = item?.accountType || state.accountType; state.transactionType = item?.transactionType || "expense"; state.receipts = item ? await service.previewReceipts(item.receipts || []) : [];
  byId("finance-modal-title").textContent = item ? "ดูและแก้ไขรายการ" : "เพิ่มรายการ"; el.deleteButton.classList.toggle("hidden", !item); el.saveButton.classList.toggle("col-span-2", !item);
  setButtonGroup(".form-account", state.formAccount); renderTypeButtons(); renderCategoryOptions(); renderReceipts();
  el.modal.classList.remove("hidden"); el.backdrop.classList.remove("hidden");
}
function closeModal() { releaseDraftReceipts(); el.modal.classList.add("hidden"); el.backdrop.classList.add("hidden"); }
function flash(message) { el.flash.textContent = message; el.flash.classList.remove("hidden"); setTimeout(() => el.flash.classList.add("hidden"), 2500); }
async function refresh() { el.loading.classList.remove("hidden"); el.error.classList.add("hidden"); try { state.items = await service.list(); render(); } catch (error) { state.items = []; render(); el.error.textContent = error.message || "โหลดรายการไม่สำเร็จ กรุณาลองใหม่"; el.error.classList.remove("hidden"); } finally { el.loading.classList.add("hidden"); } }

const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("th-TH", { month: "long" }).format(new Date(2024, index, 1)));
el.month.innerHTML = monthNames.map((label, index) => `<option value="${index + 1}">${label}</option>`).join(""); el.month.value = state.month;
el.year.innerHTML = [state.year - 1, state.year, state.year + 1].map((year) => `<option value="${year}">${year + 543}</option>`).join(""); el.year.value = state.year;
document.querySelectorAll(".account-btn").forEach((button) => button.addEventListener("click", () => { state.accountType = button.dataset.account; setButtonGroup(".account-btn", state.accountType); render(); }));
document.querySelectorAll(".form-account").forEach((button) => button.addEventListener("click", () => { state.formAccount = button.dataset.formAccount; el.category.value = ""; setButtonGroup(".form-account", state.formAccount); renderCategoryOptions(); }));
document.querySelectorAll(".type-btn").forEach((button) => button.addEventListener("click", () => { state.transactionType = button.dataset.type; renderTypeButtons(); }));
el.month.addEventListener("change", () => { state.month = Number(el.month.value); render(); }); el.year.addEventListener("change", () => { state.year = Number(el.year.value); render(); });
byId("add-transaction").addEventListener("click", () => { void openModal(); }); byId("close-finance-modal").addEventListener("click", closeModal); el.backdrop.addEventListener("click", closeModal);
el.list.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  el.error.classList.add("hidden"); el.loading.classList.remove("hidden");
  try {
    const item = await service.get(button.dataset.id);
    if (!item) throw new Error("ไม่พบรายการที่ต้องการ");
    await openModal(item);
  } catch (error) {
    el.error.textContent = error?.code === "reconnect-required" ? "ต้องเชื่อมต่อ Google ใหม่" : error.message || "เปิดรายการไม่สำเร็จ กรุณาลองใหม่";
    el.error.classList.remove("hidden");
  } finally {
    el.loading.classList.add("hidden");
  }
});
el.receiptsInput.addEventListener("change", () => { state.receipts.push(...service.selectReceipts(el.receiptsInput.files)); el.receiptsInput.value = ""; renderReceipts(); });
el.previews.addEventListener("click", (event) => { const button = event.target.closest("button[data-receipt-index]"); if (!button) return; const index = Number(button.dataset.receiptIndex); const receipt = state.receipts[index]; if (!receipt) return; state.receipts = removeReceiptFromDraft(state.receipts, receipt.id, service.releaseReceipt); renderReceipts(); });
el.form.addEventListener("submit", async (event) => { event.preventDefault(); clearErrors(); el.saveButton.disabled = true; try { const result = await service.save(el.id.value, { accountType: state.formAccount, transactionType: state.transactionType, transactionDate: el.date.value, amount: Number(el.amount.value), category: el.category.value, note: el.note.value, receipts: state.receipts }); if (!result.ok) { Object.entries(result.errors).forEach(([key, message]) => { const target = document.querySelector(`[data-error="${key}"]`); if (target) target.textContent = message; }); return; } releaseSavedReceipts(state.receipts, service.releaseReceipt); state.receipts = []; closeModal(); await refresh(); flash(result.warning || (el.id.value ? "แก้ไขรายการแล้ว" : "บันทึกรายการแล้ว")); } catch (error) { el.formError.textContent = error?.code === "reconnect-required" ? "ต้องเชื่อมต่อ Google ใหม่" : error.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่"; el.formError.classList.remove("hidden"); } finally { el.saveButton.disabled = false; } });
el.deleteButton.addEventListener("click", async () => {
  if (!el.id.value || !confirm("ลบรายการนี้ใช่ไหม?")) return;
  el.deleteButton.disabled = true; el.formError.classList.add("hidden");
  try {
    const result = await service.delete(el.id.value);
    releaseSavedReceipts(state.receipts, service.releaseReceipt);
    state.receipts = [];
    closeModal(); await refresh(); flash(result.warning || "ลบรายการแล้ว");
  } catch (error) {
    el.formError.textContent = error?.code === "reconnect-required" ? "ต้องเชื่อมต่อ Google ใหม่" : error.message || "ลบรายการไม่สำเร็จ กรุณาลองใหม่";
    el.formError.classList.remove("hidden");
  } finally {
    el.deleteButton.disabled = false;
  }
});
setButtonGroup(".account-btn", state.accountType); render(); el.loading.classList.add("hidden");

connectGoogleButton.addEventListener("click", async () => {
  connectGoogleButton.disabled = true;
  googleSetupStatus.textContent = "กำลังเชื่อมต่อ...";
  try {
    const result = await financeSetup.connect();
    await refresh();
    googleSetupStatus.textContent = result.folderReused && result.sheetReused ? "เชื่อมต่อ Google แล้ว · ใช้พื้นที่การเงินเดิม" : "เชื่อมต่อ Google แล้ว · เตรียมพื้นที่การเงินเรียบร้อย";
    connectGoogleButton.textContent = "เชื่อมต่อใหม่";
  } catch (error) {
    googleSetupStatus.textContent = error?.code === "reconnect-required" ? "ต้องเชื่อมต่อใหม่" : error.message || "เกิดข้อผิดพลาดในการเตรียมพื้นที่";
  } finally {
    connectGoogleButton.disabled = false;
  }
});
