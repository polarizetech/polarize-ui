import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { Plugin } from "vite"

/**
 * Demo data is NOT in this repository. Each dataset folder holds a SOURCE.json naming a public
 * URL and the sha256 of what lives there; `import data from "virtual:dataset/<name>"` fetches it
 * when Storybook builds (or starts), refuses it if the hash differs, and caches it under
 * node_modules/.cache so a rebuild works offline once the file has been seen.
 * Fetching at build time rather than in the browser means the live Storybook never depends on
 * the bucket answering, and the bucket needs no CORS rule.
 */
const PREFIX = "virtual:dataset/"

export function datasets(root: string): Plugin {
  const cacheDir = path.join(root, "node_modules", ".cache", "polarize-datasets")
  return {
    name: "polarize-ui:virtual-datasets",
    resolveId(id) {
      return id.startsWith(PREFIX) ? "\0" + id : undefined
    },
    async load(id) {
      if (!id.startsWith("\0" + PREFIX)) return undefined
      const name = id.slice(PREFIX.length + 1)
      if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`dataset name ${JSON.stringify(name)} is not a folder name`)
      const src = JSON.parse(readFileSync(path.join(root, "stories", "datasets", name, "SOURCE.json"), "utf8"))
      const want: string = src.data_sha256
      const cached = path.join(cacheDir, `${want}.json`)
      let body: Buffer
      if (existsSync(cached)) {
        body = readFileSync(cached)
      } else {
        const r = await fetch(src.url)
        if (!r.ok) throw new Error(`dataset ${name}: GET ${src.url} returned ${r.status}`)
        body = Buffer.from(await r.arrayBuffer())
      }
      const got = createHash("sha256").update(body).digest("hex")
      if (got !== want) throw new Error(`dataset ${name}: sha256 ${got} does not match SOURCE.json's ${want}; refusing it`)
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(cached, body)
      return `export default ${body.toString("utf8")}`
    },
  }
}
