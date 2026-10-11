import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Cross-fade between tabs with the browser's View Transitions API; browsers without it just switch instantly.
    provideRouter(routes, withComponentInputBinding(), withViewTransitions({ skipInitialTransition: true })),
  ],
};
