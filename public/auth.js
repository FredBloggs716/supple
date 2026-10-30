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
      `<div class="auth-error"><img src="assets/logo-mark.png" alt="Social Training Club"><h1>Let's get the club running.</h1><p>${escape(error.message)}</p><p>Use the app launcher or run <code>python3 start.py</code> in the project folder.</p></div>`;
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
    let view = status.setup && !token ? "card" : token ? "card" : "landing";
    const PARQ = [
      "Has your doctor ever said you have a heart condition and that you should only do physical activity recommended by a doctor?",
      "Do you feel pain in your chest when you do physical activity?",
      "In the past month, have you had chest pain when you were not doing physical activity?",
      "Do you lose your balance because of dizziness, or do you ever lose consciousness?",
      "Do you have a bone or joint problem that could be made worse by a change in your physical activity?",
      "Is your doctor currently prescribing medication for your blood pressure or a heart condition?",
      "Do you know of any other reason why you should not do physical activity?",
    ];
    const DISCLAIMER =
      "I confirm I have answered the PAR-Q honestly, and I understand and agree that: my training is entirely at my own risk; Social Training Club provides online programming only — no in-person assessment, instruction or supervision has been carried out; if I answered YES to any PAR-Q question, or I am in any doubt about my health, I will get my doctor's advice before starting and will only train once cleared; I will stop exercising immediately and seek medical advice if I feel pain, chest discomfort, dizziness or anything unusual; and, to the fullest extent permitted by law, Social Training Club accepts no liability for injury or loss arising from my training except where caused by its proven negligence. Membership is £10 per month, arranged with your coach after you join; access may be removed if payments stop. I give my explicit consent for Social Training Club to store my PAR-Q answers and related health information so my coach can keep my training safe, as described in the Privacy Policy.";
    let signupMode = false;
    function landing() {
      document.querySelector("#app").innerHTML =
        `<div class="landing"><header class="landing-top"><a class="auth-logo dark" href="./"><img src="assets/logo-mark.png" alt=""><span>SOCIAL<br>TRAINING CLUB</span></a><button class="btn small" id="go-signin">Member sign in${icon("arrow")}</button></header><section class="landing-hero"><div class="eyebrow">GOOD PEOPLE. BETTER TOGETHER.</div><h1>Flexible plans.<br>Real progress.<br><em>£10 a month.</em></h1><p>A coach-led online training club: programmes that fit your life, video demonstrations for every movement, weekly club tests and a leaderboard that keeps you honest.</p><div class="landing-cta"><button class="btn accent" id="go-signup">Join the club — £10/month${icon("arrow")}</button><button class="btn white-outline" id="go-signin2">I'm already a member</button></div><small>No contract. Cancel any time. Train anywhere.</small></section><section class="landing-features"><h2>Everything in your pocket.</h2><div class="landing-grid">${[
          ["book", "Programmes with purpose", "Coach-built training blocks — strength, conditioning, mobility, gymnastics — with sets, reps, tempo and rest for every movement."],
          ["video", "A video for every exercise", "Never guess a movement again. Tap any exercise for a demonstration and coaching cues."],
          ["trophy", "Weekly club tests", "Three tests rotate every Monday — mostly bodyweight. Log your results, climb the board, watch your numbers grow."],
          ["nutrition", "Nutrition made simple", "Daily calorie and macro targets, meal logging and water tracking."],
          ["chart", "Progress you can see", "Every result charted over time. Strength, engine, control — the whole picture."],
          ["message", "A coach in your corner", "Check in whenever you need to. Your coach sees your training and answers for real."],
        ].map(([ic, t, d]) => `<div class="landing-feature">${icon(ic)}<h3>${t}</h3><p>${d}</p></div>`).join("")}</div></section><section class="landing-price"><div class="price-card"><div class="eyebrow red">MEMBERSHIP</div><div class="price">£10<small>/month</small></div><ul><li>Your own member workspace</li><li>Full programme + exercise library access</li><li>Weekly tests, leaderboard & club points</li><li>Nutrition targets & progress charts</li><li>Coach check-ins included</li></ul><button class="btn accent full" id="go-signup2">Join the club${icon("arrow")}</button><small>Payment is arranged with your coach after you join — nothing is taken online.</small></div></section><footer class="landing-foot">Built on showing up. Social Training Club. · <a href="terms.html">Membership Terms</a> · <a href="privacy.html">Privacy Policy</a></footer></div>`;
      for (const [id, v] of [["go-signin", false], ["go-signin2", false], ["go-signup", true], ["go-signup2", true]]) {
        document.querySelector("#" + id)?.addEventListener("click", () => {
          signupMode = v;
          view = "card";
          screen();
        });
      }
    }
    function screen() {
      if (view === "landing") return landing();
      cardScreen();
    }
    function cardScreen() {
      const setup = status.setup && !token;
      const accept = !!invitation;
      const reset = accept && !!invitation.hasAccount;
      const joining = signupMode && !setup && !accept;
      const title = reset
        ? "Reset your password."
        : accept
          ? "Welcome to the club."
          : setup
            ? "Make this club yours."
            : joining
              ? "Join the club."
              : "Good to see you.";
      const acceptDesc = accept
        ? reset
          ? "Hi " + escape(invitation.name.split(" ")[0]) + ". Choose a new password for your account."
          : "Hi " + escape(invitation.name.split(" ")[0]) + ". Set a password to see your training plan."
        : "";
      document.querySelector("#app").innerHTML =
        `<div class="auth-shell"><section class="auth-brand"><a class="auth-logo" href="./"><img src="assets/logo-mark-white.png" alt=""><span>SOCIAL<br>TRAINING CLUB</span></a><div class="auth-message"><div class="eyebrow">GOOD PEOPLE. BETTER TOGETHER.</div><h1>Your next<br>strong chapter.</h1><p>Thoughtful training. A little accountability.<br>A coach in your corner.</p><div class="auth-benefits"><span>${icon("dumbbell")}A plan with purpose</span><span>${icon("chart")}Progress you can see</span><span>${icon("users")}A club to belong to</span></div></div><small>One session. One step. Stronger together.</small></section><main class="auth-main"><div class="auth-card"><div class="eyebrow red">${accept ? escape(invitation.club) : "SOCIAL TRAINING CLUB"}</div><h2>${title}</h2><p>${accept ? acceptDesc : setup ? "Create your coach account. Your clients come next." : joining ? "£10 a month, arranged with your coach after you join. First: a quick health check." : "Sign in to pick up where you left off."}</p>${inviteError ? `<div class="form-error">${escape(inviteError)}</div><a class="btn primary" href="./">Back to sign in</a>` : `<form id="auth-form">${setup ? '<label class="field"><span>Your name</span><input name="name" autocomplete="name" maxlength="80" required></label><label class="field"><span>Club name</span><input name="club" value="Social Training Club" maxlength="80" required></label>' : joining ? '<label class="field"><span>Your full name</span><input name="name" autocomplete="name" maxlength="80" required></label>' : ""}<label class="field"><span>Email address</span><input name="email" type="email" autocomplete="username" value="${escape(invitation?.email || "")}" ${accept ? "readonly" : ""} required></label><label class="field"><span>${setup || accept || joining ? "Choose a password" : "Password"}</span><input name="password" type="password" autocomplete="${setup || accept || joining ? "new-password" : "current-password"}" minlength="${setup || accept || joining ? 12 : 1}" maxlength="512" required>${setup || accept || joining ? '<small class="field-help">At least 12 characters. A few memorable words work well.</small>' : ""}</label>${setup && status.setupTokenRequired ? '<label class="field"><span>Setup code</span><input name="setupToken" type="password" autocomplete="off" required><small class="field-help">Use the code configured in your hosting settings.</small></label>' : ""}${setup ? '<label class="auth-demo"><input type="checkbox" name="demo"> Start with fictional sample clients</label>' : ""}${joining ? `<div class="parq-box"><p class="section-label">Physical Activity Readiness (PAR-Q)</p><p class="field-help" style="margin-bottom:12px">Answer honestly — it keeps your training safe.</p>${PARQ.map((q, i) => `<div class="parq-q"><p>${q}</p><span class="parq-opts"><label><input type="radio" name="q${i}" value="no" required>No</label><label><input type="radio" name="q${i}" value="yes">Yes</label></span></div>`).join("")}<p class="form-error" id="parq-warn" hidden>You answered YES to a PAR-Q question — please get your doctor's advice before you start training. You can still create your account now.</p></div><div class="disclaimer-box"><p class="section-label">Your declaration</p><p>${DISCLAIMER}</p></div><label class="auth-demo"><input type="checkbox" name="age18" required> I am aged 18 or over</label><label class="auth-demo"><input type="checkbox" name="consent" required> I have read, understood and agree to the declaration above</label><p class="field-help" style="margin-top:8px">By joining you also agree to the <a href="terms.html" target="_blank" rel="noopener">Membership Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>.</p>` : ""}<p class="form-error" id="auth-error" role="alert"></p><button class="btn primary full" type="submit">${reset ? "Set new password" : accept ? "Join the club" : setup ? "Create your club" : joining ? "Create my account" : "Sign in"}${icon("arrow")}</button></form><p class="auth-footnote">${setup ? "You'll add clients and share their private invitation links from your workspace." : accept ? "This link is private and can only be used once." : joining ? "Your coach will be in touch about your £10/month membership after you join." : "Need access or a new password? Ask your coach for a new sign-in link."}</p>${!setup && !accept ? `<p class="auth-footnote"><button class="text-link" id="auth-switch" type="button">${joining ? "Already a member? Sign in" : "New here? See what the club offers"}</button></p>` : ""}`}</div><div class="auth-copyright">Built on showing up. Social Training Club.</div></main></div>`;
      document.querySelector("#auth-switch")?.addEventListener("click", () => {
        if (joining) {
          signupMode = false;
        } else {
          view = "landing";
        }
        screen();
      });
      const form = document.querySelector("#auth-form");
      if (!form) return;
      if (joining)
        form.addEventListener("change", (e) => {
          if (e.target.name?.startsWith("q")) {
            const any = PARQ.some((_, i) => form.elements["q" + i]?.value === "yes" && form.querySelector(`input[name=q${i}][value=yes]`)?.checked);
            document.querySelector("#parq-warn").hidden = !any;
          }
        });
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
          } else if (joining) {
            await api("/api/auth/signup", {
              method: "POST",
              body: {
                name: fields.get("name"),
                email: fields.get("email"),
                password: fields.get("password"),
                parq: PARQ.map((_, i) => fields.get("q" + i) === "yes"),
                consent: fields.get("consent") === "on",
                age18: fields.get("age18") === "on",
              },
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
