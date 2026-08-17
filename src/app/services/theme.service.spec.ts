import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({ providers: [ThemeService] });
    service = TestBed.inject(ThemeService);
  });

  it('should be created', () => expect(service).toBeTruthy());

  it('should default to light theme when no preference saved', () => {
    expect(service.theme()).toBe('light');
  });

  it('should toggle from light to dark', () => {
    expect(service.theme()).toBe('light');
    service.toggle();
    expect(service.theme()).toBe('dark');
  });

  it('should toggle from dark back to light', () => {
    service.set('dark');
    service.toggle();
    expect(service.theme()).toBe('light');
  });

  it('should persist theme to localStorage', () => {
    service.set('dark');
    expect(localStorage.getItem('rb_theme')).toBe('dark');
    service.set('light');
    expect(localStorage.getItem('rb_theme')).toBe('light');
  });

  it('should apply data-theme attribute to document root', () => {
    service.set('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    service.set('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('should set a specific theme directly', () => {
    service.set('dark');
    expect(service.theme()).toBe('dark');
    service.set('light');
    expect(service.theme()).toBe('light');
  });
});
