import { Component, Input } from '@angular/core';

/**
 * A CSS-only phone mockup; the screen content is projected. Every size inside is in
 * `em`, so setting `font-size` on the host scales the whole phone.
 */
@Component({
  selector: 'app-phone-frame',
  standalone: true,
  templateUrl: './phone-frame.component.html',
  styleUrl: './phone-frame.component.scss',
  host: { '[class.is-android]': "platform === 'android'" }
})
export class PhoneFrameComponent {
  /** iOS draws a Dynamic Island, Android a punch-hole camera. */
  @Input() platform: 'ios' | 'android' = 'ios';
  @Input() time = '9:41';
}
