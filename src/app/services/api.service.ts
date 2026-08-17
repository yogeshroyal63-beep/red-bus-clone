import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, params?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) Object.entries(params).forEach(([k, v]) => httpParams = httpParams.set(k, v));
    return this.http.get<T>(`${this.base}${endpoint}`, { params: httpParams }).pipe(
      // ISSUE #11 FIX: Only retry on network errors (status 0) or 5xx server errors.
      // 4xx errors (400, 401, 403, 404, 422, 429) should surface immediately — never retry.
      retry({
        count: 3,
        delay: (error: HttpErrorResponse, retryCount) => {
          if (error.status !== 0 && error.status < 500) {
            // 4xx or other client error: DO NOT retry, surface immediately
            return throwError(() => error);
          }
          // Exponential backoff: 500ms, 1000ms, 2000ms
          return timer(Math.pow(2, retryCount - 1) * 500);
        }
      }),
      catchError(this.handleError)
    );
  }

  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.base}${endpoint}`, body).pipe(
      catchError(this.handleError)
    );
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.base}${endpoint}`, body).pipe(
      catchError(this.handleError)
    );
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${endpoint}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    let msg = 'Something went wrong. Please try again.';
    if (err.status === 0) msg = 'Network error. Please check your connection.';
    else if (err.status === 400) msg = err.error?.error || 'Bad request.';
    else if (err.status === 401) msg = 'Session expired. Please login again.';
    else if (err.status === 403) msg = 'Access denied.';
    else if (err.status === 404) msg = err.error?.error || 'Not found.';
    else if (err.status === 409) msg = err.error?.error || 'Conflict. Resource already exists.';
    else if (err.status === 422) msg = err.error?.details?.[0]?.message || 'Validation error.';
    else if (err.status === 429) msg = 'Too many requests. Please slow down.';
    else if (err.status >= 500) msg = 'Server error. Please try again later.';
    return throwError(() => new Error(msg));
  }
}
