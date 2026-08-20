import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastComponent } from './components/shared/toast.component';

// Findings: AppComponent was OnPush with a template that never changes on its own
// (no inputs, no signals, no async pipe) — so Angular marked it dirty once at
// bootstrap, checked it, and it never became dirty again by itself. An OnPush
// component that isn't dirty blocks change detection for its ENTIRE subtree on the
// next tick, including whatever <router-outlet> is currently hosting — regardless
// of that routed component's own strategy (e.g. search-results uses default and
// still got blocked). So an HTTP response resolving inside a routed component would
// update its fields correctly, but the view never got re-checked, leaving the
// skeleton/stale content on screen. Any click handled by an Angular-bound listener
// anywhere on the page (navbar link, footer link, etc.) marks that view and its
// ancestor chain up to root dirty, which unblocks root and lets the next tick finally
// walk into router-outlet and render the already-correct data — hence "any click
// anywhere" appearing to fix it. AppComponent has nothing of its own to optimize by
// skipping checks, so it doesn't need OnPush; removing it lets default CD walk into
// router-outlet's content every tick like normal.
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, CommonModule, ToastComponent],
  template: `
    <!-- Accessibility: skip to main content -->
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <app-navbar></app-navbar>

    <main id="main-content" role="main" tabindex="-1">
      <router-outlet></router-outlet>
    </main>

    <app-footer></app-footer>

    <!-- Global toast/aria-live region -->
    <app-toast></app-toast>
  `,
  styles: [`
    main { min-height: calc(100vh - 130px); }
    .skip-link {
      position: absolute; top: -100px; left: 16px;
      background: var(--red); color: white;
      padding: 8px 16px; border-radius: 0 0 6px 6px;
      font-size: 13px; font-weight: 700; z-index: 9999;
      transition: top 0.2s; text-decoration: none;
      &:focus { top: 0; }
    }
  `]
})
export class AppComponent {}
