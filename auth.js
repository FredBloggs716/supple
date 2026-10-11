import { seedData } from "./data.js";
import { icon } from "./icons.js";
let csrf = "";
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function api(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && !(options.body instanceof Blob)) {
    headers["Content-Type"] = "application/json";
    options = { ...options, body: JSON.stringify(options.body) };
  }
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await res.json().catch(() => ({
    error: "The app server is unavailable. Start it with python3 start.py.",
  }));
  if (!res.ok) {
    const error = new Error(
      payload.error || "That request could not be completed.",
    );
    error.status = res.status;
    if (res.status === 401 && !path.startsWith("/api/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw error;
  }
  return payload;
}
export async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  location.assign(location.pathname);
}
window.addEventListener("session-expired", () => location.reload());
export async function bootAuth() {
  let status;
  try {
    status = await api("/api/auth/status");
  } catch (error) {
    document.querySelector("#app").innerHTML =
      `<div class="auth-error"><img src="assets/logo-mark.png" alt="Social Training Club"><h1>Let’s get the club running.</h1><p>${escape(error.message)}</p><p>Use the app launcher or run <code>python3 start.py</code> in the project folder.</p></div>`;
    return new Promise(() => {});
  }
  const params = new URLSearchParams(location.search);
  const token = params.get("invite");
  let invitation = null,
    inviteError = null;
  if (token) {
    try {
      invitation = await api("/api/invitations/" + encodeURIComponent(token));
    } catch (e) {
      inviteError = e.message;
    }
  }
  if (status.authenticated && !token) {
    csrf = status.csrf;
    return { ...(await api("/api/workspace")), user: status.user };
  }
  return new Promise((resolve) => {
    function screen() {
      const setup = status.setup && !token;
      const accept = !!invitation;
      const title = accept
        ? "Welcome to the club."
        : setup
          ? "Make this club yours."
          : "Good to see you.";
      document.querySelector("#app").innerHTML =
        `<div class="auth-shell"><section class="auth-brand"><a class="auth-logo" href="./"><img src="assets/logo-mark-white.png" alt=""><span>SOCIAL<br>TRAINING CLUB</span></a><div class="auth-message"><div class="eyebrow">GOOD PEOPLE. BETTER TOGETHER.</div><h1>Your next<br>strong chapter.</h1><p>Thoughtful training. A little accountability.<br>A coach in your corner.</p><div class="auth-benefits"><span>${icon("dumbbell")}A plan with purpose</span><span>${icon("chart")}Progress you can see</span><span>${icon("users")}A club to belong to</span></div></div><small>One session. One step. Stronger together.</small></section><main class="auth-main"><div class="auth-card"><div class="eyebrow red">${accept ? escape(invitation.club) : "SOCIAL TRAINING CLUB"}</div><h2>${title}</h2><p>${accept ? "Hi " + escape(invitation.name.split(" ")[0]) + ". Set a password to see your training plan." : setup ? "Create your coach account. Your clients come next." : "Sign in to pick up where you left off."}</p>${inviteError ? `<div class="form-error">${escape(inviteError)}</div><a class="btn primary" href="./">Back to sign in</a>` : `<form id="auth-form">${setup ? '<label class="field"><span>Your name</span><input name="name" autocomplete="name" maxlength="80" required></label><label class="field"><span>Club name</span><input name="club" value="Social Training Club" maxlength="80" required></label>' : ""}<label class="field"><span>Email address</span><input name="email" type="email" autocomplete="username" value="${escape(invitation?.email || "")}" ${accept ? "readonly" : ""} required></label><label class="field"><span>${setup || accept ? "Choose a password" : "Password"}</span><input name="password" type="password" autocomplete="${setup || accept ? "new-password" : "current-password"}" minlength="${setup || accept ? 12 : 1}" maxlength="512" required>${setup || accept ? '<small class="field-help">At least 12 characters. A few memorable words work well.</small>' : ""}</label>${setup && status.setupTokenRequired ? '<label class="field"><span>Setup code</span><input name="setupToken" type="password" autocomplete="off" required><small class="field-help">Use the code configured in your hosting settings.</small></label>' : ""}${setup ? '<label class="auth-demo"><input type="checkbox" name="demo"> Start with fictional sample clients</label>' : ""}<p class="form-error" id="auth-error" role="alert"></p><button class="btn primary full" type="submit">${accept ? "Join the club" : setup ? "Create your club" : "Sign in"}${icon("arrow")}</button></form><p class="auth-footnote">${setup ? "You’ll add clients and share their private invitation links from your workspace." : accept ? "This link is private and can only be used once." : "Need access or a new password? Ask your coach for a new sign-in link."}</p>`}</div><div class="auth-copyright">Built on showing up. Social Training Club.</div></main></div>`;
      const form = document.querySelector("#auth-form");
      if (!form) return;
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const fields = new FormData(form);
        const button = form.querySelector("button[type=submit]");
        button.disabled = true;
        document.querySelector("#auth-error").textContent = "";
        try {
          if (setup) {
            const workspace = seedData();
            workspace.settings.club = String(fields.get("club")).trim();
            if (!fields.has("demo")) {
              for (const key of [
                "clients",
                "logs",
                "measures",
                "sessions",
                "meals",
                "activity",
              ])
                workspace[key] = [];
              workspace.water = {};
            }
            await api("/api/auth/setup", {
              method: "POST",
              body: {
                name: fields.get("name"),
                email: fields.get("email"),
                password: fields.get("password"),
                setupToken: fields.get("setupToken") || "",
                workspace,
              },
            });
          } else if (accept) {
            await api("/api/auth/accept", {
              method: "POST",
              body: { token, password: fields.get("password") },
            });
          } else {
            await api("/api/auth/login", {
              method: "POST",
              body: {
                email: fields.get("email"),
                password: fields.get("password"),
              },
            });
          }
          status = await api("/api/auth/status");
          csrf = status.csrf;
          if (token) history.replaceState(null, "", location.pathname);
          resolve({ ...(await api("/api/workspace")), user: status.user });
        } catch (error) {
          document.querySelector("#auth-error").textContent = error.message;
          button.disabled = false;
        }
      });
    }
    screen();
  });
}
