"use client";

import { useEffect } from "react";

export default function DevUseEffectWatcher() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const orig = console.error;

    console.error = (...args: any[]) => {
      try {
        const msg = args[0];
        if (
          typeof msg === "string" &&
          msg.includes(
            "The final argument passed to useEffect changed size between renders"
          )
        ) {
          // Capture a stack for debugging and also send to original console
          const stack = new Error("useEffect size-change detected").stack;
          orig(
            "[DevUseEffectWatcher] useEffect size-change warning detected:",
            ...args
          );
          orig("Captured stack:", stack);
          // Helpful hint: include component stack if available
          if ((globalThis as any).__DEV_USE_EFFECT_STACKS__) {
            (globalThis as any).__DEV_USE_EFFECT_STACKS__.push({ msg, stack });
          } else {
            (globalThis as any).__DEV_USE_EFFECT_STACKS__ = [{ msg, stack }];
          }
        } else {
          orig(...args);
        }
      } catch (e) {
        orig(...args);
      }
    };

    return () => {
      console.error = orig;
    };
  }, []);

  return null;
}
