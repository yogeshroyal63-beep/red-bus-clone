import { Component, ChangeDetectionStrategy, Input, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService, Review } from '../../services/review.service';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-reviews',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reviews-section">
      <!-- Header stats -->
      <div class="reviews-header">
        <div class="avg-rating-block">
          <div class="avg-num">{{avgRating | number:'1.1-1'}}</div>
          <div class="avg-stars">
            <i class="fa fa-star" *ngFor="let s of getStarsFull(avgRating)"></i>
            <i class="fa fa-star-half-alt" *ngIf="hasHalf(avgRating)"></i>
            <i class="far fa-star" *ngFor="let s of getStarsEmpty(avgRating)"></i>
          </div>
          <div class="avg-count fs-12 text-grey">{{i18n.t('reviews.ratingCount', {n: busReviews.length})}}</div>
        </div>
        <div class="rating-bars">
          <div class="rbar-row" *ngFor="let n of [5,4,3,2,1]">
            <span class="rbar-label fs-12">{{n}} <i class="fa fa-star" style="color:#f4c430; font-size:10px;"></i></span>
            <div class="rbar-track">
              <div class="rbar-fill" [style.width]="getRatingPct(n)+'%'" [class]="'rbar-'+n"></div>
            </div>
            <span class="rbar-count fs-12 text-grey">{{getRatingCount(n)}}</span>
          </div>
        </div>
        <div class="review-action-col">
          <button class="rb-btn-primary write-btn" (click)="showForm=!showForm" *ngIf="canWrite && !showForm">
            <i class="fa fa-pen"></i> {{i18n.t('reviews.write')}}
          </button>
          <div class="cant-review" *ngIf="!canWrite">
            <i class="fa fa-info-circle text-grey"></i>
            <span class="fs-12 text-grey">{{i18n.t('reviews.alreadyReviewedRoute')}}</span>
          </div>
        </div>
      </div>

      <!-- Write review form -->
      <div class="write-review-form rb-card" *ngIf="showForm && canWrite">
        <div class="wrf-title"><i class="fa fa-pen-alt text-red"></i> {{i18n.t('reviews.yourReview')}}</div>
        <div class="wrf-body">
          <div class="unverified-notice" *ngIf="!isVerified">
            <i class="fa fa-shield-alt text-red"></i>
            {{i18n.t('reviews.verifiedOnlyNotice')}}
          </div>
          <div *ngIf="isVerified">
            <div class="star-picker">
              <span class="sp-label fs-13 text-grey">{{i18n.t('reviews.yourRating')}}</span>
              <div class="stars-interactive">
                <i class="fa fa-star sp-star" *ngFor="let n of [1,2,3,4,5]"
                   [class.active]="newRating >= n"
                   [class.hover]="hoverRating >= n"
                   (mouseenter)="hoverRating=n" (mouseleave)="hoverRating=0"
                   (click)="newRating=n"></i>
              </div>
              <span class="rating-label fs-13 fw-600" [style.color]="getRatingColor(newRating)">
                {{getRatingLabel(newRating)}}
              </span>
            </div>
            <div class="form-group">
              <label>{{i18n.t('reviews.reviewLabel')}} <span class="fs-11 text-grey">{{i18n.t('reviews.minCharsHint')}}</span></label>
              <textarea [(ngModel)]="newText" [placeholder]="i18n.t('reviews.placeholder')" class="review-textarea" rows="4" [class.invalid]="submitted && newText.length < 50"></textarea>
              <div class="char-feedback flex-between">
                <span class="fs-11" [class.text-red]="newText.length < 50" [class.text-green]="newText.length >= 50">
                  {{newText.length < 50 ? i18n.t('reviews.moreCharsNeeded', {n: 50 - newText.length}) : i18n.t('reviews.minimumMet')}}
                </span>
                <span class="fs-11 text-grey">{{newText.length}}/500</span>
              </div>
            </div>
            <div class="wrf-footer flex-between">
              <div class="moderation-note fs-12 text-grey">
                <i class="fa fa-shield-alt text-green"></i> {{i18n.t('reviews.moderationNote')}}
              </div>
              <div class="flex-center gap-10">
                <button class="rb-btn-outline" (click)="showForm=false; submitted=false;">{{i18n.t('common.cancel')}}</button>
                <button class="rb-btn-primary" (click)="submitReview()" [disabled]="!newRating || newText.length < 50">
                  <i class="fa fa-check"></i> {{i18n.t('reviews.submit')}}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Success toast -->
      <div class="success-toast" *ngIf="successMsg">
        <i class="fa fa-check-circle"></i> {{successMsg}}
      </div>

      <!-- Reviews list -->
      <div class="reviews-list">
        <div class="review-card" *ngFor="let review of busReviews; trackBy: trackReviewId" [class.editing]="editingId===review.id">
          <div class="rc-header flex-between">
            <div class="flex-center gap-10">
              <div class="reviewer-avatar" [style.background]="getAvatarColor(review.userAvatar)">
                {{review.userAvatar}}
              </div>
              <div>
                <div class="flex-center gap-6">
                  <span class="fw-700 fs-14" style="color:var(--text-primary);">{{review.userName}}</span>
                  <span class="verified-badge-sm" *ngIf="review.verified">
                    <i class="fa fa-check-circle"></i> {{i18n.t('reviews.verifiedBadge')}}
                  </span>
                  <span class="trusted-reviewer" *ngIf="rs.isTrustedReview(review)">
                    <i class="fa fa-star"></i> {{i18n.t('reviews.trustedReviewer')}}
                  </span>
                </div>
                <div class="fs-11 text-grey">{{i18n.t('reviews.travelledOn')}} {{review.journeyDate | date:'dd MMM yyyy'}}</div>
              </div>
            </div>
            <div>
              <div class="review-stars">
                <i class="fa fa-star" *ngFor="let s of getStarsFull(review.rating)" style="color:#f4c430;"></i>
                <i class="far fa-star" *ngFor="let s of getStarsEmpty(review.rating)" style="color:#ddd;"></i>
              </div>
              <div class="fs-11 text-grey" style="text-align:right;">{{timeAgo(review.createdAt)}}
                <span *ngIf="review.editedAt"> · {{i18n.t('reviews.edited')}}</span>
              </div>
            </div>
          </div>

          <!-- Edit mode -->
          <div class="edit-form" *ngIf="editingId===review.id">
            <div class="star-picker" style="margin-bottom:12px;">
              <div class="stars-interactive">
                <i class="fa fa-star sp-star" *ngFor="let n of [1,2,3,4,5]"
                   [class.active]="editRating >= n" (click)="editRating=n"></i>
              </div>
            </div>
            <textarea [(ngModel)]="editText" class="review-textarea" rows="3"></textarea>
            <div class="flex-center gap-8" style="margin-top:10px;">
              <button class="rb-btn-outline" style="padding:6px 14px; font-size:12px;" (click)="editingId=''">{{i18n.t('common.cancel')}}</button>
              <button class="rb-btn-primary" style="padding:6px 14px; font-size:12px;" (click)="saveEdit(review.id)">{{i18n.t('common.saveChanges')}}</button>
            </div>
          </div>

          <!-- Display mode -->
          <div class="rc-text" *ngIf="editingId!==review.id">{{review.text}}</div>

          <div class="rc-footer flex-between">
            <div class="helpful-row flex-center gap-8">
              <span class="fs-12 text-grey">{{i18n.t('reviews.helpfulQ')}}</span>
              <button class="helpful-btn" [class.voted]="review.helpful.includes('current_user')" (click)="rs.markHelpful(review.id, 'current_user')">
                <i class="fa fa-thumbs-up"></i> {{review.upvotes}}
              </button>
            </div>
            <div class="flex-center gap-8">
              <button class="edit-btn" *ngIf="review.userId===currentUser && canEditReview(review)" (click)="startEdit(review)">
                <i class="fa fa-pen"></i> {{i18n.t('common.edit')}}
              </button>
              <button class="report-btn-sm" (click)="rs.report(review.id)" [title]="i18n.t('reviews.reportTooltip')">
                <i class="fa fa-flag"></i> {{i18n.t('common.report')}}
              </button>
            </div>
          </div>
        </div>

        <div class="no-reviews" *ngIf="busReviews.length===0">
          <i class="fa fa-comment-slash fa-2x" style="color:#ddd;"></i>
          <p style="color:#888; margin-top:10px;">{{i18n.t('reviews.noReviews')}}</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reviews-section { padding:24px 0; }
    .reviews-header { display:grid; grid-template-columns:180px 1fr auto; gap:24px; align-items:center; margin-bottom:24px; padding:24px; background:var(--bg-card); border-radius:12px; border:1px solid var(--border); }
    .avg-rating-block { text-align:center; }
    .avg-num { font-size:48px; font-weight:900; color:var(--text-primary); line-height:1; }
    .avg-stars { color:#f4c430; font-size:18px; margin:6px 0 4px; display:flex; justify-content:center; gap:2px; }
    .rating-bars { display:flex; flex-direction:column; gap:6px; }
    .rbar-row { display:flex; align-items:center; gap:10px; }
    .rbar-label { width:28px; text-align:right; white-space:nowrap; color:var(--text-secondary); }
    .rbar-track { flex:1; height:8px; background:var(--border); border-radius:4px; overflow:hidden; }
    .rbar-fill { height:100%; border-radius:4px; transition:width 0.5s;
      &.rbar-5 { background:#4caf50; } &.rbar-4 { background:#8bc34a; } &.rbar-3 { background:#ffc107; } &.rbar-2 { background:#ff9800; } &.rbar-1 { background:#f44336; }
    }
    .rbar-count { width:24px; color:var(--text-secondary); }
    .write-btn { padding:10px 20px; white-space:nowrap; }
    .cant-review { display:flex; align-items:center; gap:6px; }
    .write-review-form { margin-bottom:24px; overflow:hidden; }
    .wrf-title { padding:14px 20px; font-size:14px; font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); background:var(--bg-card); display:flex; align-items:center; gap:8px; }
    .wrf-body { padding:20px; background:var(--bg-card); }
    .unverified-notice { background:#fff8e1; border-radius:8px; padding:14px; display:flex; align-items:center; gap:8px; font-size:13px; }
    .star-picker { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
    .stars-interactive { display:flex; gap:4px; }
    .sp-star { font-size:28px; color:#ddd; cursor:pointer; transition:color 0.1s;
      &.active, &.hover { color:#f4c430; }
    }
    .form-group { display:flex; flex-direction:column; gap:5px; margin-bottom:12px;
      label { font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; }
    }
    .review-textarea { width:100%; padding:12px; border:1.5px solid var(--border); border-radius:8px; font-size:13px; font-family:inherit; resize:vertical; outline:none; background:var(--bg-input); color:var(--text-primary); line-height:1.6; transition:border 0.2s;
      &:focus { border-color:#d84e55; }
      &.invalid { border-color:#f44336; }
    }
    .char-feedback { margin-top:4px; }
    .moderation-note { display:flex; align-items:center; gap:6px; }
    .wrf-footer { padding-top:8px; }
    .success-toast { background:#e8f5e9; border:1px solid #c8e6c9; color:#2e7d32; padding:12px 20px; border-radius:8px; margin-bottom:20px; display:flex; align-items:center; gap:8px; font-weight:600; animation:fadeIn 0.3s ease; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    .reviews-list { display:flex; flex-direction:column; gap:14px; }
    .review-card { background:var(--bg-card); border:1px solid var(--border); border-radius:10px; overflow:hidden; transition:box-shadow 0.2s;
      &:hover { box-shadow:0 2px 12px rgba(0,0,0,0.08); }
      &.editing { border-color:#d84e55; }
    }
    .rc-header { padding:16px 20px 10px; }
    .reviewer-avatar { width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:16px; font-weight:800; flex-shrink:0; }
    .verified-badge-sm { background:#e3f2fd; color:#1565c0; font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; display:flex; align-items:center; gap:3px; }
    .trusted-reviewer { background:#fff8e1; color:#f57c00; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; display:flex; align-items:center; gap:4px; border:1px solid #ffe082; }
    .review-stars { display:flex; gap:2px; justify-content:flex-end; }
    .rc-text { padding:4px 20px 16px; font-size:13.5px; color:var(--text-secondary); line-height:1.7; }
    .edit-form { padding:0 20px 16px; }
    .rc-footer { padding:10px 20px; border-top:1px solid var(--border); background:var(--bg-secondary); }
    .helpful-btn { display:flex; align-items:center; gap:6px; padding:5px 12px; border:1.5px solid var(--border); border-radius:20px; background:var(--bg-card); color:var(--text-secondary); font-size:12px; cursor:pointer; transition:all 0.2s;
      &:hover, &.voted { border-color:#1976d2; color:#1976d2; background:#e3f2fd; }
    }
    .edit-btn { padding:5px 12px; border:1.5px solid var(--border); border-radius:6px; background:none; color:var(--text-secondary); font-size:12px; cursor:pointer; display:flex; align-items:center; gap:5px; &:hover { border-color:#d84e55; color:#d84e55; } }
    .report-btn-sm { padding:5px 10px; border:none; background:none; color:#bbb; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; &:hover { color:#f44336; } }
    .no-reviews { text-align:center; padding:40px; }
  
    @media (max-width: 768px) {
      .reviews-header { grid-template-columns: 1fr !important; gap: 12px !important; }
      .avg-rating-block { display: flex !important; align-items: center; gap: 16px; }
      .avg-num { font-size: 36px !important; }
      .review-action-col { text-align: left; }
      .wrf-footer { flex-direction: column !important; gap: 10px !important; align-items: flex-start !important; }
      .rc-header { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
    }
  `]
})
export class ReviewsComponent implements OnInit {
  @Input() busId = '1';
  showForm = false;
  newRating = 0;
  hoverRating = 0;
  newText = '';
  submitted = false;
  successMsg = '';
  editingId = '';
  editText = '';
  editRating = 0;
  isVerified = false;
  bookingPnr = '';
  currentUser = 'current_user_id';
  canWrite = true;

  constructor(public rs: ReviewService, public i18n: I18nService) {}

  ngOnInit() {
    // Derive verified status from a real completed booking in localStorage
    const rawBookings = localStorage.getItem('rb_bookings') || '[]';
    try {
      const bookings: any[] = JSON.parse(rawBookings);
      const match = bookings.find((b: any) => b.busId === this.busId && b.status === 'confirmed');
      if (match) { this.isVerified = true; this.bookingPnr = match.pnr || ''; }
    } catch {}
    // Also check the last completed booking (single pending slot)
    const pending = localStorage.getItem('rb_last_booking');
    if (pending && !this.isVerified) {
      try {
        const b = JSON.parse(pending);
        if (b.busId === this.busId) { this.isVerified = true; this.bookingPnr = b.pnr || ''; }
      } catch {}
    }
    this.canWrite = this.rs.canReview(this.busId, this.currentUser);
    // Fetch latest reviews from backend
    this.rs.loadForBus(this.busId);
  }

  get busReviews() { return this.rs.getForBus(this.busId); }
  get avgRating() { return this.rs.getAvgRating(this.busId); }

  getStarsFull(n: number) { return Array(Math.floor(n)).fill(0); }
  getStarsEmpty(n: number) { return Array(5 - Math.ceil(n)).fill(0); }
  hasHalf(n: number) { return n % 1 >= 0.5; }
  getRatingCount(n: number) { return this.busReviews.filter(r => r.rating === n).length; }
  getRatingPct(n: number) { if (!this.busReviews.length) return 0; return (this.getRatingCount(n) / this.busReviews.length) * 100; }
  getAvatarColor(l: string) { const c=['#d84e55','#1976d2','#4caf50','#ff9800','#9c27b0']; return c[l.charCodeAt(0)%c.length]; }
  timeAgo(d: Date) { const m=Math.floor((Date.now()-new Date(d).getTime())/60000); if(m<60)return m+'m ago'; const h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'; }
  getRatingLabel(n: number) { const keys = ['', 'reviews.rating1', 'reviews.rating2', 'reviews.rating3', 'reviews.rating4', 'reviews.rating5']; return keys[n] ? this.i18n.t(keys[n]) : ''; }
  getRatingColor(n: number) { return ['','#f44336','#ff9800','#ffc107','#8bc34a','#4caf50'][n] || '#888'; }
  canEditReview(r: Review) { return (Date.now() - new Date(r.createdAt).getTime()) < 86400000; }

  submitReview() {
    this.submitted = true;
    if (!this.newRating || this.newText.length < 50) return;
    this.rs.addReview({
      busId: this.busId, userId: this.currentUser, userName: 'You', userAvatar: 'Y',
      bookingPnr: this.bookingPnr,
      rating: this.newRating, text: this.newText, createdAt: new Date(),
      journeyDate: new Date().toISOString().split('T')[0], verified: this.isVerified
    });
    this.showForm = false;
    this.newRating = 0;
    this.newText = '';
    this.submitted = false;
    this.canWrite = false;
    this.successMsg = this.i18n.t('reviews.submittedNotice');
    setTimeout(() => this.successMsg = '', 4000);
  }

  startEdit(r: Review) { this.editingId = r.id; this.editText = r.text; this.editRating = r.rating; }
  saveEdit(id: string) {
    const ok = this.rs.editReview(id, this.editText, this.editRating);
    if (!ok) alert(this.i18n.t('reviews.editWindowPassed'));
    this.editingId = '';
  }
  trackReviewId(index: number, r: any): string { return r.id; }
}
