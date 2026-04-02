
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadLuaScript(filename: string): string {
  try {
    return readFileSync(join(__dirname, filename), "utf8");
  } catch (err) {
    // Fallback for development if ts-node handles paths differently
    return readFileSync(join(process.cwd(), "src/store/lua", filename), "utf8");
  }
}

export const slidingWindowLua = loadLuaScript("slidingWindow.lua");
export const tokenBucketLua = loadLuaScript("tokenBucket.lua");
export const fixedWindowLua = loadLuaScript("fixedWindow.lua");

