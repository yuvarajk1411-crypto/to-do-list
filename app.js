(() => {
  "use strict";

  const STORAGE_KEY = "taskflow.tasks.v1";
  const THEME_KEY = "taskflow.theme.v1";

  const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

  const state = {
    tasks: [],
    filter: "all",
    search: "",
    priorityFilter: "all",
    categoryFilter: "all",
    sortBy: "manual",
    undoSnapshot: null,
    toastTimer: null,
    draggedId: null,
  };

  // DOM references
  const el = {
    todayDate: document.getElementById("today-date"),
    themeToggle: document.getElementById("theme-toggle"),
    exportBtn: document.getElementById("export-btn"),
    importInput: document.getElementById("import-input"),
    statTotal: document.getElementById("stat-total"),
    statActive: document.getElementById("stat-active"),
    statCompleted: document.getElementById("stat-completed"),
    statOverdue: document.getElementById("stat-overdue"),
    progressBar: document.getElementById("progress-bar"),
    progressFill: document.getElementById("progress-fill"),
    progressText: document.getElementById("progress-text"),
    taskForm: document.getElementById("task-form"),
    taskTitle: document.getElementById("task-title"),
    taskPriority: document.getElementById("task-priority"),
    taskDue: document.getElementById("task-due"),
    taskCategory: document.getElementById("task-category"),
    taskNotes: document.getElementById("task-notes"),
    tabBtns: Array.from(document.querySelectorAll(".tab-btn")),
    searchInput: document.getElementById("search-input"),
    priorityFilter: document.getElementById("priority-filter"),
    categoryFilter: document.getElementById("category-filter"),
    sortSelect: document.getElementById("sort-select"),
    visibleCount: document.getElementById("visible-count"),
    clearCompletedBtn: document.getElementById("clear-completed-btn"),
    taskList: document.getElementById("task-list"),
    emptyState: document.getElementById("empty-state"),
    emptyTitle: document.getElementById("empty-title"),
    emptySubtitle: document.getElementById("empty-subtitle"),
    editModal: document.getElementById("edit-modal"),
    editForm: document.getElementById("edit-form"),
    editId: document.getElementById("edit-id"),
    editTitle: document.getElementById("edit-title"),
    editPriority: document.getElementById("edit-priority"),
    editDue: document.getElementById("edit-due"),
    editCategory: document.getElementById("edit-category"),
    editNotes: document.getElementById("edit-notes"),
    closeModalBtn: document.getElementById("close-modal-btn"),
    cancelEditBtn: document.getElementById("cancel-edit-btn"),
    toast: document.getElementById("toast"),
    toastMessage: document.getElementById("toast-message"),
    toastAction: document.getElementById("toast-action"),
  };

  function todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = saved || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }

  function isOverdue(task) {
    return Boolean(!task.completed && task.dueDate && task.dueDate < todayISO());
  }

  function isDueToday(task) {
    return Boolean(task.dueDate && task.dueDate === todayISO());
  }

  function formatDueDate(isoDate) {
    if (!isoDate) return "";
    const today = todayISO();
    if (isoDate === today) return "Today";
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function getFilteredTasks() {
    const query = state.search.trim().toLowerCase();
    const filtered = state.tasks.filter((task) => {
      if (state.filter === "active" && task.completed) return false;
      if (state.filter === "completed" && !task.completed) return false;
      if (state.filter === "today" && (task.completed || (!isDueToday(task) && !isOverdue(task)))) {
        return false;
      }

      if (state.priorityFilter !== "all" && task.priority !== state.priorityFilter) {
        return false;
      }

      if (state.categoryFilter !== "all" && (task.category || "") !== state.categoryFilter) {
        return false;
      }

      if (query) {
        const haystack = `${task.title} ${task.notes || ""} ${task.category || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });

    if (state.sortBy === "manual") {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      if (state.sortBy === "due") {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (state.sortBy === "priority") {
        return (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
      }
      if (state.sortBy === "newest") {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      return 0;
    });
  }

  function renderCategoryFilter() {
    const categories = Array.from(
      new Set(state.tasks.map((t) => (t.category || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const previous = state.categoryFilter;
    el.categoryFilter.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      el.categoryFilter.appendChild(option);
    });

    if (previous !== "all" && categories.includes(previous)) {
      el.categoryFilter.value = previous;
    } else {
      state.categoryFilter = "all";
      el.categoryFilter.value = "all";
    }
  }

  function renderStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter((t) => t.completed).length;
    const active = total - completed;
    const overdue = state.tasks.filter(isOverdue).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    el.statTotal.textContent = String(total);
    el.statActive.textContent = String(active);
    el.statCompleted.textContent = String(completed);
    el.statOverdue.textContent = String(overdue);

    el.progressFill.style.width = `${pct}%`;
    el.progressBar.setAttribute("aria-valuenow", String(pct));
    el.progressText.textContent = `${pct}% complete`;

    el.clearCompletedBtn.hidden = completed === 0;
  }

  function createTaskElement(task) {
    const li = document.createElement("li");
    li.className = `task-item${task.completed ? " completed" : ""}`;
    li.dataset.id = task.id;
    li.draggable = state.sortBy === "manual";

    // Drag handle
    const handle = document.createElement("span");
    handle.className = "drag-handle";
    handle.title = state.sortBy === "manual" ? "Drag to reorder" : "Switch sort to Manual Order to drag";
    handle.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark "${task.title}" as ${task.completed ? "incomplete" : "complete"}`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    // Content
    const content = document.createElement("div");
    content.className = "task-content";

    const title = document.createElement("p");
    title.className = "task-title";
    title.textContent = task.title;
    title.addEventListener("dblclick", () => openEditModal(task.id));
    content.appendChild(title);

    if (task.notes) {
      const notes = document.createElement("p");
      notes.className = "task-notes";
      notes.textContent = task.notes;
      content.appendChild(notes);
    }

    const badges = document.createElement("div");
    badges.className = "task-badges";

    const prioBadge = document.createElement("span");
    prioBadge.className = `badge badge-${task.priority}`;
    prioBadge.textContent = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
    badges.appendChild(prioBadge);

    if (task.category) {
      const catBadge = document.createElement("span");
      catBadge.className = "badge badge-category";
      catBadge.textContent = task.category;
      badges.appendChild(catBadge);
    }

    if (task.dueDate) {
      const dueBadge = document.createElement("span");
      const overdue = isOverdue(task);
      const today = isDueToday(task) && !task.completed;
      dueBadge.className = `badge badge-due${overdue ? " overdue" : today ? " today" : ""}`;
      dueBadge.textContent = overdue
        ? `Overdue · ${formatDueDate(task.dueDate)}`
        : `Due ${formatDueDate(task.dueDate)}`;
      badges.appendChild(dueBadge);
    }

    content.appendChild(badges);

    // Actions
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "task-action-btn";
    editBtn.title = "Edit task";
    editBtn.setAttribute("aria-label", `Edit "${task.title}"`);
    editBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    editBtn.addEventListener("click", () => openEditModal(task.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-action-btn delete";
    deleteBtn.title = "Delete task";
    deleteBtn.setAttribute("aria-label", `Delete "${task.title}"`);
    deleteBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.append(editBtn, deleteBtn);
    li.append(handle, checkbox, content, actions);

    // Drag and drop events
    li.addEventListener("dragstart", (e) => {
      if (state.sortBy !== "manual") {
        e.preventDefault();
        return;
      }
      state.draggedId = task.id;
      li.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    li.addEventListener("dragend", () => {
      state.draggedId = null;
      li.classList.remove("dragging");
      document.querySelectorAll(".task-item.drag-over").forEach((node) => {
        node.classList.remove("drag-over");
      });
    });

    li.addEventListener("dragover", (e) => {
      if (!state.draggedId || state.draggedId === task.id) return;
      e.preventDefault();
      li.classList.add("drag-over");
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      if (!state.draggedId || state.draggedId === task.id) return;
      reorderTasks(state.draggedId, task.id);
    });

    return li;
  }

  function render() {
    renderCategoryFilter();
    renderStats();

    const visible = getFilteredTasks();
    el.taskList.innerHTML = "";
    visible.forEach((task) => {
      el.taskList.appendChild(createTaskElement(task));
    });

    el.visibleCount.textContent = `${visible.length} ${visible.length === 1 ? "task" : "tasks"} shown`;

    if (visible.length === 0) {
      el.emptyState.hidden = false;
      if (state.tasks.length === 0) {
        el.emptyTitle.textContent = "No tasks yet";
        el.emptySubtitle.textContent = "Add a task above to organize your day.";
      } else {
        el.emptyTitle.textContent = "No matching tasks";
        el.emptySubtitle.textContent = "Try adjusting your filters or search query.";
      }
    } else {
      el.emptyState.hidden = true;
    }
  }

  function addTask(e) {
    e.preventDefault();
    const title = el.taskTitle.value.trim();
    if (!title) return;

    const newTask = {
      id: createId(),
      title,
      priority: el.taskPriority.value || "medium",
      dueDate: el.taskDue.value || "",
      category: el.taskCategory.value.trim(),
      notes: el.taskNotes.value.trim(),
      completed: false,
      createdAt: Date.now(),
    };

    state.tasks.unshift(newTask);
    saveTasks();
    render();

    el.taskForm.reset();
    el.taskPriority.value = "medium";
    el.taskTitle.focus();
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.completed = !task.completed;
    saveTasks();
    render();
  }

  function deleteTask(id) {
    const index = state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return;

    state.undoSnapshot = [...state.tasks];
    const [removed] = state.tasks.splice(index, 1);
    saveTasks();
    render();
    showToast(`Deleted "${removed.title}"`, true);
  }

  function clearCompleted() {
    const completedCount = state.tasks.filter((t) => t.completed).length;
    if (completedCount === 0) return;

    state.undoSnapshot = [...state.tasks];
    state.tasks = state.tasks.filter((t) => !t.completed);
    saveTasks();
    render();
    showToast(`Cleared ${completedCount} completed ${completedCount === 1 ? "task" : "tasks"}`, true);
  }

  function reorderTasks(sourceId, targetId) {
    const fromIdx = state.tasks.findIndex((t) => t.id === sourceId);
    const toIdx = state.tasks.findIndex((t) => t.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = state.tasks.splice(fromIdx, 1);
    state.tasks.splice(toIdx, 0, moved);
    saveTasks();
    render();
  }

  function openEditModal(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    el.editId.value = task.id;
    el.editTitle.value = task.title;
    el.editPriority.value = task.priority || "medium";
    el.editDue.value = task.dueDate || "";
    el.editCategory.value = task.category || "";
    el.editNotes.value = task.notes || "";

    el.editModal.hidden = false;
    el.editTitle.focus();
  }

  function closeEditModal() {
    el.editModal.hidden = true;
  }

  function saveEdit(e) {
    e.preventDefault();
    const id = el.editId.value;
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;

    const updatedTitle = el.editTitle.value.trim();
    if (!updatedTitle) return;

    task.title = updatedTitle;
    task.priority = el.editPriority.value || "medium";
    task.dueDate = el.editDue.value || "";
    task.category = el.editCategory.value.trim();
    task.notes = el.editNotes.value.trim();

    saveTasks();
    closeEditModal();
    render();
    showToast("Task updated");
  }

  function showToast(message, canUndo = false) {
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }
    el.toastMessage.textContent = message;
    el.toastAction.hidden = !canUndo;
    el.toast.hidden = false;

    state.toastTimer = setTimeout(() => {
      el.toast.hidden = true;
      state.undoSnapshot = null;
    }, 4500);
  }

  function handleUndo() {
    if (!state.undoSnapshot) return;
    state.tasks = state.undoSnapshot;
    state.undoSnapshot = null;
    saveTasks();
    render();
    el.toast.hidden = true;
  }

  function exportTasks() {
    const data = JSON.stringify(state.tasks, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-backup-${todayISO()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Tasks exported");
  }

  function importTasks(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!Array.isArray(parsed)) throw new Error("Invalid format");

        const valid = parsed
          .filter((item) => item && typeof item.title === "string" && item.title.trim())
          .map((item) => ({
            id: typeof item.id === "string" ? item.id : createId(),
            title: item.title.trim().slice(0, 200),
            priority: ["high", "medium", "low"].includes(item.priority) ? item.priority : "medium",
            dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
            category: typeof item.category === "string" ? item.category.trim().slice(0, 30) : "",
            notes: typeof item.notes === "string" ? item.notes.trim().slice(0, 300) : "",
            completed: Boolean(item.completed),
            createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
          }));

        state.undoSnapshot = [...state.tasks];
        state.tasks = valid;
        saveTasks();
        render();
        showToast(`Imported ${valid.length} tasks`, true);
      } catch {
        showToast("Could not import file: invalid JSON");
      } finally {
        el.importInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    el.themeToggle.addEventListener("click", toggleTheme);
    el.exportBtn.addEventListener("click", exportTasks);
    el.importInput.addEventListener("change", importTasks);
    el.taskForm.addEventListener("submit", addTask);
    el.clearCompletedBtn.addEventListener("click", clearCompleted);

    el.tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        el.tabBtns.forEach((b) => {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");
        state.filter = btn.dataset.filter;
        render();
      });
    });

    el.searchInput.addEventListener("input", (e) => {
      state.search = e.target.value;
      render();
    });

    el.priorityFilter.addEventListener("change", (e) => {
      state.priorityFilter = e.target.value;
      render();
    });

    el.categoryFilter.addEventListener("change", (e) => {
      state.categoryFilter = e.target.value;
      render();
    });

    el.sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      render();
    });

    el.editForm.addEventListener("submit", saveEdit);
    el.closeModalBtn.addEventListener("click", closeEditModal);
    el.cancelEditBtn.addEventListener("click", closeEditModal);
    el.editModal.addEventListener("click", (e) => {
      if (e.target === el.editModal) closeEditModal();
    });

    el.toastAction.addEventListener("click", handleUndo);

    document.addEventListener("keydown", (e) => {
      const target = e.target;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT");

      if (e.key === "Escape" && !el.editModal.hidden) {
        closeEditModal();
        return;
      }

      if (isTyping) return;

      if (e.key === "/") {
        e.preventDefault();
        el.searchInput.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        el.taskTitle.focus();
      }
    });
  }

  function init() {
    initTheme();
    el.todayDate.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    state.tasks = loadTasks();
    bindEvents();
    render();
  }

  init();
})();
