import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { API_BASE, ApiService } from './api.service';

/** Sends the session token to our API and drops the session when the API rejects it. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const token = api.token();
  const ours = req.url.startsWith(API_BASE);
  const request = ours && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (ours && token && err.status === 401) api.logout();
      return throwError(() => err);
    }),
  );
};
