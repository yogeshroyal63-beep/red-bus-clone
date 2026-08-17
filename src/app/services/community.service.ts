import { Injectable, signal, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  createdAt: Date;
  likes: string[];
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  verified: boolean;
  isTrusted?: boolean;
  title: string;
  content: string;
  tags: string[];
  category: 'story' | 'tip' | 'photo' | 'question' | 'review';
  images?: string[];
  likes: string[];
  comments: Comment[];
  createdAt: Date;
  route?: string;
  visible: boolean;
  reportCount: number;
  pinned?: boolean;
  /** True for demo/seed content, never a real server-backed post. Used to expire seeds
   *  once real content exists instead of showing fake engagement numbers forever
   *  alongside real posts (Finding #12). */
  isSeed?: boolean;
}

const SEED_POSTS: Post[] = [
  {
    id:'p1', userId:'u_arjun', userName:'Arjun Sharma', userAvatar:'A', verified:true, isTrusted:true,
    title:'My epic Bangalore to Goa overnight bus journey 🌊',
    content:'Just returned from the most beautiful bus trip to Goa via Paulo Travels. The journey through the Western Ghats at night was absolutely breathtaking. Woke up to misty mountains and arrived fresh at the beaches. Tips: Book the window seat on the left side for sunrise views, carry a light jacket, and don\'t miss the chai stop at Dharwad around 2 AM!',
    tags:['Goa','Bangalore','NightBus','WesternGhats'], category:'story',
    likes:['u2','u3','u4','u5','u6'], comments:[
      { id:'c1', userId:'u2', userName:'Priya', userAvatar:'P', text:'This is exactly the trip I\'ve been planning! Which seat row did you book?', createdAt:new Date(Date.now()-3600000), likes:['u_arjun'] },
      { id:'c2', userId:'u_arjun', userName:'Arjun Sharma', userAvatar:'A', text:'Row 5 on the left side! Perfect for the mountain views 🏔️', createdAt:new Date(Date.now()-1800000), likes:[] },
    ],
    createdAt:new Date(Date.now()-86400000*1), route:'Bangalore → Goa', visible:true, reportCount:0, pinned:true, isSeed:true
  },
  {
    id:'p2', userId:'u_priya', userName:'Priya Nair', userAvatar:'P', verified:true,
    title:'10 essential tips for overnight bus travel in India 🚌',
    content:'After 50+ overnight bus journeys across India, here\'s my ultimate guide:\n1. Always book window seats for ventilation control\n2. Carry an eye mask and earplugs\n3. Pack snacks — bus dhabas can be unreliable\n4. Download offline maps before boarding\n5. Keep your valuables in a money belt\n6. Inform someone of your PNR and expected arrival\n7. Charge your devices before boarding\n8. Wear comfortable layered clothing\n9. Carry a small towel or hand sanitizer\n10. Save the operator\'s contact number',
    tags:['TravelTips','BusTips','India','NightBus','SafeTravel'], category:'tip',
    likes:['u1','u3','u5','u7','u8','u9'], comments:[
      { id:'c3', userId:'u3', userName:'Rahul', userAvatar:'R', text:'Adding to this: always confirm boarding point the day before!', createdAt:new Date(Date.now()-7200000), likes:['u_priya','u1'] },
    ],
    createdAt:new Date(Date.now()-86400000*3), visible:true, reportCount:0, isSeed:true
  },
  {
    id:'p3', userId:'u_rahul', userName:'Rahul Verma', userAvatar:'R', verified:true,
    title:'Is the Hyderabad to Bangalore Volvo worth the premium? 🤔',
    content:'Been comparing KSRTC Airavat vs private Volvo operators on this route. Spent last month trying both. My honest take: the KSRTC Airavat is 20% cheaper and surprisingly comfortable. Private operators win on punctuality though. What has been your experience?',
    tags:['Hyderabad','Bangalore','Volvo','KSRTC','RouteReview'], category:'question',
    likes:['u1','u4'], comments:[
      { id:'c4', userId:'u4', userName:'Sneha', userAvatar:'S', text:'I prefer SRS Travels on this route. Always on time!', createdAt:new Date(Date.now()-43200000), likes:[] },
    ],
    createdAt:new Date(Date.now()-86400000*5), visible:true, reportCount:0, isSeed:true
  },
  {
    id:'p4', userId:'u_sneha', userName:'Sneha Patel', userAvatar:'S', verified:true, isTrusted:true,
    title:'Hidden gem route: Coorg via KSRTC — the scenic way 🏞️',
    content:'Most people don\'t know about the KSRTC route from Bangalore to Coorg via Sakleshpur. Yes, it takes 30 mins longer but passes through coffee estates and misty valleys. The views around 4 AM are surreal. Pro tip: book the first bus (06:00 departure) for the best morning mountain views. Cost is just ₹280!',
    tags:['Coorg','KSRTC','HiddenGem','Karnataka','Scenic'], category:'tip',
    likes:['u1','u2','u3','u5','u6','u7','u8','u9','u10','u11'],
    comments:[], createdAt:new Date(Date.now()-86400000*7), visible:true, reportCount:0, pinned:true, isSeed:true
  },
];

