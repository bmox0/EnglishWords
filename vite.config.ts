import {createHash} from "node:crypto"
import {readdirSync, readFileSync} from "node:fs"
import {resolve} from "node:path"
import {fileURLToPath} from "node:url"

import vue from "@vitejs/plugin-vue"
import {defineConfig} from "vitest/config"

import type {Plugin} from "vite"

/** Builds `src/sw.js` into `sw.js`, filling in every built and public file to precache and a version that changes with their content. */
function serviceWorker(): Plugin {
  let publicDir = ""
  return {
    name: "service-worker",
    apply: "build",
    enforce: "post",
    configResolved(config) {
      publicDir = config.publicDir
    },
    generateBundle(_, bundle) {
      const files = new Map<string, string | Uint8Array>()
      for (const [name, output] of Object.entries(bundle)) files.set(name, output.type === "chunk" ? output.code : output.source)
      for (const entry of readdirSync(publicDir, {withFileTypes: true})) {
        if (entry.isFile() && !entry.name.startsWith(".")) files.set(entry.name, readFileSync(resolve(publicDir, entry.name)))
      }
      const template = readFileSync(fileURLToPath(new URL("src/sw.js", import.meta.url)), "utf8")
      const names = [...files.keys()].sort()
      const hash = createHash("sha256").update(template)
      for (const name of names) hash.update(name).update(files.get(name) ?? "")
      const precache = ["./", ...names.filter((name) => name !== "index.html").map((name) => `./${name}`)]
      const source = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace("__PRECACHE__", JSON.stringify(precache))
      this.emitFile({type: "asset", fileName: "sw.js", source})
    },
  }
}

export default defineConfig({
  base: "./",
  plugins: [vue(), serviceWorker()],
  test: {
    include: ["src/**/*.test.ts"],
  },
})
