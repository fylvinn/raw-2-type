import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class ShortcutService {
  private readonly document = inject(DOCUMENT);

  // A signal to track the copy status (for example, for a “Copied!” UI toast)
  readonly copyNotification = signal<boolean>(false);

  constructor() {
    this.initGlobalListeners();
  }

  private initGlobalListeners(): void {
    const window = this.document.defaultView;
    if (!window) return;

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      // Check that Ctrl+Shift+C (Windows/Linux) or Cmd+Shift+C (macOS) works
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey && event.shiftKey && event.code === 'KeyC') {
        event.preventDefault(); // Prevent the “Inspect Element” (DevTools) window from opening in Chrome/Firefox
        this.triggerCopyAction();
      }
    });
  }

  private copyActionCallback?: () => void;

  /**
   * Registering a custom key combination for a hotkey
   */
  registerCopyShortcut(callback: () => void): void {
    this.copyActionCallback = callback;
  }

  /**
   * A utility for quickly copying text to the clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      this.showCopyFeedback();
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  }

  private triggerCopyAction(): void {
    if (this.copyActionCallback) {
      this.copyActionCallback();
    }
  }

  private showCopyFeedback(): void {
    this.copyNotification.set(true);
    setTimeout(() => this.copyNotification.set(false), 2000);
  }
}