export interface Forum { id: string; name: string; icon: string; posts: number; color: string; }

const SEED_FORUMS: Forum[] = [
  { id:'f1', name:'Route Reviews', icon:'fa-route', posts:0, color:'#d84e55' },
  { id:'f2', name:'Travel Tips', icon:'fa-lightbulb', posts:0, color:'#f47c20' },
  { id:'f3', name:'Safety & Help', icon:'fa-shield-alt', posts:0, color:'#4caf50' },
  { id:'f4', name:'Trip Planning', icon:'fa-map', posts:0, color:'#9c27b0' },
];

@Injectable({ providedIn: 'root' })
export class CommunityService {
  private http = inject(HttpClient);
  private notifService = inject(NotificationService);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private readonly base = `${environment.apiUrl}/community`;

  // Req 2 fix: the 'community' notification type (comment-on-your-post alerts) previously
  // only ever appeared in seed data — nothing in the app fired it for real. loadPosts()
  // now detects genuinely new comments on the logged-in user's own posts (real server
  // userId, not the client-side 'current_user' like-identity placeholder) and pushes a
  // real notification for each. seenCommentIds guards against re-notifying on every poll.
  private seenCommentIds = new Set<string>();
  private seenCommentsSeeded = false;

  private _posts = signal<Post[]>(SEED_POSTS);
  posts = this._posts.asReadonly();

  // Finding #11: forums used to be a permanently-static array on this service, and the
  // one real endpoint the server offered (GET /community/forums) was never called by the
  // frontend at all. Forums are now loaded from the server, which computes every forum's
  // count live from real post activity (see community.js). Seed values (0) are shown only
  // until the real response arrives.
  private _forums = signal<Forum[]>(SEED_FORUMS);
  forums = this._forums.asReadonly();

  // Finding #10 (frontend half): trending tags used to be a permanently hardcoded array.
  // Now populated from the server's live tag-frequency computation.
  private _trendingTags = signal<string[]>([]);
  trendingTags = this._trendingTags.asReadonly();

  // Findings #7/Finding I: addPost/addComment/toggleLike/report used to apply every
  // change to local state optimistically, then fire the real API call with
  // catchError(() => of(null)) — so a 403 (not verified/no PNR), 422 (validation), or
  // network failure was swallowed and never surfaced. A user with no token never even
  // called the backend for some actions, yet the UI showed success and kept the
  // ghost content forever. lastError now surfaces real failures, and optimistic local
  // state is rolled back when the server rejects the action.
  lastError = signal<string | null>(null);

  loadForums() {
    this.http.get<{ success: boolean; data: Forum[] }>(`${this.base}/forums`)
      .pipe(catchError(() => of(null)))
      .subscribe(resp => {
        if (resp?.success && resp.data.length) this._forums.set(resp.data);
      });
  }

  /** Load posts from backend; merges with seed data if backend has nothing.
   *  Finding #12: seed posts used to be merged in forever regardless of how much real
   *  content existed, so their fake engagement numbers were permanently indistinguishable
   *  from real activity. Seeds are now dropped as soon as the server has any real posts
   *  of its own, so they only ever serve as pre-launch demo filler. */
  loadPosts(category = 'all') {
    const params = category !== 'all' ? `?category=${category}` : '';
    this.http.get<{ success: boolean; data: Post[]; total: number; trendingTags?: string[] }>(`${this.base}/posts${params}`)
      .pipe(catchError(() => of(null)))
      .subscribe(resp => {
        if (resp?.success) {
          if (resp.trendingTags) this._trendingTags.set(resp.trendingTags);
          if (resp.data.length || resp.total > 0) {
            this.notifyNewCommentsOnOwnPosts(resp.data);
            // Real content exists on the server (even if this page/category came back
            // empty) — seeds are demo filler only and must not linger once there's a
            // real feed to show.
            this._posts.set(resp.data);
          }
          // If the server has never seen a single real post yet, keep the seeds so the
          // demo page isn't blank.
        }
      });
  }

