const API_BASE_URL = "/api";

const taskForm = document.querySelector("#task-form");
const titleInput = document.querySelector("#title");
const descriptionInput = document.querySelector("#description");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const formMessage = document.querySelector("#form-message");

function escapeHtml(value = "") {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  return new Date(dateString).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function showMessage(message, type = "success") {
  if (!formMessage) {
    return;
  }

  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;

  window.setTimeout(() => {
    formMessage.textContent = "";
    formMessage.className = "form-message";
  }, 3500);
}

function renderTask(task) {
  const statusLabel = task.completed ? "Completed" : "To do";

  return `
    <article class="task-card ${task.completed ? "is-completed" : ""}">
      <div class="task-card-header">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          ${
            task.description
              ? `<p class="task-description">${escapeHtml(task.description)}</p>`
              : `<p class="task-description no-description">No description provided.</p>`
          }
        </div>

        <span class="task-status ${task.completed ? "completed" : "todo"}">
          ${statusLabel}
        </span>
      </div>

      <p class="task-date">
        Created ${formatDate(task.created_at)}
      </p>

      <div class="task-actions">
        <label class="complete-control">
          <input
            class="task-toggle"
            type="checkbox"
            data-task-id="${task.id}"
            ${task.completed ? "checked" : ""}
          />
          <span>Mark complete</span>
        </label>

        <button
          class="delete-button"
          type="button"
          data-task-id="${task.id}"
          aria-label="Delete ${escapeHtml(task.title)}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

function attachTaskEventListeners() {
  const toggleButtons = document.querySelectorAll(".task-toggle");

  toggleButtons.forEach((checkbox) => {
    checkbox.addEventListener("change", async () => {
      const taskId = checkbox.dataset.taskId;
      const completed = checkbox.checked;

      checkbox.disabled = true;

      try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ completed }),
        });

        if (!response.ok) {
          throw new Error("Could not update the task.");
        }

        await loadTasks();
      } catch (error) {
        checkbox.checked = !completed;
        showMessage(error.message || "Could not update the task.", "error");
      } finally {
        checkbox.disabled = false;
      }
    });
  });

  const deleteButtons = document.querySelectorAll(".delete-button");

  deleteButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const taskId = button.dataset.taskId;

      const confirmed = window.confirm(
        "Are you sure you want to delete this task?"
      );

      if (!confirmed) {
        return;
      }

      button.disabled = true;
      button.textContent = "Deleting...";

      try {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Could not delete the task.");
        }

        showMessage("Task deleted.");
        await loadTasks();
      } catch (error) {
        showMessage(error.message || "Could not delete the task.", "error");
        button.disabled = false;
        button.textContent = "Delete";
      }
    });
  });
}

async function loadTasks() {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`);

    if (!response.ok) {
      throw new Error("Could not load tasks.");
    }

    const tasks = await response.json();

    if (!tasks.length) {
      taskList.innerHTML = "";
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    taskList.innerHTML = tasks.map(renderTask).join("");

    attachTaskEventListeners();
  } catch (error) {
    taskList.innerHTML = `
      <p class="load-error">
        Unable to load tasks. Make sure the API is running and try again.
      </p>
    `;
    emptyState.hidden = true;
  }
}

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!title) {
    showMessage("Please enter a task title.", "error");
    titleInput.focus();
    return;
  }

  const submitButton = taskForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = "Adding...";

  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        description: description || null,
      }),
    });

    if (!response.ok) {
      throw new Error("Could not create the task.");
    }

    taskForm.reset();
    showMessage("Task added successfully.");
    await loadTasks();
    titleInput.focus();
  } catch (error) {
    showMessage(error.message || "Could not create the task.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
});

loadTasks();
