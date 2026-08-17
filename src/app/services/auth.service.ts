import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { I18nService } from './i18n.service';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  mobile?: string;
  preferences?: { lang?: string; notifPrefs?: any };
}

// Finding U (critical): there was no AuthService, no login/register component, no
// /login or /register route anywhere in this app. The navbar's "Login" button had no
// click handler at all. grep for `localStorage.setItem('rb_token'` across the whole
// src/app tree returned zero matches — nothing in the shipped frontend ever wrote that
// key, even though review.service.ts, community.service.ts, notification.service.ts and
// i18n.service.ts all *read* it to decide whether to call the backend. That meant the
// `if (token)` gates flagged elsewhere in this audit weren't a fallback path — they were
// the ONLY path that could ever execute, for every user, forever. This service is what
// makes a real token exist.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;

  private _user = signal<AuthUser | null>(this.loadCachedUser());
  user = this._user.asReadonly();
  isLoggedIn = computed(() => !!this._user());

  constructor(private http: HttpClient, private i18n: I18nService) {}

  private loadCachedUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem('rb_user');
      const token = localStorage.getItem('rb_token');
      return raw && token ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  register(payload: { name: string; email: string; mobile: string; password: string }): Observable<AuthUser> {
    return this.http.post<any>(`${this.apiUrl}/auth/register`, payload).pipe(
      tap(res => this.persistSession(res.token, res.data)),
      catchError(err => throwError(() => err))
    );
  }

  login(payload: { email: string; password: string }): Observable<AuthUser> {
    return this.http.post<any>(`${this.apiUrl}/auth/login`, payload).pipe(
      tap(res => this.persistSession(res.token, res.data)),
      catchError(err => throwError(() => err))
    );
  }

  logout(): Observable<void> {
    const token = localStorage.getItem('rb_token');
    const req = token
      ? this.http.post<void>(`${this.apiUrl}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } })
      : of(void 0);
    // Clear locally regardless of whether the network call succeeds — the person
    // clicked logout, so the client-side session ends now either way.
    return req.pipe(
      tap(() => this.clearSession()),
      catchError(() => { this.clearSession(); return of(void 0); })
    );
  }

  private persistSession(token: string, user: AuthUser) {
    localStorage.setItem('rb_token', token);
    localStorage.setItem('rb_user', JSON.stringify(user));
    this._user.set(user);
    // Req 3 follow-up: the account's saved language (not this browser's leftover
    // localStorage value) must win the moment login/register succeeds, so the same
    // account shows the same language on a second device without needing a reload.
    this.i18n.applyAccountLang(user.preferences?.lang);
  }

  private clearSession() {
    // Finding V: booking.service.ts's cache is now keyed per-account
    // (rb_bookings_cache_<userId>, or rb_bookings_cache_guest) rather than one flat key
    // shared by every account that ever used this browser. Clear every such key on
    // logout, not just the old flat one, so nothing lingers for the next person on a
    // shared/library device.
    localStorage.removeItem('rb_token');
    localStorage.removeItem('rb_user');
    Object.keys(localStorage)
      .filter(k => k.startsWith('rb_bookings_cache'))
      .forEach(k => localStorage.removeItem(k));
    this._user.set(null);
  }

  get token(): string | null {
    return localStorage.getItem('rb_token');
  }
}