  /** Scans freshly-fetched posts for comments on the logged-in user's own posts that
   *  weren't there before, and pushes a real 'community' notification for each (skipping
   *  comments the user left on their own post). The first call after login just records
   *  what's already there as "seen" so login doesn't dump a backlog of old comments as
   *  fresh notifications. */
  private notifyNewCommentsOnOwnPosts(freshPosts: Post[]) {
    const myUserId = this.auth.user()?._id;
    const isFirstScan = !this.seenCommentsSeeded;
    this.seenCommentsSeeded = true;

    for (const post of freshPosts) {
      const isMyPost = !!myUserId && post.userId === myUserId;
      for (const comment of post.comments) {
        if (this.seenCommentIds.has(comment.id)) continue;
        this.seenCommentIds.add(comment.id);
        if (isFirstScan || !isMyPost || comment.userId === myUserId) continue;

        this.notifService.push({
          type: 'community',
          title: `${comment.userName} commented on your "${post.title}" travel story.`,
          message: `${comment.userName} commented on your "${post.title}" travel story.`,
          titleKey: 'notif.seedCommunityTitle',
          messageKey: 'notif.seedCommunityMsg',
          params: { name: comment.userName, postTitle: post.title },
          channel: 'push',
          icon: 'fa-comment-dots',
          color: '#1976d2',
          action: `/community?post=${post.id}`
        });
      }
    }
  }

  private hasToken(): string | null {
    return localStorage.getItem('rb_token');
  }

  toggleLike(postId: string, userId: string) {
    this.lastError.set(null);
    const post = this._posts().find(p => p.id === postId);
    if (post && post.userId === userId) {
      this.lastError.set(this.i18n.t('err.selfLikePost'));
      return;
    }
    const token = this.hasToken();
    if (!token) { this.lastError.set(this.i18n.t('err.unauthorized')); return; }

    const previous = this._posts();
    this._posts.update(ps => ps.map(p => {
      if (p.id !== postId) return p;
      const liked = p.likes.includes(userId);
      return { ...p, likes: liked ? p.likes.filter(u=>u!==userId) : [...p.likes, userId] };
    }));

    this.http.post<{ success: boolean; likes: number }>(`${this.base}/posts/${postId}/like`, {}).pipe(
      catchError((err: HttpErrorResponse) => {
        this._posts.set(previous);
        this.lastError.set(this.i18n.tErr(err, 'err.likeFailed'));
        return of(null);
      })
    ).subscribe();
  }

  /** Finding H: comment likes previously had no server endpoint at all — this was pure
   *  client-side signal manipulation with no persistence. Now a real, server-backed
   *  action with the same self-like guard as post likes. */
  toggleCommentLike(postId: string, commentId: string, userId: string) {
    this.lastError.set(null);
    const post = this._posts().find(p => p.id === postId);
    const comment = post?.comments.find(c => c.id === commentId);
    if (comment && comment.userId === userId) {
      this.lastError.set(this.i18n.t('err.selfLikeComment'));
      return;
    }
    const token = this.hasToken();
    if (!token) { this.lastError.set(this.i18n.t('err.unauthorized')); return; }

    const previous = this._posts();
    this._posts.update(ps => ps.map(p => {
      if (p.id !== postId) return p;
      return {
        ...p,
        comments: p.comments.map(c => {
          if (c.id !== commentId) return c;
          const liked = c.likes.includes(userId);
          return { ...c, likes: liked ? c.likes.filter(u => u !== userId) : [...c.likes, userId] };
        })
      };
    }));

    this.http.post<{ success: boolean; likes: number }>(`${this.base}/posts/${postId}/comments/${commentId}/like`, {}).pipe(
      catchError((err: HttpErrorResponse) => {
        this._posts.set(previous);
        this.lastError.set(this.i18n.tErr(err, 'err.likeFailed'));
        return of(null);
      })
    ).subscribe();
  }

