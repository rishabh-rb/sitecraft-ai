export class DatabaseHealthMonitor {
  private inFlight: Promise<boolean> | null = null;
  private checkedAt = -Infinity;
  private failureVersion = 0;
  connected = false;
  error: unknown;

  constructor(
    private readonly probe: () => Promise<void>,
    private readonly options: { timeoutMs: number; retryIntervalMs: number; now?: () => number; onFailure?: (error: unknown) => void }
  ) {}

  fail(error: unknown): void {
    this.failureVersion += 1;
    this.connected = false;
    this.error = error;
    this.checkedAt = this.now();
    this.options.onFailure?.(error);
  }

  private now(): number { return this.options.now?.() ?? Date.now(); }

  check(): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    if (this.now() - this.checkedAt < this.options.retryIntervalMs) return Promise.resolve(this.connected);
    this.inFlight = this.run().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async run(): Promise<boolean> {
    const failureVersion = this.failureVersion;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.probe(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Database health check timed out.")), this.options.timeoutMs); }),
      ]);
      if (failureVersion !== this.failureVersion) return this.connected;
      this.connected = true;
      this.error = undefined;
      this.checkedAt = this.now();
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
