import { registerPlugin } from "@capacitor/core";
const native = typeof window !== "undefined" && window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform();
window.PESNativeUpdater = native ? registerPlugin("PESUpdater") : null;
