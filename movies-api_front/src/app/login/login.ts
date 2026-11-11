import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../api.service';
import { CinemaScene } from '../scene/cinema-scene';

type Mode = 'login' | 'register';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, CinemaScene],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private api = inject(ApiService);
  private router = inject(Router);

  mode = signal<Mode>('login');
  username = '';
  password = '';
  secretKey = '';
  showPassword = signal(false);
  loading = signal(false);
  error = signal('');
  notice = signal('');

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.error.set('');
    this.notice.set('');
  }

  submit(): void {
    if (this.loading()) return;
    this.error.set('');
    this.notice.set('');
    const username = this.username.trim();
    if (!username || !this.password) {
      this.error.set('Ingresa usuario y contraseña.');
      return;
    }
    if (this.mode() === 'register' && !this.secretKey) {
      this.error.set('La clave secreta del servidor es obligatoria para crear un usuario.');
      return;
    }

    this.loading.set(true);
    if (this.mode() === 'login') {
      this.api.login(username, this.password).subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/']);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.describe(err, 'login'));
        },
      });
    } else {
      this.api.register(username, this.password, this.secretKey).subscribe({
        next: () => {
          this.loading.set(false);
          this.secretKey = '';
          this.mode.set('login');
          this.notice.set(`Usuario “${username}” creado. Ya puedes iniciar sesión.`);
        },
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.error.set(this.describe(err, 'register'));
        },
      });
    }
  }

  private describe(err: HttpErrorResponse, action: Mode): string {
    if (err.status === 0) return 'No hay conexión con la API en localhost:3000.';
    if (action === 'login' && (err.status === 404 || err.status === 401)) return 'Usuario o contraseña incorrectos.';
    if (action === 'register' && err.status === 409) return 'Ese usuario ya existe.';
    // The API answers a wrong secret key with 404.
    if (action === 'register' && [401, 403, 404].includes(err.status)) return 'La clave secreta no es válida.';
    const message = typeof err.error === 'string' ? err.error : err.error?.message;
    return message || `Error inesperado (${err.status}).`;
  }
}
