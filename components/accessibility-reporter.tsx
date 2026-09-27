"use client";

import React, { useEffect } from "react";

export function AccessibilityReporter() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" &&
      typeof window !== "undefined"
    ) {
      Promise.all([
        import("react"),
        import("react-dom"),
        import("@axe-core/react"),
      ]).then(([React, ReactDOM, axe]) => {
        axe.default(React, ReactDOM, 1000);
      });
    }
  }, []);

  return null;
}
