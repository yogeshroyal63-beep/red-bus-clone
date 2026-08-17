import { TestBed } from '@angular/core/testing';
import { CommunityService } from './community.service';

describe('CommunityService', () => {
  let service: CommunityService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CommunityService] });
    service = TestBed.inject(CommunityService);
  });

  it('should be created', () => expect(service).toBeTruthy());

  it('should seed initial posts', () => {
    expect(service.posts().length).toBeGreaterThan(0);
  });

  it('should get posts by category', () => {
    const stories = service.getByCategory('story');
    expect(stories.every(p => p.category === 'story')).toBeTrue();
  });

  it('should get all visible posts for "all" category', () => {
    const all = service.getByCategory('all');
    expect(all.length).toBeGreaterThan(0);
    expect(all.every(p => p.visible)).toBeTrue();
  });

  it('should toggle like on a post', () => {
    const post = service.posts()[0];
    const before = post.likes.length;
    service.toggleLike(post.id, 'test_user');
    const after = service.posts().find(p => p.id === post.id)!.likes.length;
    expect(after).toBe(before + 1);
    service.toggleLike(post.id, 'test_user'); // unlike
    const final = service.posts().find(p => p.id === post.id)!.likes.length;
    expect(final).toBe(before);
  });

  it('should add a comment to a post', () => {
    const post = service.posts()[0];
    const before = post.comments.length;
    service.addComment(post.id, { userId: 'u_test', userName: 'Test', userAvatar: 'T', text: 'Great post!' });
    const after = service.posts().find(p => p.id === post.id)!.comments.length;
    expect(after).toBe(before + 1);
  });

  it('should add a new post', () => {
    const before = service.posts().length;
    service.addPost({
      userId: 'u_test', userName: 'Test User', userAvatar: 'T',
      verified: true, title: 'My Test Journey', content: 'Had an amazing trip!',
      tags: ['Test'], category: 'story', createdAt: new Date()
    });
    expect(service.posts().length).toBe(before + 1);
  });

  it('should auto-hide post after 5 reports', () => {
    const post = service.posts()[0];
    for (let i = 0; i < 5; i++) service.report(post.id);
    const updated = service.posts().find(p => p.id === post.id)!;
    expect(updated.visible).toBeFalse();
  });

  it('should have 6 forum categories', () => {
    expect(service.forums.length).toBe(6);
  });
});
