const SUPABASE_URL = "https://exsrwwtzfgxxhzpszsqv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4c3J3d3R6Zmd4eGh6cHN6c3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTIxNTgsImV4cCI6MjA4OTgyODE1OH0.yN0WSvd45S9L0Ay1b9FLwWIlTwRWmq9d7J74-DNouu4";
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleLink = document.getElementById("auth-toggle-link");
const authMessage = document.getElementById("auth-message");

let isLoginMode = true;

function showMessage(text, type) {
    authMessage.textContent = text;
    authMessage.className = `auth-message ${type}`;
}

function hideMessage() {
    authMessage.className = "auth-message hidden";
}

// Toggle login/signup
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

// Form submit
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage();
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = "Lütfen bekleyin...";

    const email = authEmail.value.trim();
    const password = authPassword.value;

    try {
        if (isLoginMode) {
            await login(email, password);
        } else {
            await signup(email, password);
        }
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isLoginMode ? "Giriş Yap" : "Kayıt Ol";
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
                showMessage("Bu e-posta adresi zaten kayıtlı.", "error");
            } else {
                showMessage("Kayıt başarılı! E-postanıza gelen onay linkine tıklayarak hesabınızı aktifleştirin.", "success");
                authEmail.value = "";
                authPassword.value = "";
            }
        } else {
            showMessage(data.error_description || data.msg || "Kayıt başarısız oldu.", "error");
        }
    } catch {
        showMessage("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
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
            localStorage.setItem("sb_session", JSON.stringify({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                user: data.user
            }));
            window.location.href = "app.html";
        } else {
            if (data.error_description && data.error_description.includes("not confirmed")) {
                showMessage("E-postanız henüz onaylanmadı. Gelen kutunuzu kontrol edin.", "error");
            } else if (data.error_description && data.error_description.includes("Invalid login")) {
                showMessage("E-posta veya şifre hatalı.", "error");
            } else {
                showMessage(data.error_description || "Giriş başarısız oldu.", "error");
            }
        }
    } catch {
        showMessage("Bağlantı hatası. Lütfen tekrar deneyin.", "error");
    }
}

// Handle email confirmation redirect (from Supabase confirmation link)
function handleAuthRedirect() {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (token) {
            fetch(`${AUTH_URL}/user`, {
                headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
            })
            .then(r => r.json())
            .then(user => {
                localStorage.setItem("sb_session", JSON.stringify({
                    access_token: token,
                    refresh_token: refreshToken,
                    user
                }));
                window.location.href = "app.html";
            })
            .catch(() => {
                showMessage("Onay işlemi sırasında hata oluştu. Lütfen giriş yapın.", "error");
                window.history.replaceState(null, "", window.location.pathname);
            });
            return true;
        }
    }
    return false;
}

// Init: check if already logged in
(function init() {
    if (handleAuthRedirect()) return;

    const stored = localStorage.getItem("sb_session");
    if (stored) {
        const session = JSON.parse(stored);
        // Try refreshing the session
        fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: session.refresh_token })
        })
        .then(r => { if (r.ok) return r.json(); throw new Error(); })
        .then(data => {
            localStorage.setItem("sb_session", JSON.stringify({
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                user: data.user
            }));
            window.location.href = "app.html";
        })
        .catch(() => {
            localStorage.removeItem("sb_session");
        });
    }
})();
