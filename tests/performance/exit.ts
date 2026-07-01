export function runPerfScript(main: () => Promise<void>) {
  void (async () => {
    try {
      await main();
      process.exit(0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}

export function runPerfScriptWithExitCode(main: () => Promise<void>) {
  void (async () => {
    try {
      await main();
      process.exit(process.exitCode ?? 0);
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  })();
}
