import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CommunityService } from '../../services/community.service';
import { ReviewService } from '../../services/review.service';
import { I18nService } from '../../services/i18n.service';

/**
 * Minimal "My Activity" profile view.
 * Satisfies: "User activity, including posts and interactions, should be visible on profiles."
 * This demo app has no server-backed auth/session, so — consistent with how the rest of the
 * app identifies the current user (community.component.ts, reviews.component.ts) — activity is
 * scoped to the local 'current_user' / 'You' identity used across the client.
 */
@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="profile-page">
      <div class="profile-hero">
        <div class="container flex-center gap-16">
          <div class="profile-avatar">Y</div>
          <div>
            <h1>{{i18n.t('profile.you')}}</h1>
            <p>{{i18n.t('profile.summary', {posts: myPosts.length, comments: myComments.length, reviews: myReviews.length})}}</p>
          </div>
        </div>
      </div>

      <div class="container profile-body" style="padding:28px 16px 64px;">
        <div class="rb-card section">
          <div class="section-title"><i class="fa fa-pen text-red"></i> {{i18n.t('profile.myPosts')}}</div>
          <div class="empty-row" *ngIf="myPosts.length===0">{{i18n.t('profile.noPosts')}} <a routerLink="/community">{{i18n.t('profile.shareFirst')}} →</a></div>
          <div class="activity-row" *ngFor="let p of myPosts">
            <div class="activity-icon"><i class="fa fa-file-alt"></i></div>
            <div class="activity-body">
              <div class="activity-title">{{p.title}}</div>
              <div class="activity-meta fs-12 text-grey">{{i18n.t('profile.postMeta', {likes: p.likes.length, comments: p.comments.length})}} · {{timeAgo(p.createdAt)}}</div>
            </div>
            <a class="view-link" [routerLink]="['/community']" [queryParams]="{post: p.id}">{{i18n.t('profile.view')}} →</a>
          </div>
        </div>

        <div class="rb-card section">
          <div class="section-title"><i class="fa fa-comment text-red"></i> {{i18n.t('profile.myComments')}}</div>
          <div class="empty-row" *ngIf="myComments.length===0">{{i18n.t('profile.noComments')}}</div>
          <div class="activity-row" *ngFor="let c of myComments">
            <div class="activity-icon"><i class="fa fa-comment-dots"></i></div>
            <div class="activity-body">
              <div class="activity-title">"{{c.comment.text}}"</div>
              <div class="activity-meta fs-12 text-grey">{{i18n.t('profile.onPost')}} {{c.postTitle}} · {{timeAgo(c.comment.createdAt)}}</div>
            </div>
            <a class="view-link" [routerLink]="['/community']" [queryParams]="{post: c.postId}">{{i18n.t('profile.view')}} →</a>
          </div>
        </div>

        <div class="rb-card section">
          <div class="section-title"><i class="fa fa-star text-red"></i> {{i18n.t('profile.myReviews')}}</div>
          <div class="empty-row" *ngIf="myReviews.length===0">{{i18n.t('profile.noReviews')}}</div>
          <div class="activity-row" *ngFor="let r of myReviews">
            <div class="activity-icon"><i class="fa fa-star" style="color:#f4c430;"></i></div>
            <div class="activity-body">
              <div class="activity-title">{{r.rating}}/5 — "{{r.text.length > 90 ? (r.text | slice:0:90)+'…' : r.text}}"</div>
              <div class="activity-meta fs-12 text-grey">{{i18n.t('profile.helpfulVotes', {n: r.upvotes})}} · {{timeAgo(r.createdAt)}}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { min-height:100vh; background:var(--bg-secondary); }
    .profile-hero { background:linear-gradient(135deg,#1a237e 0%,#d84e55 100%); padding:36px 0; color:white; }
    .profile-avatar { width:64px; height:64px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:800; border:2px solid rgba(255,255,255,0.5); }
    .profile-hero h1 { font-size:24px; font-weight:800; }
    .profile-hero p { color:rgba(255,255,255,0.85); font-size:13px; margin-top:4px; }
    .profile-body { display:flex; flex-direction:column; gap:16px; max-width:760px; margin:0 auto; }
    .section { padding:0; overflow:hidden; background:var(--bg-card); }
    .section-title { padding:14px 18px; font-size:14px; font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
    .empty-row { padding:20px 18px; font-size:13px; color:var(--text-secondary); a { color:#d84e55; font-weight:600; } }
    .activity-row { display:flex; align-items:center; gap:12px; padding:12px 18px; border-bottom:1px solid var(--border); &:last-child { border-bottom:none; } }
    .activity-icon { width:34px; height:34px; border-radius:50%; background:var(--bg-hover); display:flex; align-items:center; justify-content:center; color:#d84e55; flex-shrink:0; }
    .activity-body { flex:1; min-width:0; }
    .activity-title { font-size:13.5px; font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .view-link { font-size:12px; color:#1976d2; font-weight:600; text-decoration:none; flex-shrink:0; }
  `]
})
export class ProfileComponent {
  i18n = inject(I18nService);
  currentUser = 'current_user';

  constructor(public cs: CommunityService, public rs: ReviewService) {}

  get myPosts() {
    return this.cs.posts().filter(p => p.userId === this.currentUser);
  }

  get myComments() {
    const out: { postId: string; postTitle: string; comment: any }[] = [];
    for (const p of this.cs.posts()) {
      for (const c of p.comments) {
        if (c.userId === this.currentUser) out.push({ postId: p.id, postTitle: p.title, comment: c });
      }
    }
    return out.sort((a, b) => new Date(b.comment.createdAt).getTime() - new Date(a.comment.createdAt).getTime());
  }

  get myReviews() {
    return this.rs.reviews().filter(r => r.userId === 'current_user_id');
  }

  timeAgo(date: Date) {
    const d = Date.now() - new Date(date).getTime();
    const m = Math.floor(d / 60000);
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  }
}
