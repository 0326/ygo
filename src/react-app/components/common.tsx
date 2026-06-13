export function Spinner() {
  return <div className="spinner" aria-label="加载中" />;
}

export function Empty({ text = "暂无结果" }: { text?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "70px 0", color: "var(--text-2)" }}>
      <div style={{ fontSize: 40, opacity: .4, marginBottom: 8 }}>🂠</div>
      {text}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#e0866a" }}>
      出错了：{msg}
    </div>
  );
}
