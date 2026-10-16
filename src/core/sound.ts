/**
 * Bảo An Learning - Procedural Web Audio Engine
 * Sống động, tự nhiên, không cần tệp mp3 tải ngoài (100% Offline-First, 0ms Latency)
 * Tự động kiểm tra cài đặt âm thanh của phụ huynh (chỉ phát khi sound === 'on').
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.sound === 'on';
}

/** Âm thanh click nhẹ, trong trẻo, tự nhiên khi bấm nút, chuyển tab */
export function playClickSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // Non-blocking
  }
}

/** Âm thanh lật thẻ (thẻ bài Memory Match, chọn thẻ Word Connect) */
export function playCardFlipSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.075);
  } catch {
    // Non-blocking
  }
}

/** Âm thanh huyền bí, ngân vang khi chọn hòn đảo 3D */
export function playIslandSelectSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const freqs = [440, 554.37, 659.25, 880]; // A major chord arpeggio
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const delay = idx * 0.04;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + delay + 0.22);

      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.05 / (idx + 1), now + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.29);
    });
  } catch {
    // Non-blocking
  }
}

/** Âm thanh trả lời ĐÚNG: Hợp âm chuông ngân vang vui vẻ (Major Triad Sparkle) */
export function playCorrectSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // C6, E6, G6 (1046.5Hz, 1318.5Hz, 1567.9Hz) - Chuông ngọc tươi sáng
    const notes = [
      { f: 659.25, t: 0.0 },   // E5
      { f: 880.0, t: 0.06 },   // A5
      { f: 1174.66, t: 0.12 }, // D6
      { f: 1760.0, t: 0.18 }   // A6
    ];

    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.07, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.32);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + 0.34);
    });
  } catch {
    // Non-blocking
  }
}

/** Âm thanh trả lời SAI / THỬ LẠI: Nốt marimba ấm áp, dịu dàng, khích lệ bé (không gây ức chế) */
export function playIncorrectSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // 2 nốt trầm nhẹ nhàng (G4 -> E4)
    const notes = [
      { f: 392.0, t: 0.0 },
      { f: 329.63, t: 0.09 }
    ];

    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.95, now + t + 0.18);

      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.05, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + 0.23);
    });
  } catch {
    // Non-blocking
  }
}

/** Âm thanh chiến thắng hoàn thành vòng chơi (Celebratory Grand Chime & Fanfare) */
export function playVictoryFanfare(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Giai điệu chúc mừng rực rỡ: C5 - E5 - G5 - C6 - E6
    const fanfareNotes = [
      { f: 523.25, t: 0.0, d: 0.16 },
      { f: 659.25, t: 0.14, d: 0.16 },
      { f: 783.99, t: 0.28, d: 0.18 },
      { f: 1046.5, t: 0.44, d: 0.45 },
      { f: 1318.51, t: 0.52, d: 0.45 }
    ];

    fanfareNotes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + t);

      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.08, now + t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + d + 0.02);
    });
  } catch {
    // Non-blocking
  }
}
