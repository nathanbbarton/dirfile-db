import esbuild from "esbuild"
import path from "path"

const sharedOptions = {
    entryPoints: ["./src/DirfileDB.ts"],
    bundle: true,
    platform: "node",
    external: ["fs", "fs/promises", "path", "crypto"],
    tsconfig: path.resolve("./configs/tsconfig.build.json")
}

const cjsOptions = {
    ...sharedOptions,
    outfile: "./dist/cjs/index.cjs",
    format: "cjs"
}

const esmOptions = {
    ...sharedOptions,
    outfile: "./dist/esm/index.mjs",
    format: "esm"
}

// Build CommonJS
esbuild.build(cjsOptions).catch(() => process.exit(1))

// Build ESM
esbuild.build(esmOptions).catch(() => process.exit(1))
