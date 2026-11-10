import { Signal, signal, effect } from '@angular/core';

/**
 * Creates a Readonly Signal whose value is updated after a delay (debounceTime).
 *
 * @param sourceInput Input signal (e.g., rawInput)
 * @param time Delay in microseconds (default: 200 ms)
 */
export function debouncedSignal<T>(sourceInput: Signal<T>, time = 200): Signal<T> {
  const debounced = signal<T>(sourceInput());

  effect((onCleanup) => {
    const value = sourceInput();
    const timeout = setTimeout(() => debounced.set(value), time);

    // Every time the source changes, we cancel the previous timeout before the timer expires
    onCleanup(() => clearTimeout(timeout));
  });

  return debounced.asReadonly();
}
