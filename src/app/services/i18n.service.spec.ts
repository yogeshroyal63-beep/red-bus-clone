import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [I18nService] });
    service = TestBed.inject(I18nService);
  });

  it('should be created', () => expect(service).toBeTruthy());

  it('should default to English', () => {
    expect(service.lang()).toBe('en');
  });

  it('should translate English keys correctly', () => {
    expect(service.t('search.btn')).toBe('SEARCH BUSES');
    expect(service.t('nav.bus')).toBe('Bus Tickets');
    expect(service.t('home.title')).toContain('India');
  });

  it('should switch to Hindi and translate', () => {
    service.setLang('hi');
    expect(service.lang()).toBe('hi');
    expect(service.t('search.btn')).toBe('बसें खोजें');
    expect(service.t('nav.bus')).toBe('बस टिकट');
  });

  it('should switch to Tamil and translate', () => {
    service.setLang('ta');
    expect(service.t('search.btn')).toBe('பஸ் தேடுங்கள்');
  });

  it('should switch to Telugu and translate', () => {
    service.setLang('te');
    expect(service.t('search.btn')).toBe('బస్సులు వెతకండి');
  });

  it('should persist language to localStorage', () => {
    service.setLang('kn');
    expect(localStorage.getItem('rb_lang')).toBe('kn');
  });

  it('should fall back to English for missing keys', () => {
    service.setLang('hi');
    const result = service.t('nonexistent.key.xyz');
    // Returns the key itself as fallback
    expect(result).toBeDefined();
  });

  it('should expose all 6 languages', () => {
    expect(service.languages.length).toBe(6);
    const codes = service.languages.map(l => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
    expect(codes).toContain('ta');
    expect(codes).toContain('te');
    expect(codes).toContain('kn');
    expect(codes).toContain('ml');
  });

  it('should switch language without page reload', () => {
    service.setLang('ml');
    expect(service.lang()).toBe('ml');
    expect(service.t('search.btn')).toBe('ബസ്സുകൾ തിരയുക');
    service.setLang('en');
    expect(service.lang()).toBe('en');
    expect(service.t('search.btn')).toBe('SEARCH BUSES');
  });
});
