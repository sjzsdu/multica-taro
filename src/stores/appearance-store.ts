import { create } from 'zustand'
import Taro from '@tarojs/taro'

export type FontScale = 'normal' | 'large' | 'xlarge'
export type Density = 'compact' | 'cozy' | 'comfortable'
export type TaskView = 'list' | 'tree'
export type Theme = 'light' | 'dark' | 'system'

const FONT_SCALE_KEY = 'appearance_font_scale'
const DENSITY_KEY = 'appearance_density'
const TASK_VIEW_KEY = 'appearance_task_view'
const AUTO_REFRESH_KEY = 'appearance_auto_refresh'
const THEME_KEY = 'appearance_theme'

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

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
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

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(theme: Theme): void {
  if (!isH5() || typeof document === 'undefined') return
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('theme-dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

let systemThemeQuery: MediaQueryList | null = null

function watchSystemTheme(): void {
  if (!isH5() || typeof window === 'undefined' || !window.matchMedia) return
  if (systemThemeQuery) return
  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemThemeQuery.addEventListener('change', () => {
    if (useAppearanceStore.getState().theme === 'system') {
      applyTheme('system')
    }
  })
}

interface AppearanceState {
  fontScale: FontScale
  density: Density
  taskView: TaskView
  autoRefresh: boolean
  theme: Theme
  init: () => void
  setFontScale: (scale: FontScale) => void
  setDensity: (density: Density) => void
  setTaskView: (view: TaskView) => void
  setAutoRefresh: (enabled: boolean) => void
  setTheme: (theme: Theme) => void
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  fontScale: 'normal',
  density: 'cozy',
  taskView: 'list',
  autoRefresh: true,
  theme: 'light',

  init: () => {
    const storedFontScale = Taro.getStorageSync(FONT_SCALE_KEY)
    const storedDensity = Taro.getStorageSync(DENSITY_KEY)
    const storedTaskView = Taro.getStorageSync(TASK_VIEW_KEY)
    const storedAutoRefresh = Taro.getStorageSync(AUTO_REFRESH_KEY)
    const storedTheme = Taro.getStorageSync(THEME_KEY)

    const fontScale = isFontScale(storedFontScale) ? storedFontScale : 'normal'
    const density = isDensity(storedDensity) ? storedDensity : 'cozy'
    const taskView = isTaskView(storedTaskView) ? storedTaskView : 'list'
    const autoRefresh = typeof storedAutoRefresh === 'boolean' ? storedAutoRefresh : true
    const theme = isTheme(storedTheme) ? storedTheme : 'light'

    applyFontScale(fontScale)
    applyDensity(density)
    applyTheme(theme)
    watchSystemTheme()
    set({ fontScale, density, taskView, autoRefresh, theme })
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

  setTheme: (theme: Theme) => {
    Taro.setStorageSync(THEME_KEY, theme)
    applyTheme(theme)
    set({ theme })
  },
}))
