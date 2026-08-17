import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NotificationService, NotifPrefs } from '../../services/notification.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="notif-page">
      <div class="notif-hero">
        <div class="container flex-between">
          <div>
            <h1><i class="fa fa-bell"></i> {{i18n.t('notif.title')}}</h1>
            <p>{{i18n.t('notif.unreadCount', {n: unread})}}</p>
          </div>
          <div class="flex-center gap-10">
            <button class="hero-btn" (click)="showPrefs=!showPrefs"><i class="fa fa-cog"></i> {{i18n.t('notif.preferences')}}</button>
            <button class="hero-btn red" (click)="ns.markAllRead()" *ngIf="unread>0"><i class="fa fa-check-double"></i> {{i18n.t('notif.markAllRead')}}</button>
          </div>
        </div>
      </div>

      <div class="container notif-layout" style="padding:28px 16px 64px;">
        <!-- Preferences Panel -->
        <div class="prefs-panel rb-card" *ngIf="showPrefs">
          <div class="prefs-header"><i class="fa fa-cog"></i> {{i18n.t('notif.preferencesTitle')}}</div>
          <div class="prefs-body">
            <div class="prefs-section">
              <div class="prefs-section-title">{{i18n.t('notif.notificationTypes')}}</div>
              <label class="pref-row" *ngFor="let pref of prefTypes(); trackBy: trackByIndex">
                <div class="pref-info">
                  <div class="pref-name"><i [class]="'fa '+pref.icon" [style.color]="pref.color"></i> {{pref.label}}</div>
                  <div class="pref-desc fs-12 text-grey">{{pref.desc}}</div>
                </div>
                <div class="toggle-switch" [class.on]="getPrefs()[pref.key]" (click)="togglePref(pref.key)">
                  <div class="toggle-knob"></div>
                </div>
              </label>
            </div>
            <div class="prefs-section">
              <div class="prefs-section-title">{{i18n.t('notif.deliveryChannels')}}</div>
              <label class="pref-row" *ngFor="let ch of channels(); trackBy: trackByIndex">
                <div class="pref-info">
                  <div class="pref-name"><i [class]="'fa '+ch.icon"></i> {{ch.label}}</div>
                </div>
                <div class="toggle-switch" [class.on]="getPrefs().channels[ch.key]" (click)="toggleChannel(ch.key)">
                  <div class="toggle-knob"></div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="notif-tabs">
          <button class="ntab" *ngFor="let tab of tabsWithCount; trackBy: trackByIndex" [class.active]="activeTab===tab.key" (click)="activeTab=tab.key">
            <i [class]="'fa '+tab.icon"></i> {{tab.label}}
            <span class="tab-count" *ngIf="tab.count>0">{{tab.count}}</span>
          </button>
        </div>

        <!-- Notifications list -->
        <div class="notif-list">
          <div class="empty-notif rb-card" *ngIf="filtered.length===0">
            <i class="fa fa-bell-slash fa-3x" style="color:#ddd;"></i>
            <p>{{i18n.t('notif.noNotifications', {tab: activeTabLabel})}}</p>
          </div>

          <div class="notif-item rb-card" *ngFor="let n of filtered; trackBy: trackNotifId" [class.unread]="!n.read" (click)="ns.markRead(n.id)">
            <div class="notif-icon-wrap" [style.background]="n.color+'22'" [style.color]="n.color">
              <i [class]="'fa '+n.icon"></i>
            </div>
            <div class="notif-content">
              <div class="notif-title" [class.fw-700]="!n.read">{{ns.displayTitle(n)}}</div>
              <div class="notif-msg fs-13 text-grey">{{ns.displayMessage(n)}}</div>
              <div class="notif-meta flex-center gap-12">
                <span class="fs-11 text-grey"><i class="fa fa-clock"></i> {{ns.timeAgo(n.timestamp)}}</span>
                <span class="channel-badge" [class]="n.channel">
                  <i [class]="getChannelIcon(n.channel)"></i> {{i18n.t('notif.channel.'+n.channel)}}
                </span>
                <span class="delivery-badge" [class]="n.deliveryStatus">
                  <i class="fa" [class.fa-check-double]="n.deliveryStatus==='delivered'" [class.fa-clock]="n.deliveryStatus==='pending'" [class.fa-times]="n.deliveryStatus==='failed'"></i>
                  {{i18n.t('notif.status.'+n.deliveryStatus)}}
                </span>
              </div>
            </div>
            <div class="notif-actions">
              <div class="unread-dot" *ngIf="!n.read"></div>
              <button class="delete-notif" (click)="$event.stopPropagation(); ns.delete(n.id)" [title]="i18n.t('notif.delete')">
                <i class="fa fa-times"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notif-page { min-height:100vh; background:var(--bg-secondary); }
    .notif-hero { background:linear-gradient(135deg,#1a237e,#283593); padding:32px 0 24px; color:white;
      h1 { font-size:26px; font-weight:800; display:flex; align-items:center; gap:12px; }
      p { color:rgba(255,255,255,0.75); margin-top:4px; }
    }
    .hero-btn { padding:8px 16px; border:1.5px solid rgba(255,255,255,0.4); background:transparent; color:white; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; transition:all 0.2s;
      &:hover { background:rgba(255,255,255,0.15); }
      &.red { border-color:#d84e55; &:hover { background:#d84e55; } }
    }
    .prefs-panel { margin-bottom:20px; overflow:hidden; }
    .prefs-header { padding:16px 20px; font-size:14px; font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; background:var(--bg-card); }
    .prefs-body { padding:20px; display:grid; grid-template-columns:1fr 1fr; gap:24px; background:var(--bg-card); }
    .prefs-section-title { font-size:12px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px; }
    .pref-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border); cursor:pointer;
      &:last-child { border-bottom:none; }
    }
    .pref-name { font-size:13px; font-weight:500; display:flex; align-items:center; gap:8px; color:var(--text-primary); }
    .toggle-switch { width:44px; height:24px; border-radius:12px; background:#ddd; position:relative; cursor:pointer; transition:background 0.2s; flex-shrink:0;
      &.on { background:#d84e55; .toggle-knob { left:22px; } }
    }
    .toggle-knob { width:20px; height:20px; border-radius:50%; background:white; position:absolute; top:2px; left:2px; transition:left 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.2); }
    .notif-tabs { display:flex; gap:0; margin-bottom:20px; background:var(--bg-card); border-radius:8px; padding:4px; box-shadow:0 1px 4px rgba(0,0,0,0.08); overflow-x:auto; }
    .ntab { padding:9px 16px; border:none; background:none; font-size:13px; font-weight:500; color:var(--text-secondary); cursor:pointer; border-radius:6px; transition:all 0.2s; display:flex; align-items:center; gap:7px; white-space:nowrap;
      &.active { background:#d84e55; color:white; }
      &:hover:not(.active) { background:var(--bg-hover); }
    }
    .tab-count { background:#f44336; color:white; font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; }
    .empty-notif { padding:60px; text-align:center; color:var(--text-secondary); background:var(--bg-card); p { margin-top:12px; font-size:14px; } }
    .notif-item { display:flex; align-items:flex-start; gap:14px; padding:16px 20px; margin-bottom:8px; cursor:pointer; transition:box-shadow 0.2s; background:var(--bg-card);
      &.unread { border-left:3px solid #d84e55; }
      &:hover { box-shadow:0 4px 16px rgba(0,0,0,0.1); }
    }
    .notif-icon-wrap { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
    .notif-title { font-size:14px; color:var(--text-primary); margin-bottom:4px; }
    .notif-msg { line-height:1.5; margin-bottom:8px; }
    .notif-meta { flex-wrap:wrap; gap:8px; }
    .channel-badge, .delivery-badge { font-size:10px; font-weight:600; padding:2px 8px; border-radius:10px; display:flex; align-items:center; gap:4px;
      &.push, &.delivered { background:#e8f5e9; color:#2e7d32; }
      &.email { background:#e3f2fd; color:#1565c0; }
      &.sms { background:#fff8e1; color:#f57c00; }
      &.pending { background:#fff8e1; color:#f57c00; }
      &.failed { background:#ffebee; color:#c62828; }
    }
    .notif-actions { display:flex; flex-direction:column; align-items:center; gap:8px; flex-shrink:0; }
    .unread-dot { width:10px; height:10px; border-radius:50%; background:#d84e55; }
    .delete-notif { background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:14px; padding:4px; border-radius:4px; opacity:0; transition:all 0.2s;
      &:hover { color:#d84e55; }
    }
    .notif-item:hover .delete-notif { opacity:1; }
  
    @media (max-width: 768px) {
      .prefs-body { grid-template-columns: 1fr !important; }
      .notif-tabs { flex-wrap: wrap; gap: 4px; }
      .ntab { padding: 7px 12px; font-size: 12px; }
      .notif-item { padding: 12px 14px; }
      .notif-hero .container { flex-direction: column !important; gap: 12px !important; align-items: flex-start; }
      .hero-btn { font-size: 12px; padding: 6px 12px; }
    }
  `]
})
export class NotificationsComponent {
  activeTab = 'all'; showPrefs = false;

  // Finding K: these used to be plain class-body arrays built once, so switching
  // language never re-rendered them — even once wired to i18n.t(), the labels
  // wouldn't update until the component was destroyed and recreated, which fails the
  // "dynamic language switching without requiring a page reload" spec requirement.
  // They're now computed() signals that re-evaluate whenever i18n.lang() changes.
  prefTypes = computed(() => [
    { key:'bookingConfirmation', label:this.i18n.t('notif.pref.bookingConfirmation'), icon:'fa-check-circle', color:'#4caf50', desc:this.i18n.t('notif.pref.bookingConfirmationDesc') },
    { key:'cancellations', label:this.i18n.t('notif.pref.cancellations'), icon:'fa-times-circle', color:'#f44336', desc:this.i18n.t('notif.pref.cancellationsDesc') },
    { key:'journeyReminders', label:this.i18n.t('notif.pref.journeyReminders'), icon:'fa-bell', color:'#ff9800', desc:this.i18n.t('notif.pref.journeyRemindersDesc') },
    { key:'promotions', label:this.i18n.t('notif.pref.promotions'), icon:'fa-tag', color:'#d84e55', desc:this.i18n.t('notif.pref.promotionsDesc') },
    { key:'scheduleChanges', label:this.i18n.t('notif.pref.scheduleChanges'), icon:'fa-exclamation-triangle', color:'#9c27b0', desc:this.i18n.t('notif.pref.scheduleChangesDesc') },
    { key:'communityActivity', label:this.i18n.t('notif.pref.communityActivity'), icon:'fa-users', color:'#1976d2', desc:this.i18n.t('notif.pref.communityActivityDesc') },
  ]);

  channels = computed(() => [
    { key:'push', label:this.i18n.t('notif.channelLabel.push'), icon:'fa-mobile-alt' },
    { key:'email', label:this.i18n.t('notif.channelLabel.email'), icon:'fa-envelope' },
    { key:'sms', label:this.i18n.t('notif.channelLabel.sms'), icon:'fa-sms' },
  ]);

  private tabDefs = computed(() => [
    { key:'all', label:this.i18n.t('notif.tab.all'), icon:'fa-list' },
    { key:'unread', label:this.i18n.t('notif.tab.unread'), icon:'fa-circle' },
    { key:'booking', label:this.i18n.t('notif.tab.booking'), icon:'fa-ticket-alt' },
    { key:'offer', label:this.i18n.t('notif.tab.offer'), icon:'fa-tag' },
    { key:'community', label:this.i18n.t('notif.tab.community'), icon:'fa-users' },
  ]);

  constructor(public ns: NotificationService, public i18n: I18nService) {}

  get unread() { return this.ns.unreadCount; }

  get activeTabLabel() {
    return this.tabDefs().find(t => t.key === this.activeTab)?.label || this.activeTab;
  }

  get filtered() {
    const all = this.ns.notifications();
    if (this.activeTab === 'unread') return all.filter(n => !n.read);
    if (this.activeTab === 'all') return all;
    return all.filter(n => n.type === this.activeTab);
  }

  get tabsWithCount() {
    const all = this.ns.notifications();
    return this.tabDefs().map(t => {
      if (t.key === 'unread') return { ...t, count: this.unread };
      if (t.key === 'all') return { ...t, count: 0 };
      return { ...t, count: all.filter(n => n.type === t.key && !n.read).length };
    });
  }

  getPrefs() { return this.ns.prefs(); }
  getChannelIcon(ch: string) { return ch==='push' ? 'fa fa-mobile-alt' : ch==='email' ? 'fa fa-envelope' : 'fa fa-sms'; }

  togglePref(key: string) {
    const p = this.ns.prefs() as any;
    this.ns.updatePrefs({ [key]: !p[key] } as any);
  }

  toggleChannel(key: string) {
    const ch = { ...this.ns.prefs().channels } as any;
    ch[key] = !ch[key];
    this.ns.updatePrefs({ channels: ch });
  }
  trackNotifId(index: number, n: any): string { return n.id; }
  trackByIndex(index: number): number { return index; }
}
