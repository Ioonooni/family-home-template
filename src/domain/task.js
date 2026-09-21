export const CATEGORIES = Object.freeze({
  finance: { label: "การเงิน", icon: "💰", color: "bg-[#FDE8D0] text-[#B8763A]", showExpiry: false },
  documents: { label: "เอกสารสำคัญ", icon: "📄", color: "bg-[#DCE6FA] text-[#5B6FA8]", showExpiry: true },
  health: { label: "สุขภาพ", icon: "🏥", color: "bg-[#FADCE8] text-[#C05A85]", showExpiry: false },
  home: { label: "บ้าน", icon: "🏠", color: "bg-[#D8F2E8] text-[#3F9A78]", showExpiry: false },
  vehicle: { label: "รถยนต์", icon: "🚗", color: "bg-[#E8DFFA] text-[#7B5FB0]", showExpiry: true },
  family: { label: "ครอบครัว", icon: "👨‍👩‍👧", color: "bg-[#FAE0EC] text-[#C2578F]", showExpiry: false },
  work: { label: "งาน", icon: "💼", color: "bg-[#E2E6F5] text-[#5A6690]", showExpiry: false },
  assets: { label: "ทรัพย์สิน", icon: "🏦", color: "bg-[#D4F0E0] text-[#2F8F68]", showExpiry: true },
  general: { label: "ทั่วไป", icon: "📌", color: "bg-[#F0ECE0] text-[#8A8270]", showExpiry: false },
});

export const PRIORITY_STYLE = Object.freeze({
  high: { label: "สูง", className: "bg-[#F8D4DC] text-[#C23B57]" },
  medium: { label: "ปานกลาง", className: "bg-[#FCE8C8] text-[#B8823A]" },
  low: { label: "ต่ำ", className: "bg-[#D8F0E0] text-[#3F9A6C]" },
});

function startOfLocalDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntil(dateString, now = new Date()) {
  if (!dateString) return null;
  const target = startOfLocalDay(`${dateString}T00:00:00`);
  const today = startOfLocalDay(now);
  return Math.round((target - today) / 86_400_000);
}

export function isTomorrow(dateString, now = new Date()) {
  return daysUntil(dateString, now) === 1;
}

export function isWithinDays(dateString, days, now = new Date()) {
  const difference = daysUntil(dateString, now);
  return difference !== null && difference >= 0 && difference <= days;
}

export function urgencyFor(task, now = new Date()) {
  if (task.status === "done") return null;
  const difference = daysUntil(task.duedate || task.expiry_date, now);
  if (difference === null) return null;
  if (difference < 0) return { label: `เกินกำหนด ${Math.abs(difference)} วัน`, className: "bg-[#E8607A] text-white animate-pulse" };
  if (difference === 0) return { label: "ถึงกำหนดวันนี้", className: "bg-[#EF7C93] text-white animate-pulse" };
  if (difference <= 3) return { label: `อีก ${difference} วัน`, className: "bg-[#F0935E] text-white" };
  if (difference <= 14) return { label: `อีก ${difference} วัน`, className: "bg-[#F0C15E] text-[#5C4A1E]" };
  if (difference <= 30) return { label: `อีก ${difference} วัน`, className: "bg-[#A8E0C8] text-[#1E6B4E]" };
  return null;
}

export function filterTasks(tasks, { filter = "all", search = "", categories = new Set(), now = new Date() } = {}) {
  const today = localDateString(now);
  let result = [...tasks];
  const predicates = {
    today: (task) => task.duedate === today,
    tomorrow: (task) => isTomorrow(task.duedate, now),
    week: (task) => isWithinDays(task.duedate, 7, now),
    month: (task) => isWithinDays(task.duedate, 30, now),
    expiring: (task) => isWithinDays(task.expiry_date, 30, now),
    pending: (task) => task.status === "pending",
    done: (task) => task.status === "done",
  };
  if (predicates[filter]) result = result.filter(predicates[filter]);
  if (categories.size) result = result.filter((task) => categories.has(task.category));
  const query = search.trim().toLowerCase();
  if (query) {
    result = result.filter((task) => {
      const category = CATEGORIES[task.category] || CATEGORIES.general;
      return `${task.title || ""} ${category.label} ${task.details?.note || ""}`.toLowerCase().includes(query);
    });
  }
  return result;
}

export function summarizeTasks(tasks, now = new Date()) {
  const today = localDateString(now);
  return {
    today: tasks.filter((task) => task.duedate === today).length,
    tomorrow: tasks.filter((task) => isTomorrow(task.duedate, now)).length,
    week: tasks.filter((task) => isWithinDays(task.duedate, 7, now)).length,
    month: tasks.filter((task) => isWithinDays(task.duedate, 30, now)).length,
    expiring: tasks.filter((task) => isWithinDays(task.expiry_date, 30, now)).length,
    pending: tasks.filter((task) => task.status === "pending").length,
  };
}
