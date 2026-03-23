const SUPABASE_URL = "https://exsrwwtzfgxxhzpszsqv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4c3J3d3R6Zmd4eGh6cHN6c3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTIxNTgsImV4cCI6MjA4OTgyODE1OH0.yN0WSvd45S9L0Ay1b9FLwWIlTwRWmq9d7J74-DNouu4";
const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

let accessToken = null;

function apiHeaders() {
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };
}

// DOM elements
const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");
const loginForm = document.getElementById("login-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleLink = document.getElementById("auth-toggle-link");
const authMessage = document.getElementById("auth-message");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const footer = document.getElementById("footer");
const countEl = document.getElementById("count");
const clearBtn = document.getElementById("clear-completed");

let isLoginMode = true;
let todos = [];

// --- Auth ---

function showMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
    authMessage.classList.remove("hidden");
}

function hideMessage() {
    authMessage.classList.add("hidden");
}

authToggleLink.addEventListener("click", (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    hideMessage();
    if (isLoginMode) {
        authSubmitBtn.textContent = "Giriş Yap";
        authToggleText.textContent = "Hesabınız yok mu?";
        authToggleLink.textContent = "Kayıt Ol";
    } else {
        authSubmitBtn.textContent = "Kayıt Ol";
        authToggleText.textContent = "Zaten hesabınız var mı?";
        authToggleLink.textContent = "Giriş Yap";
    }
});

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    if (isLoginMode) {
        await login(email, password);
    } else {
        await signup(email, password);
    }
});

async function signup(email, password) {
    try {
        const res = await fetch(`${AUTH_URL}/signup`, {
            method: "POST",
            headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            if (data.identities && data.identities.length === 0) {
                showMessage("Bu e-posta zaten kayıtlı.", "error");
            } else {
                showMessage("Kayıt başarılı! E-postanıza gelen onay linkine tıklayın.", "success");
                authEmail.value = "";
                authPassword.value = "";
            }
        } else {
            showMessage(data.error_description || data.msg || "Kayıt başarısız.", "error");
        }
    } catch {
        showMessage("Bağlantı hatası.", "error");
    }
}

async function login(email, password) {
    try {
        const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
            method: "POST",
            headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            saveSession(data);
            showApp(data.user.email);
        } else {
            if (data.error_description && data.error_description.includes("not confirmed")) {
                showMessage("E-postanız henüz onaylanmadı. Gelen kutunuzu kontrol edin.", "error");
            } else {
                showMessage(data.error_description || "Giriş başarısız.", "error");
            }
        }
    } catch {
        showMessage("Bağlantı hatası.", "error");
    }
}

function saveSession(data) {
    accessToken = data.access_token;
    localStorage.setItem("sb_session", JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user
    }));
}

async function refreshSession(refreshToken) {
    try {
        const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (res.ok) {
            const data = await res.json();
            saveSession(data);
            return data;
        }
    } catch {}
    return null;
}

function logout() {
    accessToken = null;
    localStorage.removeItem("sb_session");
    todos = [];
    appContainer.classList.add("hidden");
    authContainer.classList.remove("hidden");
    hideMessage();
    authEmail.value = "";
    authPassword.value = "";
}

logoutBtn.addEventListener("click", logout);

function showApp(email) {
    authContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");
    userEmailEl.textContent = email;
    fetchTodos();
}

// --- Handle email confirmation redirect ---
function handleAuthRedirect() {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        if (token) {
            accessToken = token;
            // Get user info
            fetch(`${AUTH_URL}/user`, {
                headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
            }).then(r => r.json()).then(user => {
                saveSession({ access_token: token, refresh_token: refreshToken, user });
                showApp(user.email);
                window.history.replaceState(null, "", window.location.pathname);
            });
            return true;
        }
    }
    return false;
}

// --- Todos ---

async function fetchTodos() {
    const res = await fetch(`${REST_URL}/todos?select=*&order=created_at.asc`, { headers: apiHeaders() });
    if (res.status === 401) { logout(); return; }
    todos = await res.json();
    render();
}

async function addTodo(text) {
    const session = JSON.parse(localStorage.getItem("sb_session"));
    const res = await fetch(`${REST_URL}/todos`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ text, done: false, user_id: session.user.id })
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
    if (handleAuthRedirect()) return;

    const stored = localStorage.getItem("sb_session");
    if (stored) {
        const session = JSON.parse(stored);
        const refreshed = await refreshSession(session.refresh_token);
        if (refreshed) {
            showApp(refreshed.user.email);
            return;
        }
    }
    authContainer.classList.remove("hidden");
})();
