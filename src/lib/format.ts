export const BRL = (n: number, opts: { compact?: boolean } = {}) => {
  if (opts.compact) {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`;
    return `R$ ${n.toFixed(0)}`;
  }
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

export const PCT = (n: number, digits = 1) =>
  `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;

export const NUM = (n: number) => n.toLocaleString("pt-BR");

export const shortDate = (d: Date) =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });