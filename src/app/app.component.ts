import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { ToastComponent } from './components/shared/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
