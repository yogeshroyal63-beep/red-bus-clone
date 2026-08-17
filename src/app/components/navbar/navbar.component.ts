import { Component, ChangeDetectionStrategy, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { I18nService, Lang } from '../../services/i18n.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <header class="rb-header">
      <!-- Top strip -->
      <div class="top-strip">
        <div class="container flex-between">
          <div class="flex gap-16">
            <a class="strip-link"><i class="fa fa-download"></i> Download App</a>
            <a routerLink="/track" class="strip-link"><i class="fa fa-map-marked-alt"></i> Track Bus</a>
            <a class="strip-link"><i class="fa fa-headset"></i> 1800-102-8899</a>
          </div>
          <div class="flex-center gap-16">
            <a routerLink="/offers" class="strip-link"><i class="fa fa-tag"></i> Offers</a>

            <!-- Language Selector -->
            <div class="lang-selector" (click)="$event.stopPropagation(); showLangDD=!showLangDD">
              <span class="strip-link lang-btn">
                <i class="fa fa-globe"></i>
                {{currentLangLabel}}
                <i class="fa fa-chevron-down" style="font-size:9px;"></i>
              </span>
              <div class="lang-dropdown" *ngIf="showLangDD">
                <div class="lang-item" *ngFor="let lang of i18n.languages"
                     [class.active]="i18n.lang()===lang.code"
                     (click)="selectLang(lang.code); showLangDD=false">
                  <span class="lang-flag">{{lang.flag}}</span>
                  <span>{{lang.label}}</span>
                  <i class="fa fa-check" *ngIf="i18n.lang()===lang.code" style="color:#d84e55;margin-left:auto;"></i>
                </div>
              </div>
            </div>

            <!-- Theme Toggle -->
            <button class="theme-toggle strip-link" (click)="theme.toggle()" [title]="theme.theme()==='dark' ? i18n.t('theme.light') : i18n.t('theme.dark')">
              <i class="fa" [class.fa-moon]="theme.theme()==='light'" [class.fa-sun]="theme.theme()==='dark'"></i>
              {{theme.theme()==='light' ? i18n.t('theme.dark') : i18n.t('theme.light')}}
            </button>
          </div>
        </div>
      </div>

      <!-- Main Nav -->
      <nav class="main-nav">
        <div class="container flex-between">
          <div class="flex-center gap-28">
            <a routerLink="/" class="logo">
              <span class="logo-red">red</span><span class="logo-text">Bus</span>
            </a>
            <div class="nav-links">
              <a class="nav-link" routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
                <i class="fa fa-bus"></i> {{i18n.t('nav.bus')}}
              </a>
              <a class="nav-link" routerLink="/route-planner" routerLinkActive="active">
                <i class="fa fa-route"></i> Route Planner
              </a>
              <a class="nav-link" routerLink="/community" routerLinkActive="active">
                <i class="fa fa-users"></i> Community
              </a>
              <a class="nav-link" routerLink="/offers" routerLinkActive="active">
                <i class="fa fa-tag"></i> {{i18n.t('nav.offers')}}
              </a>
              <a class="nav-link" href="#">
                <i class="fa fa-building"></i> Hotels
              </a>
            </div>
          </div>
          <div class="flex-center gap-10">
            <!-- Notification Bell -->
            <a routerLink="/notifications" class="notif-bell" [class.has-unread]="notifCount > 0">
              <i class="fa fa-bell"></i>
              <span class="notif-badge" *ngIf="notifCount > 0">{{notifCount > 9 ? '9+' : notifCount}}</span>
            </a>
            <a routerLink="/my-bookings" class="strip-link nav-link" style="font-size:13px; border:none; padding:8px 12px;">
              <i class="fa fa-ticket-alt"></i> {{i18n.t('nav.bookings')}}
            </a>
            <a routerLink="/profile" class="strip-link nav-link" style="font-size:13px; border:none; padding:8px 12px;" [attr.title]="i18n.t('community.myActivityLink')">
              <i class="fa fa-user-circle"></i> My Activity
            </a>
            <button class="rb-btn-outline" style="padding:8px 16px; font-size:13px;" *ngIf="!auth.isLoggedIn()" routerLink="/login">
              <i class="fa fa-user"></i> {{i18n.t('nav.login')}}
            </button>
            <div class="user-menu" *ngIf="auth.isLoggedIn()" (click)="$event.stopPropagation(); showUserDD=!showUserDD">
              <button class="rb-btn-outline user-btn" style="padding:8px 14px; font-size:13px;">
                <i class="fa fa-user-circle"></i> {{auth.user()?.name?.split(' ')?.[0]}}
                <i class="fa fa-chevron-down" style="font-size:9px;"></i>
              </button>
              <div class="lang-dropdown" *ngIf="showUserDD" style="min-width:150px;">
                <div class="lang-item" routerLink="/profile" (click)="showUserDD=false">
                  <i class="fa fa-user"></i> <span>{{i18n.t('nav.profile')}}</span>
                </div>
                <div class="lang-item" (click)="logout()">
                  <i class="fa fa-sign-out-alt"></i> <span>{{i18n.t('nav.logout')}}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  `,
  styles: [`
    .rb-header { position:sticky; top:0; z-index:1000; }
    .top-strip { background:var(--strip-bg); border-bottom:1px solid var(--border); padding:7px 0; }
    .strip-link { font-size:12px; color:var(--text-secondary); text-decoration:none; display:flex; align-items:center; gap:5px; cursor:pointer; transition:color 0.2s;
      &:hover { color:var(--red); }
    }
    .theme-toggle { background:none; border:none; font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:5px; cursor:pointer; padding:0; transition:color 0.2s;
      &:hover { color:var(--red); }
    }
    .lang-selector { position:relative; }
    .lang-btn { cursor:pointer; user-select:none; }
    .lang-dropdown { position:absolute; top:calc(100% + 8px); right:0; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; box-shadow:var(--shadow-lg); z-index:500; min-width:160px; overflow:hidden; }
    .lang-item { display:flex; align-items:center; gap:8px; padding:9px 14px; font-size:13px; cursor:pointer; color:var(--text-primary); transition:background 0.15s;
      &:hover { background:var(--bg-hover); }
      &.active { background:var(--red-light); color:var(--red); font-weight:600; }
    }
    .lang-flag { font-size:16px; }
    .user-menu { position:relative; }
    .user-btn { display:flex; align-items:center; gap:6px; }
    .main-nav { background:var(--header-bg); border-bottom:3px solid var(--header-border); box-shadow:var(--shadow-md); }
    .main-nav .container { padding:10px 16px; }
    .logo { font-size:28px; font-weight:900; letter-spacing:-1px; text-decoration:none; flex-shrink:0; }
    .logo-red { color:var(--red); }
    .logo-text { color:var(--text-primary); }
    .nav-links { display:flex; }
    .nav-link { padding:8px 13px; font-size:13px; font-weight:500; color:var(--text-secondary); text-decoration:none; border-radius:6px; transition:all 0.2s; display:flex; align-items:center; gap:5px;
      i { font-size:12px; }
      &:hover, &.active { color:var(--red); background:var(--red-light); }
    }
    .notif-bell { position:relative; width:38px; height:38px; border-radius:50%; background:var(--bg-hover); display:flex; align-items:center; justify-content:center; color:var(--text-secondary); font-size:16px; text-decoration:none; transition:all 0.2s;
      &:hover, &.has-unread { color:var(--red); background:var(--red-light); }
    }
    .notif-badge { position:absolute; top:-2px; right:-2px; width:18px; height:18px; background:#f44336; color:#fff; font-size:10px; font-weight:700; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid var(--header-bg); animation:pulse-badge 2s infinite; }
    @keyframes pulse-badge { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
  
    @media (max-width: 768px) {
      .nav-links { display: none !important; }
      .top-strip { display: none !important; }
      .logo { font-size: 22px !important; }
      .main-nav .container { padding: 10px 12px !important; }
      .notif-bell, .rb-btn-outline { display: flex !important; }
    }
    @media (max-width: 480px) {
      .rb-btn-outline { display: none !important; }
    }
  `]
})
export class NavbarComponent {
  showLangDD = false;
  showUserDD = false;

  constructor(
    public theme: ThemeService,
    public i18n: I18nService,
    public notifService: NotificationService,
    public auth: AuthService,
    private router: Router,
    private elRef: ElementRef<HTMLElement>
  ) {}

  get notifCount() { return this.notifService.unreadCount; }
  get currentLangLabel() { return this.i18n.languages.find(l => l.code === this.i18n.lang())?.label || 'EN'; }
  selectLang(code: string) { this.i18n.setLang(code as Lang); }

  logout() {
    this.showUserDD = false;
    this.auth.logout().subscribe(() => this.router.navigateByUrl('/'));
  }

  // Close the language/user dropdown when the user clicks anywhere outside it
  @HostListener('document:click')
  closeLangDropdown() {
    if (this.showLangDD) this.showLangDD = false;
    if (this.showUserDD) this.showUserDD = false;
  }
}
