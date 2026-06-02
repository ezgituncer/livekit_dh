'use client';

import { AVATAR_ID, type AvatarSpec, type AvatarStatus, type BundleSpec } from './types';

// Resources are served from frontend/public/digital-human/** (see that folder).
// The SDK's locateFile callbacks and the bundle paths inside index.json are all
// resolved relative to this root.
const RES_URL = '/digital-human';
const RENDERER_URL = `${RES_URL}/renderer`;
const EXPRESSION_URL = `${RES_URL}/expression`;
const AVATAR_URL = `${RES_URL}/avatar`;

// Render one frame at most every ~16ms (≈60fps).
const FRAME_INTERVAL_MS = 16;

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// Mutable handles for the live avatar. Exposed for the lip-sync phases.
export interface AvatarRuntime {
  rendererKit: any;
  resourceMgr: any;
  expressionParser: any;
  renderer: any;
  scene: any;
  avatar: any;
  idleAnimationPath: string | null;
  /** Talking gesture animations (arms/hands) played while the agent speaks. */
  gesturePaths: string[];
}

/**
 * The FU renderer is a process-wide singleton (`RenderKit.getInstance()`), and
 * the avatar bundle is ~61MB. We therefore own ONE detached <canvas> at module
 * scope and initialize it exactly once. React components attach that canvas into
 * their DOM and detach on unmount, but never recreate or destroy it. This makes
 * the heavy init immune to React StrictMode's double-mount and to remounts.
 */
export interface AvatarSingleton {
  canvas: HTMLCanvasElement;
  status: AvatarStatus;
  error: string | null;
  runtime: AvatarRuntime | null;
  listeners: Set<() => void>;
  /** 0 = mouth closed, 1 = mouth fully open. Driven by audio energy. */
  openness: number;
  /** Vowel shape from audio spectrum: 0 = rounded (oo), 0.5 = open (ah), 1 = wide (ee). */
  shape: number;
  lipSyncEnabled: boolean;
  /** Whether talking gesture animations are currently looping. */
  gesturing: boolean;
}

// Viseme blendshape templates captured once from the expression parser by feeding
// representative phonemes. Runtime lip-sync blends round→open→wide by `shape`, then
// interpolates from `closed` toward that vowel by `openness` — reusing the SDK's
// real viseme mapping instead of guessing blendshape indices.
interface LipTemplates {
  closed: Float32Array; // "sil"  — resting/closed mouth
  open: Float32Array; //   "AA"   — neutral open jaw
  wide: Float32Array; //   "IY"   — front vowel, mouth widened
  round: Float32Array; //  "UW"   — rounded/puckered lips
  scratch: Float32Array;
}
let lipTemplates: LipTemplates | null = null;

let singleton: AvatarSingleton | null = null;

function notify(s: AvatarSingleton) {
  for (const l of s.listeners) l();
}

function setStatus(s: AvatarSingleton, status: AvatarStatus, error: string | null = null) {
  s.status = status;
  s.error = error;
  notify(s);
}

async function fetchSpec(): Promise<AvatarSpec> {
  const [indexRes, avatarRes] = await Promise.all([
    fetch(`${AVATAR_URL}/${AVATAR_ID}/index.json`),
    fetch(`${AVATAR_URL}/${AVATAR_ID}/avatar.json`),
  ]);
  if (!indexRes.ok || !avatarRes.ok) {
    throw new Error('Failed to fetch avatar spec JSON');
  }
  const bundle: BundleSpec = await indexRes.json();
  const jsonData = await avatarRes.json();
  return { bundle, jsonData };
}

