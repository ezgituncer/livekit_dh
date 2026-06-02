// Minimal, framework-agnostic types for the FaceUnity FURenderKit avatar.
// Adapted from the original Vite/Redux component, stripped of all app coupling.

/** The single avatar id shipped with this project. */
export const AVATAR_ID = '1uXv3aAcC';

/** Tag the timestamp parser injects to trigger a speaking gesture animation. */
export const SPEAKING_ANIMATION_TAG = 'speakAction';

/** Minimum seconds between speaking gesture animations. */
export const SPEAKING_ANIMATION_TIME_SEC = 8;

/** Silent placeholder phoneme. */
export const SILENT_TIMESTAMP = 'sil';

export enum Language {
  CHINESE = 0,
  ENGLISH = 1,
  ARABIC = 2,
}

export enum Phoneme {
  ARPABET,
  PINYIN,
  WORD,
  IPA,
}

/** Lip-drive stream type passed to FULite.getExpressionByTime. */
export enum LipDriveStreamType {
  BUILTIN_TIMESTAMP = 0,
  WORD_TIMESTAMP = 1,
  IPA_TIMESTAMP = 4,
}

export enum LipDriveLanguageType {
  CHINESE = 0,
  ENGLISH = 1,
  ARABIC = 2,
}

/** Parsed `index.json` for an avatar. */
export interface BundleSpec {
  style: string;
  camera: string;
  light: string;
  bundles: string[];
  animations: string[];
}

/** What `loadAvatar` keeps per avatar. */
export interface AvatarSpec {
  bundle: BundleSpec;
  /** Raw avatar.json text/object passed to loadFromJson. */
  jsonData: unknown;
}

export type AvatarStatus = 'idle' | 'loading' | 'ready' | 'error';
