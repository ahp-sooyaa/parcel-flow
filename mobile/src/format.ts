const mmkFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Formats whole kyat the way the web dashboard does, for example "12,500 MMK". */
export function formatMmk(amount: number) {
  return `${mmkFormatter.format(amount)} MMK`;
}
