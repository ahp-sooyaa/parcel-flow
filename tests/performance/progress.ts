export function logStepStart(step: number, total: number, label: string) {
  console.log(`\n[${step}/${total}] ${label}...`);
}

export function logStepDone(step: number, total: number, label: string, startedAt: number) {
  const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[${step}/${total}] ${label} — done in ${elapsedSeconds}s`);
}

export function logProgress(label: string, current: number, total: number) {
  const percent = total === 0 ? 100 : Math.round((current / total) * 100);
  console.log(`${label}: ${current}/${total} (${percent}%)`);
}
