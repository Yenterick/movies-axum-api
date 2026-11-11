import { RenderMode, ServerRoute } from '@angular/ssr';

// Both pages depend on browser-only state (localStorage session, WebGL, live API data),
// so render them on the client instead of prerendering empty shells at build time.
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Client
  }
];
