import { playCorrectSound, playIncorrectSound, playVictoryFanfare } from './sound';

/** Audio UX is strictly optional and is OFF by default for children. */
export function playFeedbackTone(result: 'success' | 'retry') {
  if (typeof document !== 'undefined' && document.documentElement.dataset.sound !== 'on') return;
  if (result === 'success') {
    playCorrectSound();
  } else {
    playIncorrectSound();
  }
}

/** Short celebratory fanfare, disabled unless the family explicitly opts in. */
export function playCompletionFanfare() {
  if (typeof document !== 'undefined' && document.documentElement.dataset.sound !== 'on') return;
  playVictoryFanfare();
}
