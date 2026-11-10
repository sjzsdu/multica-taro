import { create } from 'zustand'
import Taro from '@tarojs/taro'

export type FontScale = 'normal' | 'large' | 'xlarge'
export type Density = 'compact' | 'cozy' | 'comfortable'
export type TaskView = 'list' | 'tree'

const FONT_SCALE_KEY = 'appearance_font_scale'
const DENSITY_KEY = 'appearance_density'
const TASK_VIEW_KEY = 'appearance_task_view'
const AUTO_REFRESH_KEY = 'appearance_auto_refresh'

/**
 * The previous "特大" is now the standard size; the other two steps keep
 * growing from there.
 */
const FONT_SCALE_VALUE: Record<FontScale, string> = {
  normal: '1.24',
  large: '1.38',
  xlarge: '1.52',
}

const DENSITY_CLASS: Record<Density, string> = {
  compact: 'density-compact',
  cozy: '',
  comfortable: 'density-comfortable',
}

function isFontScale(value: unknown): value is FontScale {
  return value === 'normal' || value === 'large' || value === 'xlarge'
}

function isDensity(value: unknown): value is Density {
  return value === 'compact' || value === 'cozy' || value === 'comfortable'
}

function isTaskView(value: unknown): value is TaskView {
  return value === 'list' || value === 'tree'
}

function isH5(): boolean {
  return process.env.TARO_ENV === 'h5'
}

export function applyFontScale(scale: FontScale): void {
  if (!isH5() || typeof document === 'undefined') return
  document.documentElement.style.setProperty('--font-scale', FONT_SCALE_VALUE[scale])
}

export function applyDensity(density: Density): void {
  if (!isH5() || typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('density-compact', 'density-comfortable')
  const className = DENSITY_CLASS[density]
  if (className) root.classList.add(className)
}

interface AppearanceState {
  fontScale: FontScale
  density: Density
  taskView: TaskView
  autoRefresh: boolean
  init: () => void
  setFontScale: (scale: FontScale) => void
  setDensity: (density: Density) => void
  setTaskView: (view: TaskView) => void
  setAutoRefresh: (enabled: boolean) => void
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  fontScale: 'normal',
  density: 'cozy',
  taskView: 'list',
  autoRefresh: true,

  init: () => {
    const storedFontScale = Taro.getStorageSync(FONT_SCALE_KEY)
    const storedDensity = Taro.getStorageSync(DENSITY_KEY)
    const storedTaskView = Taro.getStorageSync(TASK_VIEW_KEY)
    const storedAutoRefresh = Taro.getStorageSync(AUTO_REFRESH_KEY)

    const fontScale = isFontScale(storedFontScale) ? storedFontScale : 'normal'
    const density = isDensity(storedDensity) ? storedDensity : 'cozy'
    const taskView = isTaskView(storedTaskView) ? storedTaskView : 'list'
    const autoRefresh = typeof storedAutoRefresh === 'boolean' ? storedAutoRefresh : true

    applyFontScale(fontScale)
    applyDensity(density)
    set({ fontScale, density, taskView, autoRefresh })
  },

  setFontScale: (scale: FontScale) => {
    Taro.setStorageSync(FONT_SCALE_KEY, scale)
    applyFontScale(scale)
    set({ fontScale: scale })
  },

  setDensity: (density: Density) => {
    Taro.setStorageSync(DENSITY_KEY, density)
    applyDensity(density)
    set({ density })
  },

  setTaskView: (view: TaskView) => {
    Taro.setStorageSync(TASK_VIEW_KEY, view)
    set({ taskView: view })
  },

  setAutoRefresh: (enabled: boolean) => {
    Taro.setStorageSync(AUTO_REFRESH_KEY, enabled)
    set({ autoRefresh: enabled })
  },
}))
