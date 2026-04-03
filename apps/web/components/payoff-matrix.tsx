"use client";

export type PayoffMatrixData = {
  rowHeader: string;
  colHeader: string;
  rows: Array<{
    label: string;
    payoffs: string[];
  }>;
  nashEquilibrium: string;
};

export function PayoffMatrix({
  data,
}: {
  data: PayoffMatrixData;
}) {
  const cellW = 110;
  const cellH = 50;
  const labelW = 80;
  const pad = 12;
  const cols = data.rows[0]?.payoffs.length ?? 0;
  const rows = data.rows.length;

  const gridW = cols * cellW + pad;
  const gridH = rows * cellH + pad;
  const totalW = labelW + gridW + 24;
  const totalH = 24 + gridH + 24;

  return (
    <div
      className="panel"
      data-testid="payoff-matrix"
    >
      <div className="section-head">
        <div>
          <p className="panel-label">博弈论分析</p>
          <h3>收益矩阵</h3>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width="100%"
        style={{ maxWidth: "100%", height: "auto" }}
        role="img"
        aria-label="收益矩阵图表"
      >
        {/* Corner label */}
        <text
          x={labelW / 2}
          y={16}
          textAnchor="middle"
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }}
        >
          {data.rowHeader} / {data.colHeader}
        </text>

        {/* Column headers */}
        {data.rows[0]?.payoffs.map((_, ci) => (
          <text
            key={`col-hdr-${ci}`}
            x={labelW + ci * cellW + cellW / 2}
            y={16}
            textAnchor="middle"
            style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }}
          >
            {ci === 0 ? "强硬" : "让步"}
          </text>
        )) ?? null}

        {/* Row headers + cells */}
        {data.rows.map((row, ri) => (
          <g key={`row-${ri}`}>
            <text
              x={labelW / 2 - 4}
              y={24 + ri * cellH + cellH / 2 + pad}
              textAnchor="end"
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--muted)" }}
            >
              {row.label}
            </text>
            {row.payoffs.map((payoff, ci) => (
              <g key={`cell-${ri}-${ci}`}>
                <rect
                  x={labelW + ci * cellW}
                  y={24 + pad + ri * cellH}
                  width={cellW - pad}
                  height={cellH - pad}
                  rx={6}
                  style={{
                    fill: "var(--bg-elevated)",
                    stroke: "var(--line)",
                    strokeWidth: 1,
                  }}
                />
                <text
                  x={labelW + ci * cellW + (cellW - pad) / 2}
                  y={24 + pad + ri * cellH + (cellH - pad) / 2 + 4}
                  textAnchor="middle"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 12, fill: "var(--text)" }}
                >
                  {payoff}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      {data.nashEquilibrium ? (
        <p className="muted-copy" style={{ marginTop: "0.5rem", fontSize: "0.88rem" }}>
          纳什均衡: {data.nashEquilibrium}
        </p>
      ) : null}
    </div>
  );
}
