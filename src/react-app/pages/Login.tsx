// M10 登录 / 注册页。成功后跳回 ?next= 指定页（默认用户中心）。
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUser } from "../lib/user";
import { useLang } from "../lib/i18n";

export default function Login() {
  const { login, register } = useUser();
  const { t } = useLang();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr("");
    if (mode === "register" && password !== password2) { setErr(t("auth.mismatch")); return; }
    setBusy(true);
    try {
      if (mode === "login") await login(username.trim(), password);
      else await register(username.trim(), password);
      nav(sp.get("next") || "/me", { replace: true });
    } catch (e) {
      setErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page fade-in">
      <div className="login-card">
        <h1>{t("auth.title")}</h1>
        <p className="muted" style={{ margin: "6px 0 22px", fontSize: 14 }}>{t("auth.sub")}</p>

        <div className="login-tabs">
          <button className={`fmt-tab${mode === "login" ? " on" : ""}`} onClick={() => setMode("login")}>{t("auth.login")}</button>
          <button className={`fmt-tab${mode === "register" ? " on" : ""}`} onClick={() => setMode("register")}>{t("auth.register")}</button>
        </div>

        <label className="login-label">{t("auth.username")}</label>
        <input
          className="login-input" value={username} autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <label className="login-label">{t("auth.password")}</label>
        <input
          className="login-input" type="password" value={password}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        {mode === "register" && (
          <>
            <label className="login-label">{t("auth.password2")}</label>
            <input
              className="login-input" type="password" value={password2} autoComplete="new-password"
              onChange={(e) => setPassword2(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </>
        )}

        {err && <div className="login-err">{err}</div>}

        <button className="btn btn-primary login-submit" disabled={busy || !username.trim() || !password} onClick={submit}>
          {busy ? "…" : mode === "login" ? t("auth.login") : t("auth.register")}
        </button>

        <button
          className="filter-toggle ghost" style={{ marginTop: 14 }}
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}
        >
          {mode === "login" ? t("auth.toRegister") : t("auth.toLogin")}
        </button>
      </div>
    </div>
  );
}
