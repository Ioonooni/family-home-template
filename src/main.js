import "./styles.css";
import { publicConfig } from "./config/publicConfig.js";
import { CATEGORIES, PRIORITY_STYLE, filterTasks, localDateString, summarizeTasks, urgencyFor } from "./domain/task.js";
import { supabaseClient } from "./adapters/supabaseClient.js";
import { createTaskRepository } from "./adapters/taskRepository.js";
import { createAttachmentStorage } from "./adapters/attachmentStorage.js";
import { createPushSubscriptionRepository } from "./adapters/pushSubscriptionRepository.js";
import { createTaskService } from "./application/taskService.js";
import { initializePushNotifications } from "./application/pushNotifications.js";
import { escapeHtml, safeHttpsUrl } from "./ui/escape.js";

const repository = createTaskRepository(supabaseClient);
const attachmentStorage = createAttachmentStorage(supabaseClient);
const taskService = createTaskService({ repository, attachmentStorage });

const elements = {
  list: document.getElementById("task-list"),
  empty: document.getElementById("empty-state"),
  loading: document.getElementById("loading-state"),
  modal: document.getElementById("modal"),
  backdrop: document.getElementById("modal-backdrop"),
  form: document.getElementById("task-form"),
  category: document.getElementById("f-category"),
  expiryWrap: document.getElementById("f-expiry-wrap"),
  file: document.getElementById("f-file"),
  attachmentExisting: document.getElementById("f-attachment-existing"),
  attachmentLink: document.getElementById("f-attachment-link"),
  uploadStatus: document.getElementById("f-upload-status"),
  notificationButton: document.getElementById("btn-notify"),
  categoryChips: document.getElementById("category-chips"),
};

const state = {
  tasks: [],
  filter: "all",
  search: "",
  categories: new Set(),
  removeAttachment: false,
  previousAttachmentUrl: null,
};

function updateExpiryVisibility() {
  const category = CATEGORIES[elements.category.value];
  elements.expiryWrap.classList.toggle("hidden", !category?.showExpiry);
}

function renderCategoryControls() {
  elements.category.innerHTML = Object.entries(CATEGORIES)
    .map(([key, category]) => `<option value="${key}">${category.icon} ${category.label}</option>`)
    .join("");

  elements.categoryChips.innerHTML = Object.entries(CATEGORIES)
    .map(([key, category]) => `
      <button data-category="${key}" class="category-chip shrink-0 px-3 py-2.5 min-h-11 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-600">
        ${category.icon} ${category.label}
      </button>`)
    .join("");
}

function renderStats() {
  const summary = summarizeTasks(state.tasks);
  for (const [name, count] of Object.entries(summary)) {
    document.getElementById(`stat-${name}`).textContent = count;
  }
}

