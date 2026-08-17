import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // ISSUE #12 FIX: Guard against SSR — localStorage doesn't exist server-side
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private _theme = signal<Theme>(this.getInitialTheme());
  theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const t = this._theme();
      if (this.isBrowser) {
        document.documentElement.setAttribute('data-theme', t);
        try { localStorage.setItem('rb_theme', t); } catch {}
      }
    });
  }

  private getInitialTheme(): Theme {
    if (!this.isBrowser) return 'light'; // SSR: always default to light
    try {
      const saved = localStorage.getItem('rb_theme') as Theme;
      if (saved === 'light' || saved === 'dark') return saved;
      // Respect OS preference if no saved preference
      if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {}
    return 'light';
  }

  toggle() {
    this._theme.set(this._theme() === 'light' ? 'dark' : 'light');
  }

  set(t: Theme) {
    this._theme.set(t);
  }
}
