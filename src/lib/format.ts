export function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function coerceSqlNumber(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function formatFileSize(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }

  if (value < 1000) {
    return `${value} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let currentValue = value;
  let unitIndex = -1;

  while (currentValue >= 1000 && unitIndex < units.length - 1) {
    currentValue /= 1000;
    unitIndex += 1;
  }

  const digits = currentValue >= 100 ? 0 : currentValue >= 10 ? 1 : 2;
  return `${currentValue.toFixed(digits)} ${units[unitIndex]}`;
}
