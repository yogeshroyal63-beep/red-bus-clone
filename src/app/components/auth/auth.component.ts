import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-auth',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card rb-card">
        <div class="auth-tabs">
          <button class="auth-tab" [class.active]="mode()==='login'" (click)="mode.set('login')">{{i18n.t('auth.login')}}</button>
          <button class="auth-tab" [class.active]="mode()==='register'" (click)="mode.set('register')">{{i18n.t('auth.register')}}</button>
        </div>

        <div class="auth-error" *ngIf="error()"><i class="fa fa-exclamation-circle"></i> {{error()}}</div>

        <form *ngIf="mode()==='login'" (ngSubmit)="doLogin()" #loginForm="ngForm">
          <label>{{i18n.t('auth.email')}}</label>
          <input type="email" name="email" [(ngModel)]="loginEmail" required class="auth-input" autocomplete="email">
          <label>{{i18n.t('auth.password')}}</label>
          <input type="password" name="password" [(ngModel)]="loginPassword" required class="auth-input" autocomplete="current-password">
          <button type="submit" class="rb-btn-primary auth-submit" [disabled]="loading() || loginForm.invalid">
            <i class="fa fa-spinner fa-spin" *ngIf="loading()"></i> {{i18n.t('auth.login')}}
          </button>
        </form>

        <form *ngIf="mode()==='register'" (ngSubmit)="doRegister()" #registerForm="ngForm">
          <label>{{i18n.t('auth.name')}}</label>
          <input type="text" name="name" [(ngModel)]="regName" required minlength="2" class="auth-input" autocomplete="name">
          <label>{{i18n.t('auth.email')}}</label>
          <input type="email" name="email" [(ngModel)]="regEmail" required class="auth-input" autocomplete="email">
          <label>{{i18n.t('auth.mobile')}}</label>
          <input type="tel" name="mobile" [(ngModel)]="regMobile" required class="auth-input" placeholder="9876543210" autocomplete="tel">
          <label>{{i18n.t('auth.password')}}</label>
          <input type="password" name="password" [(ngModel)]="regPassword" required minlength="8" class="auth-input" autocomplete="new-password">
          <div class="fs-11 text-grey" style="margin:-8px 0 12px;">{{i18n.t('auth.passwordHint')}}</div>
          <button type="submit" class="rb-btn-primary auth-submit" [disabled]="loading() || registerForm.invalid">
            <i class="fa fa-spinner fa-spin" *ngIf="loading()"></i> {{i18n.t('auth.createAccount')}}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height: 60vh; display:flex; align-items:center; justify-content:center; padding: 48px 16px; }
    .auth-card { width: 100%; max-width: 380px; padding: 28px 24px; }
    .auth-tabs { display:flex; gap:8px; margin-bottom:20px; border-bottom:1px solid var(--border); }
    .auth-tab { flex:1; background:none; border:none; padding:10px; font-weight:600; font-size:14px; color:var(--text-secondary); cursor:pointer; border-bottom:2px solid transparent; }
    .auth-tab.active { color:var(--red); border-bottom-color:var(--red); }
    .auth-error { background:#fdecea; color:#b3261e; border-radius:8px; padding:10px 12px; font-size:13px; margin-bottom:14px; }
    label { display:block; font-size:12px; font-weight:600; color:var(--text-secondary); margin: 10px 0 4px; }
    .auth-input { width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; font-size:14px; background:var(--bg-card); color:var(--text-primary); }
    .auth-submit { width:100%; margin-top:18px; padding:11px; }
  `]
})
export class AuthComponent {
  mode = signal<'login' | 'register'>('login');
  loading = signal(false);
  error = signal('');

  loginEmail = ''; loginPassword = '';
  regName = ''; regEmail = ''; regMobile = ''; regPassword = '';

  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute, public i18n: I18nService) {}

  private redirectAfterAuth() {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/profile';
    this.router.navigateByUrl(returnUrl);
  }

  doLogin() {
    this.error.set(''); this.loading.set(true);
    this.auth.login({ email: this.loginEmail, password: this.loginPassword }).subscribe({
      next: () => { this.loading.set(false); this.redirectAfterAuth(); },
      // Req 3 fix: previously showed the server's raw English error text
      // (err?.error?.error) whenever the server sent one, and only translated the
      // generic fallback. Now prefers the server's `code` (added in auth.js) so the
      // *specific* reason — no account / wrong password / rate-limited — is translated.
      error: (err) => { this.loading.set(false); this.error.set(this.i18n.tErr(err, 'auth.loginFailed')); }
    });
  }

  doRegister() {
    this.error.set(''); this.loading.set(true);
    this.auth.register({ name: this.regName, email: this.regEmail, mobile: this.regMobile, password: this.regPassword }).subscribe({
      next: () => { this.loading.set(false); this.redirectAfterAuth(); },
      error: (err) => {
        this.loading.set(false);
        // Req 3 fix: field-validation messages from express-validator are hardcoded
        // English (`d.message`) and were joined and shown verbatim. security.js now
        // attaches a `code` per field (FIELD_ERROR_CODES) that maps to a translated
        // string here instead — `d.message` is never rendered to the user.
        const details: Array<{ field: string; code?: string }> | undefined = err?.error?.details;
        const translatedDetails = details?.map(d => this.i18n.t(d.code || 'err.validationFailed')).join(' ');
        this.error.set(translatedDetails || this.i18n.tErr(err, 'auth.registerFailed'));
      }
    });
  }
}
