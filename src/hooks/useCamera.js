import { create } from 'zustand'

const useCamera = create((set) => ({
  viewMode: 'fly', // 'fly', 'plan', 'street'

  setViewMode: (mode) => set({ viewMode: mode }),
}))

export default useCamera
