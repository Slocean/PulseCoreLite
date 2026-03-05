export type DebouncedFn<T extends (...args: any[]) => void> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce<T extends (...args: any[]) => void>(fn: T, waitMs = 300): DebouncedFn<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, waitMs);
  }) as DebouncedFn<T>;

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (!lastArgs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      return;
    }
    const args = lastArgs;
    lastArgs = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    fn(...args);
  };

  debounced.pending = () => Boolean(timer);

  return debounced;
}
