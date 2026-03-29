import { cpSync, mkdirSync } from "fs";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

// Copy manifest.json
cpSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));

// Copy icons
mkdirSync(resolve(dist, "icons"), { recursive: true });
cpSync(resolve(root, "icons"), resolve(dist, "icons"), { recursive: true });

console.log("Assets copied to dist/");
