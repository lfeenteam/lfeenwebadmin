import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

const SCRIPT_ID = 'google-maps-js-sdk';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadPromise: Promise<void> | null = null;

  // Loads the Google Maps JS SDK exactly once per page lifetime, no matter how many
  // components ask for it concurrently, and lets every caller share the same load state.
  load(): Promise<void> {
    if ((window as any).google?.maps) {
      return Promise.resolve();
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')));
        return;
      }

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.loadPromise = null;
        reject(new Error('Failed to load Google Maps script'));
      };
      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}
