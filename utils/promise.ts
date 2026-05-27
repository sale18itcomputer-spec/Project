/**
 * Distinguishes "request took too long" from "request failed". Callers should
 * log a TimeoutError as `warn` (recoverable — cache still serves the UI) and
 * non-timeout failures as `error`.
 */
export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

export function isTimeoutError(err: unknown): err is TimeoutError {
    return err instanceof TimeoutError
        || (err instanceof Error && err.name === 'TimeoutError');
}

/**
 * Race a promise against a timeout. Rejects with a TimeoutError if the
 * promise has not settled within `ms`. Lets the UI recover from hung requests
 * instead of showing an infinite spinner.
 */
export function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message = `Request timed out after ${ms}ms`,
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
    });
}
