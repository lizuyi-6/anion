"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "1.35rem", marginBottom: "0.75rem" }}>
        页面加载出错
      </h2>
      <p
        style={{
          color: "#666",
          marginBottom: "2rem",
          maxWidth: "380px",
          lineHeight: 1.6,
        }}
      >
        这部分内容遇到了问题，请尝试重新加载。
      </p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          onClick={() => {
            window.location.href = "/";
          }}
          style={{
            padding: "0.55rem 1.4rem",
            borderRadius: "10px",
            border: "1px solid #ddd",
            background: "var(--bg-elevated, #fff)",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          返回首页
        </button>
        <button
          onClick={reset}
          style={{
            padding: "0.55rem 1.4rem",
            borderRadius: "10px",
            border: "none",
            background: "var(--text-primary, #222)",
            color: "var(--bg, #fff)",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          重试
        </button>
      </div>
    </div>
  );
}
