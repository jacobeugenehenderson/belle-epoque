import { create } from 'zustand'

const useSelectedBuilding = create((set) => ({
  selectedId: null,
  hoveredId: null,

  select: (id) => set({ selectedId: id }),
  deselect: () => set({ selectedId: null }),

  setHovered: (id) => set({ hoveredId: id }),
  clearHovered: () => set({ hoveredId: null }),
}))

export default useSelectedBuilding
