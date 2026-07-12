// M11 反馈建议页：未登录可查看列表，登录可提交建议。
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { FeedbackCategory, FeedbackListResponse } from "../../shared/types";
import { listFeedback, submitFeedback } from "../lib/api";
import { useUser } from "../lib/user";
import { useLang } from "../lib/i18n";
import { Spinner, Empty } from "../components/common";

const CAT_KEYS: Record<FeedbackCategory, "fb.catBug" | "fb.catFeature" | "fb.catOther"> = {
  bug: "fb.catBug",
  feature: "fb.catFeature",
  other: "fb.catOther",
};

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false });
}

export default function Feedback() {
  const { me } = useUser();
  const { t } = useLang();
  const [data, setData] = useState<FeedbackListResponse | null>(null);
  const [err, setErr] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [postErr, setPostErr] = useState("");

  const load = useCallback(() => {
    setErr("");
    listFeedback(1, 50)
      .then(setData)
      .catch((e) => { setErr(String(e.message || e)); setData(null); });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const text = content.trim();
    if (!text) return;
    setPostErr("");
    setBusy(true);
    try {
      await submitFeedback(category, text);
      setContent("");
      void load();
    } catch (e) {
      setPostErr(String((e as Error).message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page fade-in">
      <div className="page-head">
        <div>
          <h1>{t("fb.title")}</h1>
          <div className="sub">{t("fb.sub")}</div>
        </div>
      </div>

      <section className="fb-form">
        {me ? (
          <>
            <div className="fb-form-row">
              <label className="fb-cat-label">{t("fb.category")}</label>
              <div className="fb-cat-tabs">
                {(Object.keys(CAT_KEYS) as FeedbackCategory[]).map((c) => (
                  <button
                    key={c}
                    className={`filter-toggle${category === c ? " on" : ""}`}
                    onClick={() => setCategory(c)}
                  >
                    {t(CAT_KEYS[c])}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="fb-textarea"
              rows={4}
              maxLength={1000}
              placeholder={t("fb.placeholder")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="fb-form-foot">
              <span className="muted">{content.length}/1000</span>
              <button
                className="btn btn-primary"
                disabled={busy || !content.trim()}
                onClick={submit}
              >
                {busy ? "…" : t("fb.submit")}
              </button>
            </div>
            {postErr && <div className="login-err">{postErr}</div>}
          </>
        ) : (
          <div className="fb-login-hint">
            <span>{t("fb.loginHint")}</span>
            <Link className="btn btn-primary" to="/login?next=/feedback">{t("auth.login")}</Link>
          </div>
        )}
      </section>

      <div className="section-head" style={{ margin: "28px 0 14px" }}>
        <h2>{t("fb.listTitle")}</h2>
      </div>

      {err ? (
        <Empty text={err} />
      ) : !data ? (
        <Spinner />
      ) : !data.items.length ? (
        <Empty text={t("fb.empty")} />
      ) : (
        <ul className="fb-list">
          {data.items.map((it) => (
            <li key={it.id} className={`fb-item${it.status === "resolved" ? " resolved" : ""}`}>
              <div className="fb-item-head">
                <span className="fb-avatar">{it.username.slice(0, 1).toUpperCase()}</span>
                <span className="fb-username">{it.username}</span>
                <span className="fb-chip cat">{t(CAT_KEYS[it.category])}</span>
                <span className={`fb-chip status ${it.status}`}>
                  {it.status === "resolved" ? t("fb.resolved") : t("fb.open")}
                </span>
                <span className="muted fb-time">{fmtTime(it.created_at)}</span>
              </div>
              <p className="fb-content">{it.content}</p>
              {it.reply && (
                <div className="fb-reply">
                  <div className="fb-reply-head">{t("fb.replyTitle")}</div>
                  <p>{it.reply}</p>
                  {it.replied_at && <span className="muted fb-time">{fmtTime(it.replied_at)}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
