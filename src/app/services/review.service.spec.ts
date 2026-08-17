import { TestBed } from '@angular/core/testing';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
  let service: ReviewService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [ReviewService] });
    service = TestBed.inject(ReviewService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return reviews for a specific bus', () => {
    const reviews = service.getForBus('1');
    expect(reviews.length).toBeGreaterThan(0);
    reviews.forEach(r => expect(r.busId).toBe('1'));
  });

  it('should calculate average rating correctly', () => {
    const avg = service.getAvgRating('1');
    expect(avg).toBeGreaterThan(0);
    expect(avg).toBeLessThanOrEqual(5);
  });

  it('should allow a user to review if they have not reviewed before', () => {
    expect(service.canReview('1', 'brand_new_user_xyz')).toBeTrue();
  });

  it('should NOT allow a user to review twice for the same bus', () => {
    expect(service.canReview('1', 'u1')).toBeFalse(); // u1 already seeded
  });

  it('should add a new review', () => {
    const before = service.getForBus('1').length;
    service.addReview({
      busId: '1', bookingPnr: 'RBTEST001', userId: 'test_user_new', userName: 'Test User',
      userAvatar: 'T', rating: 4,
      text: 'Great journey! Very comfortable bus with excellent amenities.',
      createdAt: new Date(), journeyDate: '2026-08-01', verified: true
    });
    expect(service.getForBus('1').length).toBe(before + 1);
  });

  it('should allow editing within 24 hours', () => {
    const review = service.getForBus('1')[0];
    const result = service.editReview(review.id, 'Updated text after reflection.', 5);
    expect(result).toBeTrue();
  });

  it('should NOT allow editing after 24 hours', () => {
    service.addReview({
      busId: '1', bookingPnr: 'RBOLD001', userId: 'old_user', userName: 'Old User',
      userAvatar: 'O', rating: 3,
      text: 'An old review that is now past the edit window.',
      createdAt: new Date(Date.now() - 25 * 3600000),
      journeyDate: '2026-07-01', verified: true
    });
    const oldReview = service.getForBus('1').find(r => r.userId === 'old_user')!;
    const result = service.editReview(oldReview.id, 'Trying to edit now', 5);
    expect(result).toBeFalse();
  });

  it('should auto-hide review after 3 reports', () => {
    const review = service.getForBus('2')[0];
    service.report(review.id);
    service.report(review.id);
    service.report(review.id);
    const updated = service.reviews().find(r => r.id === review.id)!;
    expect(updated.visible).toBeFalse();
  });

  it('should toggle helpful upvote', () => {
    const review = service.getForBus('1')[0];
    const before = review.upvotes;
    service.markHelpful(review.id, 'new_voter');
    const after = service.reviews().find(r => r.id === review.id)!.upvotes;
    expect(after).toBe(before + 1);
    service.markHelpful(review.id, 'new_voter'); // toggle off
    const final = service.reviews().find(r => r.id === review.id)!.upvotes;
    expect(final).toBe(before);
  });
});
