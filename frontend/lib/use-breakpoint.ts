"use client";

import { useEffect, useState } from "react";

/**
 * True when the viewport is below Tailwind's `sm` breakpoint (640px).
 *
 * Charts need this because their sizing is done in JavaScript, not CSS —
 * a category axis reserved at 116px is fine in a desktop card but swallows
 * most of a 340px-wide phone card, leaving almost no room for the bars.
 *
 * Starts `false` so server and first client render agree (no hydration
 * mismatch); the real value lands immediately after mount.
 */
export function useIsMobile(query = "(max-width: 639px)"): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return isMobile;
}
