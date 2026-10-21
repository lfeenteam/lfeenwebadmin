import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

const flow = environment.flowReport;

// Silence all console output and swallow uncaught errors, except where the Flow report
// button is on: it records console output, so the console must stay intact.
if (!flow) {
  const noop = () => {};
  (['log', 'info', 'warn', 'error', 'debug', 'trace', 'table', 'dir', 'group', 'groupCollapsed', 'groupEnd'] as const)
    .forEach((method) => ((console as any)[method] = noop));

  window.addEventListener('error', (e) => e.preventDefault());
  window.addEventListener('unhandledrejection', (e) => e.preventDefault());
}

// Flow "report an issue" button. The app starts only after the script has loaded,
// so its request / console log covers the page from the start.
function loadFlowReport(): Promise<void> {
  if (!flow) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://flow.roydigi.com/flow-report.js';
    s.dataset['key'] = flow.key;
    s.dataset['project'] = flow.project;
    s.dataset['channel'] = flow.channel;
    s.onload = s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

loadFlowReport().then(() => bootstrapApplication(AppComponent, appConfig).catch(() => {}));
