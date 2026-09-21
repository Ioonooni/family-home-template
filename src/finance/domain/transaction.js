export const FINANCE_CATEGORIES = Object.freeze({
  family: ["ค่าอาหาร", "ค่าเดินทาง", "ค่าน้ำ/ค่าไฟ", "ค่ารักษาพยาบาล", "การศึกษา", "ของใช้ในบ้าน", "เงินเดือน", "รายได้อื่น ๆ"],
  business: ["รายได้บริการ", "ค่าจ้างพนักงาน", "ค่าอาหาร/วัสดุ", "ค่าน้ำ/ค่าไฟ", "ค่าขนส่ง", "ค่าซ่อมบำรุง", "ค่าการตลาด", "รายจ่ายอื่น ๆ"],
});

export function validateTransaction(draft) {
  const errors = {};
  if (!["family", "business"].includes(draft.accountType)) errors.accountType = "กรุณาเลือกบัญชี";
  if (!["income", "expense"].includes(draft.transactionType)) errors.transactionType = "กรุณาเลือกประเภทรายการ";
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) errors.amount = "กรุณาระบุจำนวนเงินมากกว่า 0";
  if (!draft.category?.trim()) errors.category = "กรุณาระบุหมวดหมู่";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.transactionDate || "")) errors.transactionDate = "กรุณาระบุวันที่";
  return errors;
}

export function filterTransactions(items, { accountType, month, year }) {
  return items.filter((item) => {
    const [itemYear, itemMonth] = item.transactionDate.split("-").map(Number);
    return item.accountType === accountType && itemMonth === month && itemYear === year;
  }).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.createdAt.localeCompare(a.createdAt));
}

export function summarizeTransactions(items) {
  const income = items.filter((item) => item.transactionType === "income").reduce((sum, item) => sum + item.amount, 0);
  const expense = items.filter((item) => item.transactionType === "expense").reduce((sum, item) => sum + item.amount, 0);
  return { income, expense, balance: income - expense };
}
