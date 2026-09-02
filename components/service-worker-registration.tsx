"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, which exists so that the browser offers to
 * install the app on a phone. Working offline is out of scope.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
