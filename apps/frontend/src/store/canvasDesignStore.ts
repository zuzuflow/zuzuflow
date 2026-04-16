import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CanvasTheme = "dark" | "bpmn-light";

interface CanvasDesignState {
  theme: CanvasTheme;
  setTheme: (t: CanvasTheme) => void;
}

export const useCanvasDesignStore = create<CanvasDesignState>()(
  persist(
    (set) => ({
      theme: "dark",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "canvas-design" }
  )
);
