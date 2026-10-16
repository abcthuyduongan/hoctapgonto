import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSpeechSupported, speakText, stopSpeaking } from '../src/core/speech.ts';

test('Speech: returns false safely in headless Node environment', () => {
  assert.equal(isSpeechSupported(), false);
  assert.equal(speakText('Xin chào'), false);
  // stopSpeaking should not throw
  assert.doesNotThrow(() => stopSpeaking());
});

test('Speech: mock Web Speech API interactions', () => {
  let speakCalls = 0;
  let cancelCalls = 0;
  let lastUtterance = null;

  class MockUtterance {
    constructor(text) {
      this.text = text;
      this.lang = '';
      this.rate = 1;
      this.pitch = 1;
    }
  }

  const mockWindow = {
    speechSynthesis: {
      speak: (utt) => {
        speakCalls++;
        lastUtterance = utt;
      },
      cancel: () => {
        cancelCalls++;
      }
    },
    SpeechSynthesisUtterance: MockUtterance
  };

  globalThis.window = mockWindow;

  try {
    assert.equal(isSpeechSupported(), true);

    // Empty text should not speak
    const emptyResult = speakText('   ');
    assert.equal(emptyResult, false);
    assert.equal(speakCalls, 0);

    // Normal speak
    const result = speakText('Toán học lớp 3', { lang: 'vi-VN', rate: 0.85 });
    assert.equal(result, true);
    assert.equal(cancelCalls, 1, 'Previous speech should be cancelled');
    assert.equal(speakCalls, 1);
    assert.equal(lastUtterance.text, 'Toán học lớp 3');
    assert.equal(lastUtterance.lang, 'vi-VN');
    assert.equal(lastUtterance.rate, 0.85);

    // Test stop
    stopSpeaking();
    assert.equal(cancelCalls, 2);
  } finally {
    delete globalThis.window;
  }
});
