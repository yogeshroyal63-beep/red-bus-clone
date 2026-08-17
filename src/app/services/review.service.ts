import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { I18nService } from './i18n.service';

export interface Review {
  id: string;
  busId: string;
  bookingPnr?: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  createdAt: Date;
  editedAt?: Date;
  upvotes: number;
  reported: boolean;
  reportCount: number;
  visible: boolean;
  verified: boolean;
  journeyDate: string;
  helpful: string[];
}

/** A review's author is highlighted as a "Trusted Reviewer" once their review
 *  earns this many genuine upvotes. Recomputed live from `upvotes` — never stored. */
export const TRUSTED_REVIEWER_UPVOTE_THRESHOLD = 20;

const SEED_REVIEWS: Review[] = [
  { id:'r1', busId:'1', bookingPnr:'RBABC001', userId:'u1', userName:'Arjun Sharma', userAvatar:'A', rating:5,
    text:'Absolutely fantastic journey! The bus was clean, on time, and the driver was professional. Seats were very comfortable and the AC was perfect. Will definitely book VRL again!',
    createdAt:new Date(Date.now()-86400000*2), upvotes:34, reported:false, reportCount:0,
    visible:true, verified:true, journeyDate:'2026-07-20', helpful:[] },
  { id:'r2', busId:'1', bookingPnr:'RBABC002', userId:'u2', userName:'Priya Nair', userAvatar:'P', rating:4,
    text:'Good experience overall. Bus was slightly delayed by 15 mins but the journey was smooth. Staff was helpful. The charging points worked well throughout the trip.',
    createdAt:new Date(Date.now()-86400000*5), upvotes:18, reported:false, reportCount:0,
    visible:true, verified:true, journeyDate:'2026-07-15', helpful:[] },
  { id:'r3', busId:'1', bookingPnr:'RBABC003', userId:'u3', userName:'Rahul Verma', userAvatar:'R', rating:3,
    text:'Average experience. The bus was okay but the seats were a bit cramped. WiFi did not work for most of the journey. Expected better given the price.',
    createdAt:new Date(Date.now()-86400000*8), upvotes:7, reported:false, reportCount:0,
    visible:true, verified:true, journeyDate:'2026-07-10', helpful:[] },
  { id:'r4', busId:'2', bookingPnr:'RBABC004', userId:'u4', userName:'Sneha Patel', userAvatar:'S', rating:5,
    text:'SRS Travels is always my first choice for night journeys. Excellent service, comfortable sleeper berths, and timely arrival. Highly recommended!',
    createdAt:new Date(Date.now()-86400000*1), upvotes:22, reported:false, reportCount:0,
    visible:true, verified:true, journeyDate:'2026-08-01', helpful:[] },
];

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private i18n = inject(I18nService);
  private readonly base = `${environment.apiUrl}/reviews`;

  private _reviews = signal<Review[]>(this.loadFromStorage());
  reviews = this._reviews.asReadonly();

  // Findings #2/#7: addReview/editReview/markHelpful/report used to apply every change
  // to local state optimistically, then fire the real API call with
  // catchError(() => of(null)) — so a 409 (duplicate review), 403 (unverified/no PNR),
  // or 403 (edit window passed) was swallowed and never surfaced. A user with no token
  // never even called the backend (the `if (token)` gate only controlled whether the
  // HTTP call fired at all), so their review only ever existed in their own browser
  // while the UI showed it as posted. lastError now surfaces real failures, and the
  // optimistic local state is rolled back when the server rejects the action.
  lastError = signal<string | null>(null);

  private loadFromStorage(): Review[] {
    try {
      const stored = localStorage.getItem('rb_reviews');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return SEED_REVIEWS;
  }

  private persist() {
    try { localStorage.setItem('rb_reviews', JSON.stringify(this._reviews())); } catch {}
  }

  /** Fetch reviews for a bus from backend; falls back to signal state on error */
  loadForBus(busId: string) {
    this.http.get<{ success: boolean; data: Review[] }>(`${this.base}/${busId}`)
      .pipe(catchError(() => of(null)))
      .subscribe(resp => {
        if (resp?.success && resp.data.length) {
          // Merge server reviews with local-only ones (so locally-submitted reviews show too)
          const serverIds = new Set(resp.data.map(r => r.id));
          const localOnly = this._reviews().filter(r => r.busId === busId && !serverIds.has(r.id));
          this._reviews.update(all => [
            ...all.filter(r => r.busId !== busId),
            ...resp.data,
            ...localOnly
          ]);
        }
      });
  }

  getForBus(busId: string) { return this._reviews().filter(r => r.busId === busId && r.visible); }

  getAvgRating(busId: string): number {
    const reviews = this.getForBus(busId);
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }

  canReview(busId: string, userId: string, bookingPnr?: string): boolean {
    // Finding #27: this used to block on busId+userId alone — one review per bus, full
    // stop — while the server correctly enforces one review per *journey* (busId +
    // userId + bookingPnr), since a real repeat customer can legitimately ride the same
    // route twice on two separate trips. Now mirrors the server's actual rule so a
    // second, legitimate review isn't blocked client-side before it even reaches the API.
    return !this._reviews().some(r => r.busId === busId && r.userId === userId && (!bookingPnr || r.bookingPnr === bookingPnr));
  }

  /** A review is "trusted" purely as a live function of its real upvote count —
   *  no stored flag, so it can never drift out of sync with actual community votes. */
  isTrustedReview(review: Review): boolean {
    return review.upvotes >= TRUSTED_REVIEWER_UPVOTE_THRESHOLD;
  }

  addReview(review: Omit<Review, 'id'|'upvotes'|'reported'|'reportCount'|'visible'|'helpful'>) {
    this.lastError.set(null);
    const token = localStorage.getItem('rb_token');
    if (!token) {
      // Posting requires a real account now that login exists (see auth.service.ts) —
      // no more silent local-only fake review with no server call at all.
      this.lastError.set(this.i18n.t('err.unauthorized'));
      return null;
    }

    const newReview: Review = { ...review, id:'r'+Date.now(), upvotes:0, reported:false, reportCount:0, visible:true, helpful:[] };

    // Optimistic update: add to signal immediately so the UI responds
    this._reviews.update(r => [newReview, ...r]);
    this.persist();

    // userName is NOT sent — the server derives the display name from the authenticated
    // account (Finding #5: a client-supplied userName let any verified user post under
    // any display name they chose, e.g. impersonating someone).
    this.http.post<{ success: boolean; data: Review }>(this.base, {
      busId: review.busId, rating: review.rating, text: review.text,
      journeyDate: review.journeyDate, bookingPnr: review.bookingPnr || ''
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        // Roll back the optimistic add and surface why it failed instead of silently
        // leaving a review that only ever existed in this browser.
        this._reviews.update(rs => rs.filter(r => r.id !== newReview.id));
        this.persist();
        this.lastError.set(this.i18n.tErr(err, 'err.reviewSubmitFailed'));
        return of(null);
      })
    ).subscribe(resp => {
      if (resp?.success) {
        // Replace temp local review with server-assigned id and server-derived name
        this._reviews.update(rs => rs.map(r => r.id === newReview.id ? { ...newReview, ...resp.data } : r));
        this.persist();
      }
    });

    return newReview;
  }

  editReview(id: string, text: string, rating: number) {
    this.lastError.set(null);
    const review = this._reviews().find(r => r.id === id);
    if (!review) return false;
    const hoursSince = (Date.now() - new Date(review.createdAt).getTime()) / 3600000;
    if (hoursSince > 24) { this.lastError.set(this.i18n.t('err.editExpired')); return false; }

    const token = localStorage.getItem('rb_token');
    if (!token) { this.lastError.set(this.i18n.t('err.unauthorized')); return false; }

    const previous = review;
    this._reviews.update(rs => rs.map(r => r.id === id ? { ...r, text, rating, editedAt: new Date() } : r));
    this.persist();

    this.http.put(`${this.base}/${id}`, { text, rating }).pipe(
      catchError((err: HttpErrorResponse) => {
        this._reviews.update(rs => rs.map(r => r.id === id ? previous : r));
        this.persist();
        this.lastError.set(this.i18n.tErr(err, 'err.editSaveFailed'));
        return of(null);
      })
    ).subscribe();
    return true;
  }

  markHelpful(id: string, userId: string) {
    this.lastError.set(null);
    const review = this._reviews().find(r => r.id === id);
    // Finding #26: self-voting was unguarded server-side too; catching it here as well
    // gives immediate feedback instead of a round-trip 403.
    if (review && review.userId === userId) {
      this.lastError.set(this.i18n.t('err.selfUpvoteReview'));
      return;
    }
    const token = localStorage.getItem('rb_token');
    if (!token) { this.lastError.set(this.i18n.t('err.unauthorized')); return; }

    this._reviews.update(rs => rs.map(r => {
      if (r.id !== id) return r;
      const already = r.helpful.includes(userId);
      return { ...r, upvotes: already ? r.upvotes-1 : r.upvotes+1, helpful: already ? r.helpful.filter(u=>u!==userId) : [...r.helpful, userId] };
    }));
    this.persist();

    this.http.post(`${this.base}/${id}/helpful`, {}).pipe(
      catchError((err: HttpErrorResponse) => {
        // Roll back the optimistic vote toggle on rejection
        this._reviews.update(rs => rs.map(r => {
          if (r.id !== id) return r;
          const already = r.helpful.includes(userId);
          return { ...r, upvotes: already ? r.upvotes-1 : r.upvotes+1, helpful: already ? r.helpful.filter(u=>u!==userId) : [...r.helpful, userId] };
        }));
        this.persist();
        this.lastError.set(this.i18n.tErr(err, 'err.voteFailed'));
        return of(null);
      })
    ).subscribe();
  }

  report(id: string) {
    this.lastError.set(null);
    const token = localStorage.getItem('rb_token');
    if (!token) { this.lastError.set(this.i18n.t('err.unauthorized')); return; }

    const previous = this._reviews();
    this._reviews.update(rs => rs.map(r => {
      if (r.id !== id) return r;
      const newCount = r.reportCount + 1;
      return { ...r, reportCount: newCount, visible: newCount < 3 };
    }));
    this.persist();

    this.http.post(`${this.base}/${id}/report`, {}).pipe(
      catchError((err: HttpErrorResponse) => {
        this._reviews.set(previous);
        this.persist();
        this.lastError.set(this.i18n.tErr(err, 'err.reportFailed'));
        return of(null);
      })
    ).subscribe();
  }
}
