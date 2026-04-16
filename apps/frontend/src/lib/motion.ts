import type { Transition, Variants } from "framer-motion";

export const spring = {
  gentle: { type: "spring", stiffness: 300, damping: 30 } as Transition,
  snappy: { type: "spring", stiffness: 500, damping: 30 } as Transition,
  bouncy: { type: "spring", stiffness: 400, damping: 20, mass: 0.8 } as Transition,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const slideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
};

export const slideRight = {
  initial: { x: "100%" },
  animate: { x: 0 },
  exit: { x: "100%" },
};

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
};
