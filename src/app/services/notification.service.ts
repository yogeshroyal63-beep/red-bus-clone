import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { I18nService } from './i18n.service';

export type NotifType = 'booking' | 'cancellation' | 'reminder' | 'offer' | 'schedule' | 'community';
export type Channel = 'push' | 'email' | 'sms';
export type DeliveryStatus = 'delivered' | 'pending' | 'failed' | 'retrying';

export interface Notification {
  id: string;
  type: NotifType;
  /** Fallback literal text (used if no titleKey/messageKey is provided) */
  title: string;
  message: string;
  /** i18n keys — when present, title/message are re-translated live on language switch */
  titleKey?: string;
  messageKey?: string;
  params?: Record<string, string | number>;
  timestamp: Date;
  read: boolean;
  channel: Channel;
  deliveryStatus: DeliveryStatus;
  retries: number;
  maxRetries: number;
  icon: string;
  color: string;
  action?: string;
}

export interface NotifPrefs {
  bookingConfirmation: boolean;
  cancellations: boolean;
  journeyReminders: boolean;
  promotions: boolean;
  scheduleChanges: boolean;
  communityActivity: boolean;
  channels: { push: boolean; email: boolean; sms: boolean };
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private _notifications = signal<Notification[]>([]);
  notifications = this._notifications.asReadonly();

  private _prefs = signal<NotifPrefs>(
    JSON.parse(localStorage.getItem('rb_notif_prefs') || 'null') || {
      bookingConfirmation: true, cancellations: true, journeyReminders: true,
      promotions: false, scheduleChanges: true, communityActivity: true,
      channels: { push: true, email: true, sms: false }
    }
  );
  prefs = this._prefs.asReadonly();

