import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { CommunityService, Post } from '../../services/community.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-community',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="community-page">
      <!-- Hero -->
      <div class="comm-hero">
        <div class="container">
          <div class="hero-inner flex-between">
            <div>
              <h1><i class="fa fa-users"></i> {{i18n.t('community.heroTitle')}}</h1>
              <p>{{i18n.t('community.heroSubtitle')}}</p>
              <div class="comm-stats flex-center gap-24" style="margin-top:16px;">
                <div class="cs-item"><span class="cs-num">2.3M</span><span class="cs-lbl">{{i18n.t('community.membersLabel')}}</span></div>
                <div class="cs-item"><span class="cs-num">48K</span><span class="cs-lbl">{{i18n.t('community.storiesLabel')}}</span></div>
                <div class="cs-item"><span class="cs-num">180K</span><span class="cs-lbl">{{i18n.t('community.tipsSharedLabel')}}</span></div>
              </div>
            </div>
            <button class="create-btn" (click)="showCreate=!showCreate" *ngIf="!showCreate">
              <i class="fa fa-plus"></i> {{i18n.t('community.shareStory')}}
            </button>
          </div>
        </div>
      </div>

      <div class="container community-layout" style="padding:28px 16px 64px;">
        <!-- My Activity quick link -->
        <div class="my-activity-banner rb-card flex-between">
          <span><i class="fa fa-user-circle text-red"></i> {{i18n.t('community.myActivityPrompt')}}</span>
          <a routerLink="/profile" class="rb-btn-outline" style="padding:6px 14px; font-size:12px; text-decoration:none;">{{i18n.t('community.myActivityLink')}} →</a>
        </div>
        <!-- Create post panel -->
        <div class="create-post-panel rb-card" *ngIf="showCreate">
          <div class="cp-header flex-between">
            <div class="fw-700 fs-15"><i class="fa fa-pen text-red"></i> {{i18n.t('community.createPost')}}</div>
            <button class="close-btn" (click)="showCreate=false"><i class="fa fa-times"></i></button>
          </div>
          <div class="cp-body">
            <div class="verified-notice" *ngIf="!isVerified">
              <i class="fa fa-lock text-red"></i>
              <span>{{i18n.t('community.verifiedOnlyPost')}} <a href="#" class="text-red">{{i18n.t('community.verifyAccount')}} →</a></span>
            </div>
            <div *ngIf="isVerified">
              <div class="form-row-2">
                <div class="form-group">
                  <label>{{i18n.t('community.postTitle')}}</label>
                  <input type="text" [(ngModel)]="newPost.title" [placeholder]="i18n.t('community.postTitlePlaceholder')" class="rb-input" maxlength="100">
                  <div class="char-count fs-11 text-grey">{{newPost.title.length}}/100</div>
                </div>
                <div class="form-group">
                  <label>{{i18n.t('community.categoryLabel')}}</label>
                  <select [(ngModel)]="newPost.category" class="rb-input">
                    <option value="story">{{i18n.t('community.catStory')}}</option>
                    <option value="tip">{{i18n.t('community.catTip')}}</option>
                    <option value="question">{{i18n.t('community.catQuestion')}}</option>
                    <option value="photo">{{i18n.t('community.catPhoto')}}</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label>{{i18n.t('community.contentLabel')}}</label>
                <textarea [(ngModel)]="newPost.content" [placeholder]="i18n.t('community.contentPlaceholder')" class="rb-textarea" rows="5"></textarea>
              </div>
              <div class="form-group">
                <label>{{i18n.t('community.photosLabel')}}</label>
                <input type="file" accept="image/*" multiple #photoInput (change)="onPhotosSelected($event)" class="rb-input" [disabled]="newPostImages.length>=4">
                <div class="fs-11 text-grey" style="margin-top:4px;">{{i18n.t('community.photosHint')}}</div>
                <div class="photo-preview-row" *ngIf="newPostImages.length">
                  <div class="photo-preview" *ngFor="let img of newPostImages; let i=index">
                    <img [src]="img" [alt]="'photo '+(i+1)">
                    <button type="button" class="photo-remove-btn" (click)="removePhoto(i)"><i class="fa fa-times"></i></button>
                  </div>
                </div>
                <div class="fs-11 text-red" *ngIf="photoError">{{photoError}}</div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label>{{i18n.t('community.routeLabel')}}</label>
                  <input type="text" [(ngModel)]="newPost.route" [placeholder]="i18n.t('community.routePlaceholder')" class="rb-input">
                </div>
                <div class="form-group">
                  <label>{{i18n.t('community.tagsLabel')}}</label>
                  <input type="text" [(ngModel)]="tagsInput" [placeholder]="i18n.t('community.tagsPlaceholder')" class="rb-input">
                </div>
              </div>
              <div class="cp-footer flex-between">
                <div class="moderation-note fs-12 text-grey"><i class="fa fa-shield-alt text-green"></i> {{i18n.t('community.moderationNote')}}</div>
                <div class="flex-center gap-10">
                  <button class="rb-btn-outline" (click)="showCreate=false">{{i18n.t('common.cancel')}}</button>
                  <button class="rb-btn-primary" (click)="submitPost()" [disabled]="!newPost.title||!newPost.content">
                    <i class="fa fa-paper-plane"></i> {{i18n.t('community.publishPost')}}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="comm-main-layout">
          <!-- Feed -->
          <div class="feed-col">
            <!-- Filter chips -->
            <div class="filter-row flex-center gap-8" style="margin-bottom:20px; flex-wrap:wrap;">
              <span class="cat-chip" [class.active]="activeCategory==='all'" (click)="activeCategory='all'">🌟 {{i18n.t('community.filterAll')}}</span>
              <span class="cat-chip" [class.active]="activeCategory==='story'" (click)="activeCategory='story'">📖 {{i18n.t('community.filterStories')}}</span>
              <span class="cat-chip" [class.active]="activeCategory==='tip'" (click)="activeCategory='tip'">💡 {{i18n.t('community.filterTips')}}</span>
              <span class="cat-chip" [class.active]="activeCategory==='question'" (click)="activeCategory='question'">🤔 {{i18n.t('community.filterQuestions')}}</span>
              <span class="cat-chip" [class.active]="activeCategory==='photo'" (click)="activeCategory='photo'">📷 {{i18n.t('community.filterPhotos')}}</span>
            </div>

            <div class="post-card rb-card" *ngFor="let post of filteredPosts; trackBy: trackPostId" [id]="'post-'+post.id" [class.pinned-post]="post.pinned" [class.highlighted-post]="post.id===highlightedPostId">
              <!-- Pinned badge -->
              <div class="pin-banner" *ngIf="post.pinned">
                <i class="fa fa-thumbtack"></i> {{i18n.t('community.pinnedPost')}}
              </div>
              <div class="post-header flex-between">
                <div class="flex-center gap-10">
                  <div class="user-avatar-lg" [style.background]="getAvatarColor(post.userAvatar)">{{post.userAvatar}}</div>
                  <div>
                    <div class="flex-center gap-6">
                      <span class="fw-700 fs-14" style="color:var(--text-primary);">{{post.userName}}</span>
                      <span class="verified-badge" *ngIf="post.verified"><i class="fa fa-check-circle"></i> {{i18n.t('community.verifiedBadge')}}</span>
                      <span class="trusted-badge" *ngIf="post.isTrusted"><i class="fa fa-star"></i> {{i18n.t('community.trustedBadge')}}</span>
                    </div>
                    <div class="fs-12 text-grey">{{timeAgo(post.createdAt)}} <span *ngIf="post.route">· 🚌 {{post.route}}</span></div>
                  </div>
                </div>
                <div class="cat-label" [class]="post.category">
                  {{getCatLabel(post.category)}}
                </div>
              </div>
              <div class="post-body">
                <h3 class="post-title">{{post.title}}</h3>
                <div class="post-content" [class.expanded]="expandedPosts.includes(post.id)">{{post.content}}</div>
                <button class="read-more-btn" *ngIf="post.content.length>200" (click)="toggleExpand(post.id)">
                  {{expandedPosts.includes(post.id) ? i18n.t('community.showLess') : i18n.t('community.readMore')}}
                </button>
                <div class="post-photos" *ngIf="post.images?.length">
                  <img *ngFor="let img of post.images" [src]="img" class="post-photo" [alt]="post.title">
                </div>
                <div class="post-tags" *ngIf="post.tags.length">
                  <span class="tag-chip" *ngFor="let tag of post.tags">#{{tag}}</span>
                </div>
              </div>
              <div class="post-footer">
                <div class="post-actions">
                  <button class="action-icon" [class.liked]="post.likes.includes(currentUser)" (click)="likePost(post.id)">
                    <i [class]="post.likes.includes(currentUser) ? 'fa fa-heart' : 'far fa-heart'"></i>
                    <span>{{post.likes.length}}</span>
                  </button>
                  <button class="action-icon" (click)="toggleComments(post.id)">
                    <i class="far fa-comment-alt"></i>
                    <span>{{post.comments.length}}</span>
                  </button>
                  <button class="action-icon" (click)="sharePost(post)">
                    <i class="fa fa-share-alt"></i>
                    <span>{{i18n.t('community.shareAction')}}</span>
                  </button>
                </div>
                <button class="report-btn" (click)="reportPost(post.id)">
                  <i class="fa fa-flag"></i>
                </button>
              </div>

              <!-- Comments -->
              <div class="comments-section" *ngIf="openComments.includes(post.id)">
                <div class="comment-item" *ngFor="let c of post.comments; trackBy: trackByIndex">
                  <div class="comment-avatar" [style.background]="getAvatarColor(c.userAvatar)">{{c.userAvatar}}</div>
                  <div class="comment-body">
                    <div class="comment-name fw-600 fs-13">{{c.userName}}</div>
                    <div class="comment-text fs-13">{{c.text}}</div>
                    <div class="flex-center gap-8 fs-11 text-grey">
                      <span>{{timeAgo(c.createdAt)}}</span>
                      <button class="action-icon sm" [class.liked]="c.likes.includes(currentUser)" (click)="cs.toggleCommentLike(post.id, c.id, currentUser)">
                        <i class="fa fa-heart"></i> {{c.likes.length}}
                      </button>
                    </div>
                  </div>
                </div>
                <div class="add-comment flex-center gap-8">
                  <div class="comment-avatar-sm">Y</div>
                  <input type="text" [(ngModel)]="commentInputs[post.id]" [placeholder]="i18n.t('community.commentPlaceholder')" class="comment-input" (keyup.enter)="addComment(post.id)">
                  <button class="send-comment" (click)="addComment(post.id)" [disabled]="!commentInputs[post.id]?.trim()">
                    <i class="fa fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar -->
          <div class="sidebar-col">
            <!-- Forums -->
            <div class="rb-card sidebar-section">
              <div class="ss-title"><i class="fa fa-comments text-red"></i> {{i18n.t('community.discussionForums')}}</div>
              <div class="forum-item" *ngFor="let f of cs.forums">
                <div class="forum-icon" [style.background]="f.color+'22'" [style.color]="f.color">
                  <i [class]="'fa '+f.icon"></i>
                </div>
                <div class="forum-info">
                  <div class="fw-600 fs-13" style="color:var(--text-primary);">{{f.name}}</div>
                  <div class="fs-11 text-grey">{{f.posts}} {{i18n.t('community.discussionsSuffix')}}</div>
                </div>
                <i class="fa fa-chevron-right" style="color:#bbb;"></i>
              </div>
            </div>

            <!-- Trending tags -->
            <div class="rb-card sidebar-section" style="margin-top:16px;">
              <div class="ss-title"><i class="fa fa-fire text-red"></i> {{i18n.t('community.trendingTags')}}</div>
              <div class="trending-tags">
                <span class="trend-tag" *ngFor="let tag of cs.trendingTags()">#{{tag}}</span>
              </div>
            </div>

            <!-- Top contributors -->
            <div class="rb-card sidebar-section" style="margin-top:16px;">
              <div class="ss-title"><i class="fa fa-trophy" style="color:#f4c430;"></i> {{i18n.t('community.topContributors')}}</div>
              <div class="contributor-item" *ngFor="let c of topContributors; let i=index">
                <div class="rank-badge" [class]="'rank-'+i">{{i+1}}</div>
                <div class="contrib-avatar" [style.background]="getAvatarColor(c.avatar)">{{c.avatar}}</div>
                <div class="contrib-info">
                  <div class="fw-600 fs-13" style="color:var(--text-primary);">{{c.name}}</div>
                  <div class="fs-11 text-grey">{{i18n.t('community.postsLikesSuffix', {posts: c.posts, likes: c.likes})}}</div>
                </div>
                <span class="trusted-badge sm" *ngIf="c.trusted"><i class="fa fa-star"></i></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .community-page { min-height:100vh; background:var(--bg-secondary); }
    .comm-hero { background:linear-gradient(135deg,#1a237e 0%,#d84e55 100%); padding:40px 0 32px; color:white;
      h1 { font-size:28px; font-weight:800; display:flex; align-items:center; gap:12px; margin-bottom:6px; }
      p { color:rgba(255,255,255,0.8); }
    }
    .comm-stats { }
    .cs-item { text-align:center; }
    .cs-num { display:block; font-size:20px; font-weight:800; }
    .cs-lbl { font-size:12px; color:rgba(255,255,255,0.75); }
    .create-btn { padding:12px 24px; background:white; color:#d84e55; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.2s;
      &:hover { transform:translateY(-2px); box-shadow:0 4px 16px rgba(0,0,0,0.2); }
    }
    .create-post-panel { margin-bottom:20px; overflow:hidden; }
    .my-activity-banner { padding:12px 18px; margin-bottom:16px; font-size:13px; color:var(--text-secondary); background:var(--bg-card); }
    .cp-header { padding:16px 20px; border-bottom:1px solid var(--border); background:var(--bg-card); }
    .close-btn { background:none; border:none; cursor:pointer; font-size:16px; color:var(--text-secondary);
      &:hover { color:#d84e55; }
    }
    .cp-body { padding:20px; background:var(--bg-card); }
    .verified-notice { background:#fff8e1; border:1px solid #ffe082; border-radius:8px; padding:14px 16px; display:flex; align-items:center; gap:10px; font-size:13px; color:#555; a { font-weight:600; } }
    .form-row-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:14px; }
    .form-group { display:flex; flex-direction:column; gap:5px; margin-bottom:14px;
      label { font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; }
    }
    .char-count { text-align:right; margin-top:3px; }
    .rb-input { padding:10px 12px; border:1.5px solid var(--border); border-radius:6px; font-size:13px; background:var(--bg-input); color:var(--text-primary); outline:none; font-family:inherit; transition:border 0.2s; width:100%;
      &:focus { border-color:#d84e55; }
    }
    .rb-textarea { padding:10px 12px; border:1.5px solid var(--border); border-radius:6px; font-size:13px; background:var(--bg-input); color:var(--text-primary); outline:none; font-family:inherit; resize:vertical; width:100%; line-height:1.6;
      &:focus { border-color:#d84e55; }
    }
    .moderation-note { display:flex; align-items:center; gap:6px; }
    .cp-footer { padding-top:8px; }
    .comm-main-layout { display:grid; grid-template-columns:1fr 300px; gap:20px; }
    .cat-chip { padding:7px 14px; border-radius:20px; font-size:13px; font-weight:500; cursor:pointer; border:1.5px solid var(--border); background:var(--bg-card); color:var(--text-secondary); transition:all 0.2s;
      &.active, &:hover { background:#d84e55; color:white; border-color:#d84e55; }
    }
    .post-card { margin-bottom:16px; overflow:hidden; transition:box-shadow 0.2s; background:var(--bg-card);
      &:hover { box-shadow:0 4px 20px rgba(0,0,0,0.1); }
    }
    .pinned-post { border-top:3px solid #f47c20; }
    .highlighted-post { animation: highlight-pulse 2.2s ease-out 1; }
    @keyframes highlight-pulse {
      0% { box-shadow: 0 0 0 3px #d84e55; }
      100% { box-shadow: 0 0 0 0 rgba(216,78,85,0); }
    }
    .pin-banner { background:#fff8e1; padding:6px 16px; font-size:12px; font-weight:600; color:#f57c00; display:flex; align-items:center; gap:6px; }
    .post-header { padding:16px 20px 12px; }
    .user-avatar-lg { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:18px; font-weight:800; flex-shrink:0; }
    .verified-badge { background:#e3f2fd; color:#1565c0; font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; display:flex; align-items:center; gap:3px; }
    .trusted-badge { background:#fff8e1; color:#f57c00; font-size:10px; font-weight:700; padding:2px 7px; border-radius:10px; display:flex; align-items:center; gap:3px;
      &.sm { padding:2px 6px; font-size:9px; }
    }
    .cat-label { font-size:11px; font-weight:700; padding:4px 10px; border-radius:20px;
      &.story { background:#e8f5e9; color:#2e7d32; }
      &.tip { background:#e3f2fd; color:#1565c0; }
      &.question { background:#fff3e0; color:#e65100; }
      &.photo { background:#fce4ec; color:#880e4f; }
    }
    .post-body { padding:0 20px 14px; }
    .post-title { font-size:16px; font-weight:700; color:var(--text-primary); margin-bottom:10px; line-height:1.4; }
    .post-content { font-size:13.5px; color:var(--text-secondary); line-height:1.7; max-height:100px; overflow:hidden; white-space:pre-line;
      &.expanded { max-height:none; }
    }
    .read-more-btn { background:none; border:none; color:#d84e55; font-size:12px; font-weight:600; cursor:pointer; padding:4px 0; }
    .post-tags { margin-top:10px; display:flex; gap:6px; flex-wrap:wrap; }
    .post-photos { margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; }
    .post-photo { width:140px; height:140px; object-fit:cover; border-radius:10px; border:1px solid var(--border); }
    .photo-preview-row { margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; }
    .photo-preview { position:relative; width:72px; height:72px; }
    .photo-preview img { width:100%; height:100%; object-fit:cover; border-radius:8px; border:1px solid var(--border); }
    .photo-remove-btn { position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; background:var(--red); color:#fff; border:none; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .tag-chip { font-size:12px; color:#1976d2; background:#e3f2fd; padding:3px 8px; border-radius:10px; }
    .post-footer { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-top:1px solid var(--border); }
    .post-actions { display:flex; gap:4px; }
    .action-icon { display:flex; align-items:center; gap:6px; padding:7px 12px; border:none; background:none; color:var(--text-secondary); cursor:pointer; border-radius:6px; font-size:13px; transition:all 0.2s;
      &:hover { background:var(--bg-hover); color:#1976d2; }
      &.liked { color:#e91e63; i { color:#e91e63; } }
    }
    .report-btn { background:none; border:none; color:#bbb; cursor:pointer; font-size:12px; padding:6px; border-radius:4px; &:hover { color:#f44336; } }
    .comments-section { border-top:1px solid var(--border); padding:12px 20px; background:var(--bg-secondary); }
    .comment-item { display:flex; gap:10px; margin-bottom:12px; }
    .comment-avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:13px; font-weight:700; flex-shrink:0; }
    .comment-body { background:var(--bg-card); border-radius:10px; padding:8px 12px; flex:1; }
    .add-comment { margin-top:8px; }
    .comment-avatar-sm { width:28px; height:28px; border-radius:50%; background:#d84e55; display:flex; align-items:center; justify-content:center; color:white; font-size:11px; font-weight:700; flex-shrink:0; }
    .comment-input { flex:1; padding:8px 12px; border:1.5px solid var(--border); border-radius:20px; font-size:13px; background:var(--bg-input); color:var(--text-primary); outline:none;
      &:focus { border-color:#d84e55; }
    }
    .send-comment { width:34px; height:34px; border-radius:50%; background:#d84e55; border:none; color:white; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0;
      &:disabled { background:#ddd; cursor:not-allowed; }
    }
    .sidebar-section { padding:0; overflow:hidden; background:var(--bg-card); }
    .ss-title { padding:14px 16px; font-size:13px; font-weight:700; color:var(--text-primary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px; }
    .forum-item { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.15s;
      &:last-child { border-bottom:none; }
      &:hover { background:var(--bg-hover); }
    }
    .forum-icon { width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
    .forum-info { flex:1; }
    .trending-tags { padding:14px 16px; display:flex; gap:8px; flex-wrap:wrap; }
    .trend-tag { font-size:12px; color:#d84e55; background:#fff0f1; padding:4px 10px; border-radius:20px; cursor:pointer; font-weight:500; border:1px solid #f5c6c8; &:hover { background:#d84e55; color:white; } }
    .contributor-item { display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid var(--border); &:last-child { border-bottom:none; } }
    .rank-badge { width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800; flex-shrink:0;
      &.rank-0 { background:#ffd700; color:#333; }
      &.rank-1 { background:#c0c0c0; color:#333; }
      &.rank-2 { background:#cd7f32; color:white; }
    }
    .contrib-avatar { width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:white; font-size:14px; font-weight:700; flex-shrink:0; }
    .contrib-info { flex:1; }
  
    @media (max-width: 900px) {
      .comm-main-layout { grid-template-columns: 1fr 240px !important; }
    }
    @media (max-width: 768px) {
      .comm-main-layout { grid-template-columns: 1fr !important; }
      .sidebar-col { display: none !important; }
      .form-row-2 { grid-template-columns: 1fr !important; }
      .hero-inner { flex-direction: column !important; gap: 16px !important; }
      .create-btn { width: 100%; justify-content: center; }
      .filter-chips { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; }
      .cat-chip { white-space: nowrap; flex-shrink: 0; }
      .post-card { margin-bottom: 12px; }
    }
  `]
})
export class CommunityComponent implements OnInit {
  activeCategory = 'all';
  showCreate = false;
  isVerified = false;
  verifiedPnr = ''; // the actual PNR that proves verification — sent to the server, not just a boolean

  // Was hardcoded to the literal 'current_user' — never matched the real authenticated
  // account id the server assigns (auth.service.ts's AuthUser._id), so like/comment-like
  // highlighting and "is this mine" checks never matched a real user's own activity.
  get currentUser(): string { return this.auth.user()?._id || ''; }

  expandedPosts: string[] = [];
  openComments: string[] = [];
  commentInputs: Record<string, string> = {};
  tagsInput = '';

  newPost = { title: '', content: '', category: 'story', route: '' };
  // Req 1 fix: "photo" was a category label with no actual way to attach an image — the
  // Post model had an unused `images?: string[]` field and nothing populated it. Photos are
  // read client-side as base64 data URLs (max 4, 2MB each) and sent to the server as part
  // of the post payload; see CommunityService.addPost and POST /community/posts.
  newPostImages: string[] = [];
  photoError = '';
  private static readonly MAX_PHOTOS = 4;
  private static readonly MAX_PHOTO_BYTES = 2 * 1024 * 1024;

  // Finding #10: trendingTags used to be this permanently-hardcoded array. Real tags,
  // computed live from actual post activity, now come from cs.trendingTags() (see template).
  topContributors = [
    { name:'Arjun Sharma', avatar:'A', posts:47, likes:312, trusted:true },
    { name:'Priya Nair', avatar:'P', posts:38, likes:241, trusted:true },
    { name:'Rahul Verma', avatar:'R', posts:29, likes:178, trusted:false },
    { name:'Sneha Patel', avatar:'S', posts:22, likes:156, trusted:true },
    { name:'Vikram Singh', avatar:'V', posts:18, likes:89, trusted:false },
  ];

  constructor(public cs: CommunityService, private toast: ToastService, private route: ActivatedRoute, public i18n: I18nService, private auth: AuthService) {}
  highlightedPostId = '';
  ngOnInit() {
    // Verified = has at least one confirmed booking in localStorage
    try {
      const bookings: any[] = JSON.parse(localStorage.getItem('rb_bookings') || '[]');
      const confirmed = bookings.find((b: any) => b.status === 'confirmed' && b.pnr);
      if (confirmed) { this.isVerified = true; this.verifiedPnr = confirmed.pnr; }
    } catch {}
    if (!this.isVerified) {
      try {
        const b = JSON.parse(localStorage.getItem('rb_last_booking') || 'null');
        if (b?.pnr) { this.isVerified = true; this.verifiedPnr = b.pnr; }
      } catch {}
    }
    // Fetch posts from backend; falls back to seed data if server is down
    this.cs.loadPosts(this.activeCategory);
    // Finding #11: forums used to be a static array the frontend never refreshed —
    // this now loads the server's live, real per-category counts.
    this.cs.loadForums();

    // Deep-link support: /community?post=p1 (used by the Share button) — open, scroll to, and highlight that post
    const postId = this.route.snapshot.queryParamMap.get('post');
    if (postId) {
      this.activeCategory = 'all';
      this.highlightedPostId = postId;
      this.openComments.push(postId);
      setTimeout(() => {
        document.getElementById('post-' + postId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      setTimeout(() => { this.highlightedPostId = ''; }, 3000);
    }
  }

  get filteredPosts() { return this.cs.getByCategory(this.activeCategory); }
  getCatLabel(cat: string) {
    const keys: Record<string, string> = { story: 'community.catLabelStory', tip: 'community.catLabelTip', question: 'community.catLabelQuestion', photo: 'community.catLabelPhoto', review: 'community.catLabelReview' };
    return keys[cat] ? this.i18n.t(keys[cat]) : cat;
  }
  getAvatarColor(letter: string) { const colors = ['#d84e55','#1976d2','#4caf50','#ff9800','#9c27b0','#00bcd4','#f44336','#3f51b5']; return colors[letter.charCodeAt(0) % colors.length]; }
  toggleExpand(id: string) { this.expandedPosts.includes(id) ? this.expandedPosts = this.expandedPosts.filter(i=>i!==id) : this.expandedPosts.push(id); }
  toggleComments(id: string) { this.openComments.includes(id) ? this.openComments = this.openComments.filter(i=>i!==id) : this.openComments.push(id); }
  timeAgo(date: Date) { const d = Date.now()-new Date(date).getTime(); const m=Math.floor(d/60000); if(m<60)return m+'m ago'; const h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'; }

  likePost(postId: string) {
    this.cs.toggleLike(postId, this.currentUser);
    if (this.cs.lastError()) this.toast.error(this.cs.lastError()!);
  }

  reportPost(postId: string) {
    this.cs.report(postId);
    if (this.cs.lastError()) this.toast.error(this.cs.lastError()!);
    else this.toast.info(this.i18n.t('community.reportedNotice'));
  }

  addComment(postId: string) {
    const text = this.commentInputs[postId]?.trim();
    if (!text) return;
    // Finding #8: comments now require the same journey-verification PNR as posts.
    const result = this.cs.addComment(postId, { userId: this.currentUser, userName:'You', userAvatar:'Y', text }, this.verifiedPnr);
    if (result) {
      this.commentInputs[postId] = '';
    } else if (this.cs.lastError()) {
      this.toast.error(this.cs.lastError()!);
    }
  }

  onPhotosSelected(event: Event) {
    this.photoError = '';
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = ''; // allow re-selecting the same file after removal

    const room = CommunityComponent.MAX_PHOTOS - this.newPostImages.length;
    if (files.length > room) {
      this.photoError = this.i18n.t('community.photosMaxError', { n: CommunityComponent.MAX_PHOTOS });
    }
    files.slice(0, room).forEach(file => {
      if (!file.type.startsWith('image/')) {
        this.photoError = this.i18n.t('community.photosTypeError');
        return;
      }
      if (file.size > CommunityComponent.MAX_PHOTO_BYTES) {
        this.photoError = this.i18n.t('community.photosSizeError');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') this.newPostImages.push(reader.result); };
      reader.readAsDataURL(file);
    });
  }

  removePhoto(i: number) {
    this.newPostImages.splice(i, 1);
    this.photoError = '';
  }

  submitPost() {
    if (!this.newPost.title.trim() || !this.newPost.content.trim()) return;
    const tags = this.tagsInput.split(',').map(t=>t.trim()).filter(Boolean);
    const result = this.cs.addPost({ ...this.newPost, category: this.newPost.category as any, userId:this.currentUser, userName:'You', userAvatar:'Y', verified:true, tags, images: this.newPostImages, createdAt:new Date() }, this.verifiedPnr);
    if (result) {
      this.newPost = { title:'', content:'', category:'story', route:'' };
      this.tagsInput = '';
      this.newPostImages = [];
      this.photoError = '';
      this.showCreate = false;
    } else if (this.cs.lastError()) {
      this.toast.error(this.cs.lastError()!);
    }
  }

  async sharePost(post: Post) {
    const url = `${window.location.origin}/community?post=${post.id}`;
    const shareData: ShareData = { title: post.title, text: `${post.title} — shared from the Travel Community`, url };

    // Prefer the real OS share sheet (WhatsApp, Twitter/X, Instagram, etc. appear here natively)
    if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // user closed the share sheet — not an error
        // any other failure (unsupported data, permission, etc.) falls through to clipboard below
      }
    }

    // Fallback for browsers without Web Share support: real clipboard write with real success/failure feedback
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success(this.i18n.t('community.linkCopied'));
    } catch {
      this.toast.error(this.i18n.t('community.copyFailed', { url }), 6000);
    }
  }
  trackPostId(index: number, p: any): string { return p.id; }
}