async function initAvatar(s: AvatarSingleton): Promise<void> {
  setStatus(s, 'loading');

  // Client-only dynamic imports: the SDK touches WebGL/WASM/window.
  const [{ default: FURenderKitSDK }, { FUResourceManager }, { default: FULite }] =
    await Promise.all([
      import('furenderkit/fu_render_kit/index'),
      import('furenderkit/fu_resource_manager/index'),
      import('furenderkit/fu_lite/index'),
    ]);

  const spec = await fetchSpec();
  const allAnimations = spec.bundle.animations ?? [];
  const idleAnimationPath = allAnimations[0] ?? null;
  // Talking gestures: prefer the "jiaotan" (conversation) clips; otherwise any
  // non-idle animation.
  const jiaotan = allAnimations.filter((p) => /jiaotan/i.test(p));
  const gesturePaths = jiaotan.length ? jiaotan : allAnimations.slice(1);

  // --- framework ---
  const rendererKit = new FURenderKitSDK({
    locateFile: (filename: string) => `${RENDERER_URL}/${filename}`,
  });
  await rendererKit.initialize();
  rendererKit.RenderKit.setLogLevel(rendererKit.ELoggerLevel.LOG_LEVEL_OFF);

  const resourceMgr = new FUResourceManager({ preferIDBFS: false });
  await rendererKit.setResourceManager(resourceMgr);

  // Expression parser — not needed for idle render, but initialized now so later
  // lip-sync phases can feed it. Failures here are non-fatal.
  let expressionParser: any = null;
  try {
    expressionParser = new FULite({
      locateFile: (filename: string) => `${EXPRESSION_URL}/${filename}`,
    });
    await expressionParser.initialize();
    await expressionParser.SetupDecoder();
  } catch (e) {
    console.warn('[avatar] expression parser init skipped:', e);
  }

  // --- preload all bundles referenced by the spec ---
  const { camera, light, bundles, animations, style } = spec.bundle;
  const allBundlePaths = uniq([camera, light, ...bundles, ...animations]);
  await Promise.all(
    allBundlePaths.map((path) => resourceMgr.prepareCustomBundle(`${RES_URL}/${path}`, path))
  );

  // --- renderer + scene ---
  const renderer = rendererKit.RenderKit.getInstance();
  try {
    renderer.init({ canvas: s.canvas, assetRoot: 'shaders' });
  } catch (err) {
    throw new Error(String(rendererKit.wasmCtx.module.getExceptionMessage(err)));
  }

  const sizeToParent = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = s.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    renderer.resize(w, h);
  };
  const resizeObserver = new ResizeObserver(() => sizeToParent());
  resizeObserver.observe(s.canvas);

  const scene = renderer.createScene('scene');
  scene.setRenderMsaaLevel(rendererKit.EMSAAOption.MSAA_4X);
  scene.enableRenderPostProcess(rendererKit.EPostProcessType.POST_PROCESS_FXAA, true);
  scene.setRenderShadowQuality(rendererKit.EShadowQuality.SHADOW_QUALITY_LOW);
  scene.enableRenderPostProcess(rendererKit.EPostProcessType.POST_PROCESS_MIRROR, false);

  // --- avatar ---
  scene.setCamera(camera);
  scene.clearLight();
  scene.addLight(light);

  const avatar = scene.addAvatar('avatar');
  const styleRoot = `${RES_URL}/${style}`;
  await avatar.loadControllerConfigAsync(`${styleRoot}/controller-config.bundle`);
  await avatar.loadAnimGraphAsync(`${styleRoot}/anim-graph.json`);
  await avatar.loadAnimLogicAsync(`${styleRoot}/anim-logic.json`);

  s.runtime = {
    rendererKit,
    resourceMgr,
    expressionParser,
    renderer,
    scene,
    avatar,
    idleAnimationPath,
    gesturePaths,
  };

  // --- render loop ---
  // IMPORTANT: the loop must be running for loadFromJson to finish — the SDK
  // flushes the last components' GPU texture uploads on render ticks, so awaiting
  // loadFromJson *before* rendering deadlocks. Start the loop first, then load.
  let preTimestamp: number | undefined;
  const tick = () => {
    requestAnimationFrame(async (timestamp) => {
      if (preTimestamp === undefined) preTimestamp = timestamp;
      const elapsed = timestamp - preTimestamp;
      if (elapsed > FRAME_INTERVAL_MS) {
        try {
          await renderer.render(scene, elapsed / 1000);
        } catch {
          // transient render errors are ignored, matching the SDK reference
        }
        preTimestamp = timestamp;
      }
      tick();
    });
  };
  tick();
  sizeToParent();

  await new Promise<void>((resolve, reject) => {
    avatar
      .loadFromJson(spec.jsonData, (total: number, ready: number) => {
        if (total === ready) resolve();
      })
      .catch(reject);
  });

  if (idleAnimationPath) {
    avatar.setAnimation(idleAnimationPath);
  }

  setStatus(s, 'ready');
}

/** Get (and lazily create + initialize) the process-wide avatar singleton. */
export function getAvatarSingleton(): AvatarSingleton {
  if (singleton) return singleton;

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';

  const s: AvatarSingleton = {
    canvas,
    status: 'idle',
    error: null,
    runtime: null,
    listeners: new Set(),
    openness: 0,
    shape: 0.5,
    lipSyncEnabled: false,
    gesturing: false,
  };
  singleton = s;
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    (window as any).__avatarSingleton = s;
  }

  initAvatar(s).catch((e) => {
    console.error('[avatar] init failed:', e);
    setStatus(s, 'error', e instanceof Error ? e.message : String(e));
  });

  return s;
}

// --- Lip-sync (Phase 2: amplitude-driven) -----------------------------------

function clone(a: Float32Array): Float32Array {
  return Float32Array.from(a);
}

/**
 * Capture viseme blendshapes from the expression parser once. For each phoneme we
 * reset the parser, feed the phoneme followed by silence, and sample the resulting
 * 57-coefficient expression at the phoneme's midpoint.
 */
