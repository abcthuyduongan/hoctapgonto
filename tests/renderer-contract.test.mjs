import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorldRenderer } from '../src/world3d/renderer/rendererFactory.ts';

function renderer(events = []) {
  return {
    focusOn() {}, setPaused() {}, setMotion() {}, setQuality() {},
    getDiagnostics: () => ({ engine: 'three-webgl' }),
    dispose: () => events.push('dispose'),
  };
}
function options(controller = new AbortController()) {
  return {
    canvas: { id: 'original' }, onSelect() {}, motionOn: true, paused: false,
    quality: 'auto', signal: controller.signal, onContextLost() {},
    premium3DEnabled: true, replaceCanvas: () => ({ id: 'replacement' }),
  };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('premium success preserves the canvas and initialization options without constructing fallback', async () => {
  const opts = options(), premium = renderer();
  const calls = [];
  opts.replaceCanvas = () => { throw new Error('successful premium must retain its canvas'); };
  const actual = await createWorldRenderer(opts, {
    premium(received) { calls.push(received); return premium; },
    legacy() { throw new Error('successful premium must not construct legacy'); },
  });
  assert.equal(actual, premium);
  assert.equal(calls.length, 1);
  for (const field of ['canvas', 'onSelect', 'motionOn', 'paused', 'quality', 'signal', 'onContextLost']) {
    assert.equal(calls[0][field], opts[field], field);
  }
});

test('premium opt-out constructs only legacy on the original canvas', async () => {
  const opts = { ...options(), premium3DEnabled: false }, legacy = renderer();
  opts.replaceCanvas = () => { throw new Error('opt-out must retain its canvas'); };
  const actual = await createWorldRenderer(opts, {
    premium() { throw new Error('feature flag disabled'); },
    legacy(received) { assert.equal(received.canvas, opts.canvas); return legacy; },
  });
  assert.equal(actual, legacy);
});

test('premium failure cleans up before replacing canvas and initializes fallback on the new canvas', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const opts = options(), events = [], canvas = { id: 'fresh' }, legacy = renderer();
  opts.replaceCanvas = () => { events.push('replace'); return canvas; };
  const failure = new Error('WebGL construction failed after acquiring context');
  const actual = await createWorldRenderer(opts, {
    premium(received) {
      assert.equal(received.canvas, opts.canvas);
      events.push('premium', 'premium-cleanup');
      // A failed loader owns cleanup of the resources it allocated before rejection.
      return Promise.reject(failure);
    },
    legacy(received) {
      assert.equal(received.canvas, canvas);
      assert.notEqual(received.canvas, opts.canvas);
      assert.equal(received.signal, opts.signal);
      events.push('legacy');
      return legacy;
    },
  });
  assert.equal(actual, legacy);
  assert.deepEqual(events, ['premium', 'premium-cleanup', 'replace', 'legacy']);
  assert.equal(warning.mock.callCount(), 1);
  assert.equal(warning.mock.calls[0].arguments[1], failure);
});

test('already aborted construction never starts either loader or replaces the canvas', async () => {
  const controller = new AbortController(), opts = options(controller), reason = new Error('unmounted');
  controller.abort(reason);
  const unexpected = () => { assert.fail('aborted work must not allocate a renderer'); };
  opts.replaceCanvas = unexpected;
  await assert.rejects(createWorldRenderer(opts, { premium: unexpected, legacy: unexpected }), error => error === reason);
});

test('premium result resolving after abort is disposed once and never starts fallback', async () => {
  const controller = new AbortController(), opts = options(controller), pending = deferred(), events = [];
  const premium = renderer(events), reason = new Error('screen changed while loading');
  opts.replaceCanvas = () => { assert.fail('abort is not a renderer failure'); };
  const work = createWorldRenderer(opts, {
    premium: () => pending.promise,
    legacy: () => { assert.fail('aborted premium must not start legacy'); },
  });
  controller.abort(reason);
  pending.resolve(premium);
  await assert.rejects(work, error => error === reason);
  assert.deepEqual(events, ['dispose']);
});

test('premium rejection after abort propagates abort without fallback or warning', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const controller = new AbortController(), opts = options(controller), reason = new Error('screen unmounted');
  opts.replaceCanvas = () => { assert.fail('cancelled loading must not replace canvas'); };
  await assert.rejects(createWorldRenderer(opts, {
    premium() { controller.abort(reason); throw new Error('network failed too'); },
    legacy() { assert.fail('cancelled loading must not start fallback'); },
  }), error => error === reason);
  assert.equal(warning.mock.callCount(), 0);
});

test('legacy result resolving after abort is disposed once', async () => {
  const controller = new AbortController(), opts = { ...options(controller), premium3DEnabled: false };
  const pending = deferred(), events = [], legacy = renderer(events), reason = new Error('legacy cancelled');
  const work = createWorldRenderer(opts, {
    premium: () => { assert.fail('premium disabled'); }, legacy: () => pending.promise,
  });
  controller.abort(reason);
  pending.resolve(legacy);
  await assert.rejects(work, error => error === reason);
  assert.deepEqual(events, ['dispose']);
});

test('abort during canvas replacement prevents fallback allocation', async t => {
  t.mock.method(console, 'warn', () => {});
  const controller = new AbortController(), opts = options(controller), reason = new Error('replacement cancelled');
  opts.replaceCanvas = () => { controller.abort(reason); return { id: 'fresh' }; };
  await assert.rejects(createWorldRenderer(opts, {
    premium: () => { throw new Error('premium unavailable'); },
    legacy: () => { assert.fail('must check abort before fallback allocation'); },
  }), error => error === reason);
});

test('fallback errors remain visible to the host when both renderers fail', async t => {
  t.mock.method(console, 'warn', () => {});
  const failure = new Error('no usable rendering context');
  await assert.rejects(createWorldRenderer(options(), {
    premium: () => { throw new Error('premium unavailable'); },
    legacy: () => { throw failure; },
  }), error => error === failure);
});
