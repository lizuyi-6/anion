"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            页面遇到了问题
          </h2>
          <p
            style={{
              color: "#666",
              marginBottom: "2rem",
              maxWidth: "400px",
              lineHeight: 1.6,
            }}
          >
            抱歉，页面发生了意外错误。请尝试刷新页面或返回首页。
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "10px",
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              返回首页
            </button>
            <button
              onClick={reset}
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "10px",
                border: "none",
                background: "#222",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
            >
              重试
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
