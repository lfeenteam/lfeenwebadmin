import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Silence all console output (logs, warnings, errors) coming from the app code.
const noop = () => {};
(['log', 'info', 'warn', 'error', 'debug', 'trace', 'table', 'dir', 'group', 'groupCollapsed', 'groupEnd'] as const)
  .forEach((method) => ((console as any)[method] = noop));

// Swallow uncaught errors / unhandled promise rejections so they don't reach the console.
window.addEventListener('error', (e) => e.preventDefault());
window.addEventListener('unhandledrejection', (e) => e.preventDefault());

bootstrapApplication(AppComponent, appConfig).catch(() => {});
