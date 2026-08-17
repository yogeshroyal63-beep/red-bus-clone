import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationService]
    });
    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => expect(service).toBeTruthy());

  it('should seed initial notifications on first load', () => {
    expect(service.notifications().length).toBeGreaterThan(0);
  });

  it('should correctly count unread notifications', () => {
    const unread = service.notifications().filter(n => !n.read).length;
    expect(service.unreadCount).toBe(unread);
  });

  it('should push a new notification with pending status', async () => {
    const before = service.notifications().length;
    const pushPromise = service.push({
      type: 'booking', title: 'Test', message: 'Test message',
      channel: 'push', icon: 'fa-check', color: '#4caf50'
    });
    expect(service.notifications().length).toBe(before + 1);
    expect(service.notifications()[0].deliveryStatus).toBe('pending');
    // Flush the HTTP request from delivery attempt
    try { httpMock.expectOne(req => req.url.includes('/notifications/send')).flush({ success: true, delivered: ['push'] }); } catch {}
  });

  it('should mark a notification as read', () => {
    const notif = service.notifications().find(n => !n.read)!;
    service.markRead(notif.id);
    expect(service.notifications().find(n => n.id === notif.id)!.read).toBeTrue();
  });

  it('should mark all notifications as read', () => {
    service.markAllRead();
    expect(service.notifications().every(n => n.read)).toBeTrue();
    expect(service.unreadCount).toBe(0);
  });

  it('should delete a notification', () => {
    const before = service.notifications().length;
    const id = service.notifications()[0].id;
    service.delete(id);
    expect(service.notifications().length).toBe(before - 1);
    expect(service.notifications().find(n => n.id === id)).toBeUndefined();
  });

  it('should not push notification if type is disabled in prefs', async () => {
    service.updatePrefs({ promotions: false });
    const before = service.notifications().length;
    await service.push({ type: 'offer', title: 'Deal', message: 'Save 20%', channel: 'push', icon: 'fa-tag', color: '#d84e55' });
    expect(service.notifications().length).toBe(before); // Should NOT be added
  });

  it('should update channel preferences', () => {
    service.updatePrefs({ channels: { push: false, email: true, sms: true } });
    expect(service.prefs().channels.push).toBeFalse();
    expect(service.prefs().channels.sms).toBeTrue();
  });

  it('should persist prefs to localStorage', () => {
    service.updatePrefs({ journeyReminders: false });
    const saved = JSON.parse(localStorage.getItem('rb_notif_prefs')!);
    expect(saved.journeyReminders).toBeFalse();
  });

  it('should format timeAgo correctly', () => {
    expect(service.timeAgo(new Date())).toBe('Just now');
    expect(service.timeAgo(new Date(Date.now() - 3600000))).toBe('1h ago');
    expect(service.timeAgo(new Date(Date.now() - 2 * 86400000))).toBe('2d ago');
  });
});
