export * from './queue.js';
export * from './runtime.js';
export * from './scheduler.js';

/** Production wiring intentionally remains empty until a real queue adapter exists. */
export async function main(): Promise<void> {
  await Promise.resolve();
  throw new Error(
    'worker production adapter is not configured; use WorkerRuntime with explicit ports',
  );
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url ===
    new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href;
if (isDirectExecution) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
