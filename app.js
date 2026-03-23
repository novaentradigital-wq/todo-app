const SUPABASE_URL = "https://exsrwwtzfgxxhzpszsqv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4c3J3d3R6Zmd4eGh6cHN6c3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTIxNTgsImV4cCI6MjA4OTgyODE1OH0.yN0WSvd45S9L0Ay1b9FLwWIlTwRWmq9d7J74-DNouu4";
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

let accessToken = null;
let currentUser = null;

function apiHeaders() {
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };
}

// DOM
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const footer = document.getElementById("footer");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-completed");
const loading = document.getElementById("loading");

let todos = [];

// --- Session ---

function goToLogin() {
    localStorage.removeItem("sb_session");
    window.location.href = "index.html";
}

async function initSession() {
    const stored = localStorage.getItem("sb_session");
    if (!stored) { goToLogin(); return false; }

    const session = JSON.parse(stored);

    // Refresh the token
    try {
        const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        if (!res.ok) { goToLogin(); return false; }

        const data = await res.json();
        accessToken = data.access_token;
        currentUser = data.user;

        localStorage.setItem("sb_session", JSON.stringify({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            user: data.user
        }));

        userEmailEl.textContent = currentUser.email;
        return true;
    } catch {
        goToLogin();
        return false;
    }
}

// --- Logout ---
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("sb_session");
    window.location.href = "index.html";
});

// --- Todos ---

async function fetchTodos() {
    const res = await fetch(`${REST_URL}/todos?select=*&order=created_at.asc`, { headers: apiHeaders() });
    if (res.status === 401) { goToLogin(); return; }
    todos = await res.json();
    loading.classList.add("hidden");
    render();
}

async function addTodo(text) {
    const res = await fetch(`${REST_URL}/todos`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ text, done: false, user_id: currentUser.id })
    });
    if (res.ok) {
        const [todo] = await res.json();
        todos.push(todo);
        render();
    }
}

async function updateTodo(id, updates) {
    await fetch(`${REST_URL}/todos?id=eq.${id}`, {
        method: "PATCH",
        headers: apiHeaders(),
        body: JSON.stringify(updates)
    });
}

async function deleteTodo(id) {
    await fetch(`${REST_URL}/todos?id=eq.${id}`, {
        method: "DELETE",
        headers: apiHeaders()
    });
}

function render() {
    list.innerHTML = "";

    todos.forEach((todo, i) => {
        const li = document.createElement("li");
        if (todo.done) li.classList.add("completed");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = todo.done;
        checkbox.addEventListener("change", async () => {
            todos[i].done = checkbox.checked;
            render();
            await updateTodo(todo.id, { done: checkbox.checked });
        });

        const span = document.createElement("span");
        span.textContent = todo.text;
        span.addEventListener("dblclick", () => startEdit(li, i));

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "\u270E";
        editBtn.addEventListener("click", () => startEdit(li, i));

        const del = document.createElement("button");
        del.className = "delete-btn";
        del.textContent = "\u00d7";
        del.addEventListener("click", async () => {
            const id = todos[i].id;
            todos.splice(i, 1);
            render();
            await deleteTodo(id);
        });

        li.append(checkbox, span, editBtn, del);
        list.appendChild(li);
    });

    const remaining = todos.filter((t) => !t.done).length;
    countEl.textContent = `${remaining} g\u00f6rev kald\u0131`;
    footer.classList.toggle("hidden", todos.length === 0);
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await addTodo(text);
});

function startEdit(li, i) {
    li.classList.add("editing");
    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "edit-input";
    editInput.value = todos[i].text;

    let saved = false;
    async function finishEdit() {
        if (saved) return;
        saved = true;
        const newText = editInput.value.trim();
        if (newText && newText !== todos[i].text) {
            todos[i].text = newText;
            await updateTodo(todos[i].id, { text: newText });
        }
        render();
    }

    editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") finishEdit();
        if (e.key === "Escape") render();
    });
    editInput.addEventListener("blur", finishEdit);

    li.innerHTML = "";
    li.appendChild(editInput);
    editInput.focus();
    editInput.select();
}

clearBtn.addEventListener("click", async () => {
    const completed = todos.filter((t) => t.done);
    todos = todos.filter((t) => !t.done);
    render();
    await Promise.all(completed.map((t) => deleteTodo(t.id)));
});

// --- Init ---
(async function init() {
    const ok = await initSession();
    if (ok) await fetchTodos();
})();
