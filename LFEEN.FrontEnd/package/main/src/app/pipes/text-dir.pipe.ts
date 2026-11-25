import { Pipe, PipeTransform } from '@angular/core';

export type TextDir = 'rtl' | 'ltr' | 'auto';

const LETTER = /\p{L}/u;
// Arabic (+ supplement, extended, presentation forms) and Hebrew letters.
const RTL_LETTER = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * Direction for user-written text, by which script most of its letters are in.
 * `dir="auto"` only looks at the first letter, so a mostly-Arabic subject that starts
 * with a Latin word ("QA سيد AI: اختبار مرفقات…") would still render LTR and scramble.
 * Ties (or no letters at all: digits, symbols, empty) give 'auto'.
 */
export function textDir(text: string | null | undefined): TextDir {
  if (!text) return 'auto';
  let rtl = 0;
  let ltr = 0;
  for (const ch of text) {
    if (!LETTER.test(ch)) continue; // digits (incl. Arabic-Indic), punctuation, spaces
    if (RTL_LETTER.test(ch)) rtl++;
    else ltr++;
  }
  if (rtl > ltr) return 'rtl';
  if (ltr > rtl) return 'ltr';
  return 'auto';
}

/**
 *   <p [attr.dir]="msg.body | textDir">{{ msg.body }}</p>
 */
@Pipe({ name: 'textDir', standalone: true })
export class TextDirPipe implements PipeTransform {
  transform(text: string | null | undefined): TextDir {
    return textDir(text);
  }
}
