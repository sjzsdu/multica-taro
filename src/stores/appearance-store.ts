import { create } from 'zustand'
import Taro from '@tarojs/taro'

export type FontScale = 'normal' | 'large' | 'xlarge'

const STORAGE_KEY = 'appearance_font_scale'

const FONT_SCALE_VALUE: Record<FontScale, string> = {
  normal: '1',
  large: '1.12',
  xlarge: '1.24',
}

function isFontScale(value: unknown): value is FontScale {
  return value === 'normal' || value === 'large' || value === 'xlarge'
}

/**
 * Applies the scale as a CSS variable. H5 only: mini programs do not expose a
 * global style hook, so the setting is stored there but visual scaling is
 * H5-first (which is the primary target of this client).
 */
export function applyFontScale(scale: FontScale): void {
  if (process.env.TARO_ENV !== 'h5') return
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--font-scale', FONT_SCALE_VALUE[scale])
}

interface AppearanceState {
  fontScale: FontScale
  init: () => void
  setFontScale: (scale: FontScale) => void
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  fontScale: 'normal',

  init: () => {
    const stored = Taro.getStorageSync(STORAGE_KEY)
    const scale = isFontScale(stored) ? stored : 'normal'
    applyFontScale(scale)
    set({ fontScale: scale })
  },

  setFontScale: (scale: FontScale) => {
    Taro.setStorageSync(STORAGE_KEY, scale)
    applyFontScale(scale)
    set({ fontScale: scale })
  },
}))