  constructor(private http: HttpClient, private i18n: I18nService) {
    const saved = localStorage.getItem('rb_notifications');
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) }));
        this._notifications.set(parsed);
      } catch { this.seedNotifications(); }
    } else {
      this.seedNotifications();
    }
    // Retry any pending notifications on startup
    this.retryPendingNotifications();

    // Account-linked prefs (Req 2 follow-up): if logged in, the account's saved
    // notification prefs win over this browser's localStorage cache, so they
    // follow the user across devices.
    const token = localStorage.getItem('rb_token');
    if (token) {
      this.http.get<{ success: boolean; data: any }>(`${environment.apiUrl}/auth/me`).pipe(
        catchError(() => of(null))
      ).subscribe(res => {
        const accountPrefs = res?.data?.preferences?.notifPrefs;
        if (accountPrefs) this._prefs.set(accountPrefs);
      });

      // Finding #16: notification history used to be localStorage-only, so logging in on
      // a second device showed the seed demo notifications again instead of real history.
      // The account's saved history (if any) now wins over this browser's local copy.
      this.http.get<{ success: boolean; data: any }>(`${environment.apiUrl}/notifications/history`).pipe(
        catchError(() => of(null))
      ).subscribe(res => {
        const accountHistory = res?.data;
        if (Array.isArray(accountHistory) && accountHistory.length) {
          this._notifications.set(accountHistory.map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
          this.save();
        }
      });
    }
  }

  /** Best-effort push of the current notification list to the account, so a second
   *  device sees real history instead of only its own local seed data (Finding #16). */
  private syncHistory() {
    const token = localStorage.getItem('rb_token');
    if (!token) return;
    this.http.put(`${environment.apiUrl}/notifications/history`, { notifications: this._notifications() }).pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  private seedNotifications() {
    const seed: Notification[] = [
      {
        id: '1', type: 'booking', title: 'Booking Confirmed! 🎉',
        titleKey: 'notif.seedBookingTitle',
        message: 'Your bus from Bangalore to Chennai on 15 Aug is confirmed. PNR: RBABC123',
        messageKey: 'notif.seedBookingMsg',
        params: { from: 'Bangalore', to: 'Chennai', date: '15 Aug', pnr: 'RBABC123' },
        timestamp: new Date(Date.now() - 5 * 60000), read: false,
        channel: 'push', deliveryStatus: 'delivered', retries: 0, maxRetries: 3,
        icon: 'fa-check-circle', color: '#4caf50', action: '/my-bookings'
      },
      {
        id: '2', type: 'reminder', title: 'Journey Tomorrow! 🚌',
        titleKey: 'notif.seedReminderTitle',
        message: 'Reminder: Your bus departs tomorrow at 21:30 from Majestic Bus Stand. Be there 30 mins early.',
        messageKey: 'notif.seedReminderMsg',
        params: { time: '21:30', point: 'Majestic Bus Stand' },
        timestamp: new Date(Date.now() - 2 * 3600000), read: false,
        channel: 'email', deliveryStatus: 'delivered', retries: 0, maxRetries: 3,
        icon: 'fa-bell', color: '#ff9800', action: '/my-bookings'
      },
      {
        id: '3', type: 'offer', title: 'Exclusive Offer For You! 💰',
        titleKey: 'notif.seedOfferTitle',
        message: 'Use code FIRST10 and get 10% off on your next booking. Valid till 31st Dec.',
        messageKey: 'notif.seedOfferMsg',
        params: { code: 'FIRST10', percent: 10 },
        timestamp: new Date(Date.now() - 24 * 3600000), read: true,
        channel: 'push', deliveryStatus: 'delivered', retries: 0, maxRetries: 3,
        icon: 'fa-tag', color: '#d84e55', action: '/offers'
      },
      {
        id: '4', type: 'schedule', title: 'Schedule Change Alert ⚠️',
        titleKey: 'notif.seedScheduleTitle',
        message: 'Your VRL Travels bus (PNR: RBABC123) departure changed from 21:30 to 22:00.',
        messageKey: 'notif.seedScheduleMsg',
        params: { operator: 'VRL Travels', pnr: 'RBABC123', oldTime: '21:30', newTime: '22:00' },
        timestamp: new Date(Date.now() - 3 * 3600000), read: false,
        channel: 'sms', deliveryStatus: 'delivered', retries: 0, maxRetries: 3,
        icon: 'fa-exclamation-triangle', color: '#f44336', action: '/my-bookings'
      },
      {
        id: '5', type: 'community', title: 'New Comment on Your Post 💬',
        titleKey: 'notif.seedCommunityTitle',
        message: 'Priya Nair commented on your "Bangalore to Goa" travel story.',
        messageKey: 'notif.seedCommunityMsg',
        params: { name: 'Priya Nair', postTitle: 'Bangalore to Goa' },
        timestamp: new Date(Date.now() - 6 * 3600000), read: true,
        channel: 'push', deliveryStatus: 'delivered', retries: 0, maxRetries: 3,
        icon: 'fa-comment', color: '#1976d2', action: '/community'
      },
      {
        id: '6', type: 'cancellation', title: 'Refund Processed ✅',
        titleKey: 'notif.seedRefundTitle',
        message: 'Refund of ₹750 for PNR RBXYZ789 has been processed. Reflects in 5-7 business days.',
        messageKey: 'notif.seedRefundMsg',
        params: { amount: 750, pnr: 'RBXYZ789' },
        timestamp: new Date(Date.now() - 48 * 3600000), read: true,
        channel: 'email', deliveryStatus: 'delivered', retries: 0, maxRetries: 3,
        icon: 'fa-undo', color: '#9c27b0', action: '/my-bookings'
      },
    ];
    this._notifications.set(seed);
    this.save();
  }

  /** Live-translated title/message — re-evaluates against the current language on every call.
   *  Falls back to the stored literal text if no i18n key was set (e.g. legacy notifications). */
  displayTitle(n: Notification): string {
    return n.titleKey ? this.i18n.t(n.titleKey, n.params) : n.title;
  }

  displayMessage(n: Notification): string {
    return n.messageKey ? this.i18n.t(n.messageKey, n.params) : n.message;
  }

  /**
   * Dispatch a real notification through the configured channels.
   * Includes exponential-backoff retry for failed deliveries.
   */
  async push(notif: Omit<Notification, 'id' | 'timestamp' | 'read' | 'deliveryStatus' | 'retries' | 'maxRetries'>) {
    const prefs = this._prefs();
    if (!this.isAllowed(notif.type, prefs)) return;

    const newNotif: Notification = {
      ...notif,
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
      read: false,
      deliveryStatus: 'pending',
      retries: 0,
      maxRetries: 3
    };

    this._notifications.update(n => [newNotif, ...n]);
    this.save();
    this.syncHistory();

    // Attempt actual delivery
    await this.deliver(newNotif.id, prefs);
  }

  /**
   * Finding #14: the "reminder" used to fire immediately at booking time, alongside the
   * booking confirmation — despite the code comment claiming it was "simulated 24h
   * before". This schedules the actual push for (departureDateTime - 24h), or fires it
   * right away if that moment has already passed (e.g. a same-day booking). There's no
   * server-side cron in this app, so the scheduling is client-side via setTimeout, same
   * honest limitation the rest of the retry/delivery system already has — but at least
   * it now genuinely waits rather than lying about "24h before" while firing at t=0.
   */
  pushScheduled(notif: Omit<Notification, 'id' | 'timestamp' | 'read' | 'deliveryStatus' | 'retries' | 'maxRetries'>, deliverAt: Date) {
    const delay = deliverAt.getTime() - Date.now();
    if (delay <= 0) { this.push(notif); return; }
    // Cap the in-memory timer at a sane max (browsers silently clamp very long
    // setTimeout delays anyway) — for delays beyond that, rely on retryPendingNotifications
    // style re-checks not being needed since this is a one-shot scheduled fire, not a retry.
    const MAX_TIMEOUT = 2 ** 31 - 1;
    setTimeout(() => this.push(notif), Math.min(delay, MAX_TIMEOUT));
  }

  private isAllowed(type: NotifType, prefs: NotifPrefs): boolean {
    const map: Record<NotifType, keyof NotifPrefs> = {
      booking: 'bookingConfirmation', cancellation: 'cancellations',
      reminder: 'journeyReminders', offer: 'promotions',
      schedule: 'scheduleChanges', community: 'communityActivity'
    };
    return !!prefs[map[type]];
  }

  private async deliver(id: string, prefs: NotifPrefs, attempt = 0): Promise<void> {
    const notif = this._notifications().find(n => n.id === id);
    if (!notif) return;

    const activeChannels = Object.entries(prefs.channels)
      .filter(([, enabled]) => enabled)
      .map(([ch]) => ch as Channel);

    if (activeChannels.length === 0) {
      this.updateDelivery(id, 'failed');
      return;
    }

    // Finding F: this call used to fire unconditionally, but POST /notifications/send
    // requires verifyToken and 401s for guests. Since booking never requires login, every
    // real notification for a guest — including genuine booking confirmations — would
    // 401, retry at 2s/4s/8s, and land on "failed", lying about delivery status for the
    // most common user class on the platform's most important events. There's no backend
    // guest-delivery endpoint to call instead, so guests get an honest local-only
    // "delivered" status (the in-app notification itself is real and visible either way)
    // rather than a doomed retry loop against a route they can never pass.
    if (!localStorage.getItem('rb_token')) {
      this.updateDelivery(id, 'delivered');
      return;
    }

    try {
      // Real API call to backend notification endpoint — send the localized text.
      // BUG FIX: this previously piped through catchError(() => of({fallback:true})),
      // which swallowed every HTTP error into a "successful" fallback value. That
      // meant the catch block below — and therefore the whole retry/backoff path —
      // could never actually run for a real network/server failure, and every
      // notification was marked 'delivered' even when the send genuinely failed.
      // We now let HTTP errors propagate to the catch block, and also treat a
      // backend response that reports partial channel failure (res.failed.length)
      // as a delivery failure so it goes through the same retry path.
      const res: any = await this.http.post(`${environment.apiUrl}/notifications/send`, {
        notificationId: id,
        channels: activeChannels,
        title: this.displayTitle(notif),
        message: this.displayMessage(notif)
      }).toPromise();

      if (res?.failed?.length) {
        throw new Error(`Delivery failed on: ${res.failed.join(', ')}`);
      }

      this.updateDelivery(id, 'delivered');
    } catch {
      if (attempt < notif.maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        const delay = Math.pow(2, attempt + 1) * 1000;
        this.updateDelivery(id, 'retrying', attempt + 1);
        setTimeout(() => this.deliver(id, prefs, attempt + 1), delay);
      } else {
        this.updateDelivery(id, 'failed', attempt);
      }
    }
  }

  private updateDelivery(id: string, status: DeliveryStatus, retries?: number) {
    this._notifications.update(ns => ns.map(n =>
      n.id === id ? { ...n, deliveryStatus: status, ...(retries !== undefined && { retries }) } : n
    ));
    this.save();
    // Finding #15: retry state was entirely client-side and vanished if the tab closed
    // mid-retry — syncing the status here means the outcome (delivered/failed) is visible
    // from any device once it settles, even though the retry timers themselves still live
    // in this tab (a real server-side retry queue would need job infrastructure this
    // Express+in-memory backend doesn't have).
    this.syncHistory();
  }

  private retryPendingNotifications() {
    const pending = this._notifications().filter(n =>
      n.deliveryStatus === 'pending' || n.deliveryStatus === 'retrying'
    );
    pending.forEach(n => this.deliver(n.id, this._prefs(), n.retries));
  }

  markRead(id: string) {
    this._notifications.update(n => n.map(notif => notif.id === id ? { ...notif, read: true } : notif));
    this.save();
    this.syncHistory();
  }

  markAllRead() {
    this._notifications.update(n => n.map(notif => ({ ...notif, read: true })));
    this.save();
    this.syncHistory();
  }

  delete(id: string) {
    this._notifications.update(n => n.filter(notif => notif.id !== id));
    this.save();
    this.syncHistory();
  }

  get unreadCount() { return this._notifications().filter(n => !n.read).length; }

  updatePrefs(prefs: Partial<NotifPrefs>) {
    this._prefs.update(p => ({ ...p, ...prefs }));
    localStorage.setItem('rb_notif_prefs', JSON.stringify(this._prefs()));

    const token = localStorage.getItem('rb_token');
    if (token) {
      this.http.put(`${environment.apiUrl}/auth/me/preferences`, { notifPrefs: this._prefs() }).pipe(
        catchError(() => of(null)) // best-effort — localStorage already has it either way
      ).subscribe();
    }
  }

  private save() {
    try { localStorage.setItem('rb_notifications', JSON.stringify(this._notifications())); } catch {}
  }

  /** Localized relative time — previously hardcoded English ("Just now", "5m ago"...)
   *  regardless of the selected language. Now routes through i18n.t() like every other
   *  user-facing string in this service. */
  timeAgo(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return this.i18n.t('notif.justNow');
    if (mins < 60) return this.i18n.t('notif.minsAgo', { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return this.i18n.t('notif.hoursAgo', { n: hrs });
    return this.i18n.t('notif.daysAgo', { n: Math.floor(hrs / 24) });
  }
}