  /** Posting a comment now requires the same journey verification as posting itself
   *  (Finding #8: comments used to be the one piece of UGC in this app with no
   *  verification gate at all). bookingPnr is required, matching addPost's contract. */
  addComment(postId: string, comment: Omit<Comment,'id'|'createdAt'|'likes'>, bookingPnr: string) {
    this.lastError.set(null);
    const token = this.hasToken();
    if (!token) { this.lastError.set(this.i18n.t('err.unauthorized')); return null; }
    if (!bookingPnr) { this.lastError.set(this.i18n.t('err.pnrRequiredComment')); return null; }

    const newComment: Comment = { ...comment, id:'c'+Date.now(), createdAt:new Date(), likes:[] };

    this._posts.update(ps => ps.map(p => p.id === postId ? { ...p, comments:[...p.comments, newComment] } : p));

    this.http.post<{ success: boolean; data: Comment }>(`${this.base}/posts/${postId}/comments`, {
      text: comment.text, bookingPnr
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        // Roll back the optimistic comment and surface why it failed.
        this._posts.update(ps => ps.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.filter(c => c.id !== newComment.id)
        }));
        this.lastError.set(this.i18n.tErr(err, 'err.commentFailed'));
        return of(null);
      })
    ).subscribe(resp => {
      if (resp?.success) {
        this._posts.update(ps => ps.map(p => p.id !== postId ? p : {
          ...p, comments: p.comments.map(c => c.id === newComment.id ? { ...newComment, id: resp.data.id } : c)
        }));
      }
    });

    return newComment;
  }

  addPost(post: Omit<Post,'id'|'likes'|'comments'|'visible'|'reportCount'>, bookingPnr: string) {
    this.lastError.set(null);
    const token = this.hasToken();
    if (!token) {
      this.lastError.set(this.i18n.t('err.unauthorized'));
      return null;
    }
    if (!bookingPnr) {
      this.lastError.set(this.i18n.t('err.pnrRequiredPost'));
      return null;
    }

    const newPost: Post = { ...post, id:'p'+Date.now(), likes:[], comments:[], visible:true, reportCount:0 };

    // Optimistic update: add to signal immediately so the UI responds
    this._posts.update(ps => [newPost, ...ps]);

    // bookingPnr is required server-side now — community.js validates it against a
    // real confirmed, completed booking instead of trusting a client-sent verified:true
    // flag. userName is NOT sent — the server derives it from the authenticated account.
    this.http.post<{ success: boolean; data: Post }>(`${this.base}/posts`, {
      title: post.title, content: post.content,
      category: post.category, tags: post.tags,
      route: post.route, bookingPnr, images: post.images || []
    }).pipe(
      catchError((err: HttpErrorResponse) => {
        // Roll back the optimistic add and surface why it failed instead of silently
        // leaving a post that only ever existed in this browser.
        this._posts.update(ps => ps.filter(p => p.id !== newPost.id));
        this.lastError.set(this.i18n.tErr(err, 'err.postFailed'));
        return of(null);
      })
    ).subscribe(resp => {
      if (resp?.success) {
        // Replace temp post with server-assigned id and server-derived fields
        this._posts.update(ps => ps.map(p => p.id === newPost.id ? { ...newPost, ...resp.data } : p));
      }
    });

    return newPost;
  }

  report(postId: string) {
    this.lastError.set(null);
    const token = this.hasToken();
    if (!token) { this.lastError.set(this.i18n.t('err.unauthorized')); return; }

    const previous = this._posts();
    this._posts.update(ps => ps.map(p => {
      if (p.id !== postId) return p;
      const count = p.reportCount + 1;
      return { ...p, reportCount: count, visible: count < 5 };
    }));

    this.http.post(`${this.base}/posts/${postId}/report`, {}).pipe(
      catchError((err: HttpErrorResponse) => {
        this._posts.set(previous);
        this.lastError.set(this.i18n.tErr(err, 'err.reportFailed'));
        return of(null);
      })
    ).subscribe();
  }

  getByCategory(cat: string) { return this._posts().filter(p => p.visible && (cat === 'all' || p.category === cat)); }
}
