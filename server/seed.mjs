import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
await mkdir(resolve(root, "data"), { recursive: true });
await copyFile(resolve(root, "data", "warden-state.json"), resolve(root, "data", "warden-state.dev.json"));
console.log("Seeded data/warden-state.dev.json");