function buildLipTemplates(ep: any): LipTemplates | null {
  try {
    ep.setLangType(1); // LipDriveLanguageType.ENGLISH
    const capture = (phoneme: string): Float32Array => {
      ep.interrupt();
      ep.feed(`0 0.4 ${phoneme}\n`);
      ep.feed('0.4 0.8 sil\n');
      const expr = clone(ep.getExpressionByTime(0.2, 0)); // BUILTIN_TIMESTAMP
      ep.interrupt();
      return expr;
    };
    const closed = capture('sil');
    const open = capture('AA');
    const wide = capture('IY');
    const round = capture('UW');
    return { closed, open, wide, round, scratch: new Float32Array(open.length) };
  } catch (e) {
    console.warn('[avatar] could not build lip templates:', e);
    return null;
  }
}

/** Begin driving the avatar mouth from `singleton.openness` (call once ready). */
export function enableLipSync(): boolean {
  const s = singleton;
  if (!s?.runtime?.avatar || !s.runtime.expressionParser) return false;
  if (s.lipSyncEnabled) return true;

  if (!lipTemplates) lipTemplates = buildLipTemplates(s.runtime.expressionParser);
  if (!lipTemplates) return false;

  const { avatar } = s.runtime;
  const { closed, open, wide, round, scratch } = lipTemplates;

  avatar.enableMouthBlendShape(true);
  // The SDK invokes this each frame at the correct point in its pipeline.
  // 1) pick the vowel shape by blending round→open→wide using `shape`
  // 2) interpolate from the closed mouth toward that vowel by `openness`
  avatar.setExpUpdateFunc(() => {
    const o = s.openness;
    const sh = s.shape;
    for (let i = 0; i < scratch.length; i++) {
      let vowel: number;
      if (sh < 0.5) {
        vowel = round[i] + (open[i] - round[i]) * (sh / 0.5);
      } else {
        vowel = open[i] + (wide[i] - open[i]) * ((sh - 0.5) / 0.5);
      }
      scratch[i] = closed[i] + (vowel - closed[i]) * o;
    }
    avatar.setMouthBlendShape(scratch);
  });
  s.lipSyncEnabled = true;
  return true;
}

/** Set current mouth openness (0..1). Cheap; safe to call every audio frame. */
export function setMouthOpenness(value: number): void {
  if (!singleton) return;
  singleton.openness = value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Set current vowel shape (0 = rounded, 0.5 = open, 1 = wide). */
export function setMouthShape(value: number): void {
  if (!singleton) return;
  singleton.shape = value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Stop lip-sync and return the mouth to the animation-driven resting state. */
export function disableLipSync(): void {
  const s = singleton;
  if (!s?.runtime?.avatar) return;
  s.openness = 0;
  s.shape = 0.5;
  try {
    s.runtime.avatar.clearExpUpdateFunc();
    s.runtime.avatar.enableMouthBlendShape(false);
  } catch {
    /* ignore */
  }
  s.lipSyncEnabled = false;
}

// --- Talking gestures (arms/hands) -----------------------------------------

function playNextGesture(s: AvatarSingleton): void {
  const rt = s.runtime;
  if (!rt?.avatar) return;
  const { avatar, gesturePaths, idleAnimationPath } = rt;
  if (!s.gesturing || !gesturePaths.length) {
    if (idleAnimationPath) avatar.setAnimation(idleAnimationPath);
    return;
  }
  const path = gesturePaths[Math.floor(Math.random() * gesturePaths.length)];
  avatar.setAnimation(path);
  // When this gesture finishes: chain another if still speaking, else go idle.
  avatar.onAnimationDone(() => {
    if (s.gesturing) playNextGesture(s);
    else if (idleAnimationPath) avatar.setAnimation(idleAnimationPath);
  });
}

/** Start looping talking-gesture animations (call when the agent starts speaking). */
export function startGesturing(): void {
  const s = singleton;
  if (!s?.runtime?.avatar || s.gesturing) return;
  if (!s.runtime.gesturePaths.length) return;
  s.gesturing = true;
  playNextGesture(s);
}

/** Stop gesturing and return to idle immediately (when the agent stops talking). */
export function stopGesturing(): void {
  const s = singleton;
  if (!s?.gesturing) return;
  s.gesturing = false;
  // Switch back to the idle (breathing) animation right away so the arms stop
  // as soon as speech ends, instead of waiting for the current gesture clip.
  const rt = s.runtime;
  if (rt?.avatar && rt.idleAnimationPath) {
    try {
      rt.avatar.setAnimation(rt.idleAnimationPath);
    } catch {
      /* ignore */
    }
  }
}

// Dev-only handle for manual probing/verification.
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as unknown as Record<string, unknown>).__avatarLip = {
    enableLipSync,
    setMouthOpenness,
    setMouthShape,
    disableLipSync,
    startGesturing,
    stopGesturing,
  };
}
