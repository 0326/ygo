// M10 登录 / 注册页。成功后跳回 ?next= 指定页（默认用户中心）。
// M11 注册防垃圾：蜜罐字段 website + 表单渲染时间戳 t。
import { useRef, useState } from "react";
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
  const [website, setWebsite] = useState(""); // 蜜罐：正常用户留空
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // 表单渲染时间戳：注册时校验耗时过短判定为机器人
  const formTimeRef = useRef<number>(Date.now());

  const switchMode = (m: "login" | "register") => {
    setMode(m);
    setErr("");
    if (m === "register") formTimeRef.current = Date.now();
  };

  const submit = async () => {
    setErr("");
    if (mode === "register" && password !== password2) { setErr(t("auth.mismatch")); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, { website, t: formTimeRef.current });
      }
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
          <button className={`fmt-tab${mode === "login" ? " on" : ""}`} onClick={() => switchMode("login")}>{t("auth.login")}</button>
          <button className={`fmt-tab${mode === "register" ? " on" : ""}`} onClick={() => switchMode("register")}>{t("auth.register")}</button>
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
            {/* 蜜罐字段：视觉隐藏，正常用户不会填写；bot 常自动填充被识别 */}
            <input
              className="hp-field" type="text" tabIndex={-1} autoComplete="off"
              value={website} onChange={(e) => setWebsite(e.target.value)}
              aria-hidden="true"
            />
          </>
        )}

        {err && <div className="login-err">{err}</div>}

        <button className="btn btn-primary login-submit" disabled={busy || !username.trim() || !password} onClick={submit}>
          {busy ? "…" : mode === "login" ? t("auth.login") : t("auth.register")}
        </button>

        <button
          className="filter-toggle ghost" style={{ marginTop: 14 }}
          onClick={() => switchMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? t("auth.toRegister") : t("auth.toLogin")}
        </button>
      </div>
    </div>
  );
}