function taskCardHtml(task) {
  const done = task.status === "done";
  const priority = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.medium;
  const category = CATEGORIES[task.category] || CATEGORIES.general;
  const urgency = urgencyFor(task);
  const id = escapeHtml(task.id);
  return `
    <article class="bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3 ${done ? "opacity-60" : ""}">
      <button type="button" data-action="toggle" data-id="${id}" data-status="${escapeHtml(task.status)}"
        aria-label="${done ? "ทำเครื่องหมายว่ายังไม่เสร็จ" : "ทำเครื่องหมายว่าเสร็จแล้ว"}"
        class="icon-touch-target shrink-0 rounded-full border-2 flex items-center justify-center
          ${done ? "bg-[#7B8FD4] border-[#7B8FD4] text-white" : "border-gray-300 text-transparent"}">✓</button>

      <button type="button" data-action="edit" data-id="${id}" class="flex-1 min-w-0 text-left py-1">
        ${urgency ? `<span class="inline-block text-[11px] px-2 py-0.5 rounded-full mb-1 ${urgency.className}">🔔 ${escapeHtml(urgency.label)}</span>` : ""}
        <span class="block font-medium text-[15px] ${done ? "line-through text-gray-400" : ""}">${escapeHtml(task.title)}</span>
        ${task.details?.note ? `<span class="block text-xs text-gray-400 mt-0.5 truncate">${escapeHtml(task.details.note)}</span>` : ""}
        <span class="flex flex-wrap gap-1.5 mt-1.5">
          <span class="text-[11px] px-2 py-0.5 rounded-full ${category.color}">${category.icon} ${category.label}</span>
          ${task.duedate ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">📅 ${escapeHtml(task.duedate)}</span>` : ""}
          ${task.expiry_date ? `<span class="text-[11px] px-2 py-0.5 rounded-full bg-[#FDE0E6] text-[#C2506A]">⏳ หมดอายุ ${escapeHtml(task.expiry_date)}</span>` : ""}
          ${task.attachment_url ? '<span class="text-[11px] px-2 py-0.5 rounded-full bg-[#DCE6FA] text-[#5B6FA8]">📎 มีไฟล์แนบ</span>' : ""}
          <span class="text-[11px] px-2 py-0.5 rounded-full ${priority.className}">${priority.label}</span>
        </span>
      </button>

      <button type="button" data-action="delete" data-id="${id}" aria-label="ลบงาน"
        class="icon-touch-target text-gray-400 text-lg flex items-center justify-center">🗑</button>
    </article>`;
}

function renderList() {
  const tasks = filterTasks(state.tasks, {
    filter: state.filter,
    search: state.search,
    categories: state.categories,
  });
  elements.list.replaceChildren();
  elements.empty.classList.toggle("hidden", tasks.length > 0);
  if (!tasks.length) return;
  elements.list.insertAdjacentHTML("beforeend", tasks.map(taskCardHtml).join(""));
}

function showLoadError(error) {
  elements.list.replaceChildren();
  const message = document.createElement("p");
  message.className = "text-center text-red-500 text-sm py-8";
  message.textContent = `โหลดข้อมูลไม่สำเร็จ: ${error.message}`;
  elements.list.append(message);
}

async function refreshTasks() {
  elements.loading.classList.remove("hidden");
  try {
    state.tasks = await taskService.list();
    renderStats();
    renderList();
  } catch (error) {
    console.error("Task loading failed", error);
    showLoadError(error);
  } finally {
    elements.loading.classList.add("hidden");
  }
}

function resetAttachmentUi() {
  state.removeAttachment = false;
  state.previousAttachmentUrl = null;
  elements.file.value = "";
  elements.attachmentExisting.classList.add("hidden");
  elements.attachmentLink.removeAttribute("href");
  elements.uploadStatus.textContent = "";
}

function openModal() {
  elements.modal.classList.remove("hidden");
  elements.backdrop.classList.remove("hidden");
}

function closeModal() {
  elements.modal.classList.add("hidden");
  elements.backdrop.classList.add("hidden");
  elements.form.reset();
  document.getElementById("task-id").value = "";
  resetAttachmentUi();
  updateExpiryVisibility();
}

function openNewTask() {
  elements.form.reset();
  document.getElementById("task-id").value = "";
  document.getElementById("modal-title").textContent = "เพิ่มงานใหม่";
  document.getElementById("f-duedate").value = localDateString();
  resetAttachmentUi();
  updateExpiryVisibility();
  openModal();
}

function openEditTask(task) {
  document.getElementById("modal-title").textContent = "แก้ไขงาน";
  document.getElementById("task-id").value = task.id;
  document.getElementById("f-title").value = task.title || "";
  elements.category.value = task.category || "general";
  document.getElementById("f-duedate").value = task.duedate || "";
  document.getElementById("f-priority").value = task.priority || "medium";
  document.getElementById("f-expiry").value = task.expiry_date || "";
  document.getElementById("f-note").value = task.details?.note || "";
  resetAttachmentUi();
  state.previousAttachmentUrl = task.attachment_url || null;
  const attachmentUrl = safeHttpsUrl(task.attachment_url);
  if (attachmentUrl) {
    elements.attachmentLink.href = attachmentUrl;
    elements.attachmentLink.textContent = "📎 ไฟล์ที่แนบไว้ (แตะเพื่อเปิด)";
    elements.attachmentExisting.classList.remove("hidden");
  }
  updateExpiryVisibility();
  openModal();
}

function formPayload() {
  const note = document.getElementById("f-note").value.trim();
  return {
    title: document.getElementById("f-title").value.trim(),
    category: elements.category.value,
    duedate: document.getElementById("f-duedate").value || null,
    priority: document.getElementById("f-priority").value,
    expiry_date: document.getElementById("f-expiry").value || null,
    details: note ? { note } : {},
  };
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = elements.form.querySelector('button[type="submit"]');
  const id = document.getElementById("task-id").value;
  submitButton.disabled = true;
  elements.uploadStatus.textContent = elements.file.files[0] ? "กำลังอัปโหลดไฟล์..." : "กำลังบันทึก...";
  try {
    await taskService.save({
      id,
      payload: formPayload(),
      file: elements.file.files[0],
      previousAttachmentUrl: state.previousAttachmentUrl,
      removeAttachment: state.removeAttachment,
    });
    closeModal();
    await refreshTasks();
  } catch (error) {
    alert(`บันทึกไม่สำเร็จ: ${error.message}`);
    elements.uploadStatus.textContent = "";
  } finally {
    submitButton.disabled = false;
  }
});

elements.list.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const task = state.tasks.find((item) => String(item.id) === button.dataset.id);
  if (!task) return;
  try {
    if (button.dataset.action === "edit") openEditTask(task);
    if (button.dataset.action === "toggle") {
      await taskService.updateStatus(task.id, task.status === "done" ? "pending" : "done");
      await refreshTasks();
    }
    if (button.dataset.action === "delete" && confirm("ลบงานนี้ใช่ไหม?")) {
      await taskService.delete(task);
      await refreshTasks();
    }
  } catch (error) {
    alert(`ดำเนินการไม่สำเร็จ: ${error.message}`);
  }
});

elements.categoryChips.addEventListener("click", (event) => {
  const chip = event.target.closest("button[data-category]");
  if (!chip) return;
  const category = chip.dataset.category;
  if (state.categories.has(category)) {
    state.categories.delete(category);
    chip.classList.remove("bg-[#7B8FD4]", "text-white", "border-[#7B8FD4]");
    chip.classList.add("bg-white", "text-gray-600", "border-gray-200");
  } else {
    state.categories.add(category);
    chip.classList.add("bg-[#7B8FD4]", "text-white", "border-[#7B8FD4]");
    chip.classList.remove("bg-white", "text-gray-600", "border-gray-200");
  }
  renderList();
});

document.getElementById("search-input").addEventListener("input", (event) => {
  state.search = event.target.value;
  renderList();
});

document.querySelectorAll(".filter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach((item) => {
      item.classList.remove("bg-[#7B8FD4]", "text-white");
      item.classList.add("bg-white", "text-gray-600", "border", "border-gray-200");
    });
    button.classList.remove("bg-white", "text-gray-600", "border", "border-gray-200");
    button.classList.add("bg-[#7B8FD4]", "text-white");
    renderList();
  });
});

elements.category.addEventListener("change", updateExpiryVisibility);
document.getElementById("btn-add").addEventListener("click", openNewTask);
document.getElementById("btn-cancel").addEventListener("click", closeModal);
elements.backdrop.addEventListener("click", closeModal);
document.getElementById("btn-remove-attachment").addEventListener("click", () => {
  state.removeAttachment = true;
  elements.attachmentExisting.classList.add("hidden");
});

renderCategoryControls();
updateExpiryVisibility();
initializePushNotifications({
  button: elements.notificationButton,
  vapidPublicKey: publicConfig.vapidPublicKey,
  subscriptionRepository: createPushSubscriptionRepository(supabaseClient),
});
taskService.subscribe(refreshTasks);
refreshTasks();
