/** Audio UX is strictly optional and is OFF by default for children. */
let context: AudioContext | null = null;
export function playFeedbackTone(result: 'success'|'retry') {
  if (typeof window === 'undefined' || document.documentElement.dataset.sound !== 'on') return;
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(result === 'success' ? 660 : 350, context.currentTime);
    if (result === 'success') oscillator.frequency.exponentialRampToValueAtTime(920, context.currentTime + .14);
    volume.gain.setValueAtTime(.0001, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(.045, context.currentTime + .02);
    volume.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .20);
    oscillator.connect(volume);volume.connect(context.destination);
    oscillator.start();oscillator.stop(context.currentTime + .21);
  } catch { /* audio unsupported: keep learning interaction functional */ }
}

/** Short celebratory three-note sound, disabled unless the family explicitly opts in. */
export function playCompletionFanfare() {
  if (typeof window === 'undefined' || document.documentElement.dataset.sound !== 'on') return;
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const start = context.currentTime;
    [523.25,659.25,783.99].forEach((frequency,index)=>{
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency,start);
      const at = start + index * .14;
      gain.gain.setValueAtTime(.0001,at);
      gain.gain.exponentialRampToValueAtTime(.04,at+.025);
      gain.gain.exponentialRampToValueAtTime(.0001,at+.23);
      oscillator.connect(gain);gain.connect(context!.destination);
      oscillator.start(at);oscillator.stop(at+.24);
    });
  } catch { /* sound disabled/unsupported: never block completion */ }
}
