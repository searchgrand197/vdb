import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DEFAULT_MODE = 'light'
const DEFAULT_PORTAL_THEME = 'staff'

export const useThemeStore = create(
  persist(
    (set) => ({
      mode: DEFAULT_MODE,
      activePortalTheme: DEFAULT_PORTAL_THEME,
      setMode: (mode) => set({ mode: mode === 'dark' ? 'dark' : 'light' }),
      toggleMode: () => set((state) => ({ mode: state.mode === 'dark' ? 'light' : 'dark' })),
      setActivePortalTheme: (themeKey) =>
        set({ activePortalTheme: String(themeKey || DEFAULT_PORTAL_THEME).toLowerCase() }),
      resetThemeState: () => set({ mode: DEFAULT_MODE, activePortalTheme: DEFAULT_PORTAL_THEME }),
    }),
    {
      name: 'hms-theme',
      partialize: (state) => ({
        mode: state.mode,
        activePortalTheme: state.activePortalTheme,
      }),
    },
  ),
)

