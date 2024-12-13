import esbuild from "esbuild"
import path from "path"

const testOptions = {
    entryPoints: ["./tests/**/*.test.ts"],
    bundle: true,
    platform: "node",
    tsconfig: path.resolve("./tsconfig.json"),
    format: "esm",
    outdir: "dist/tests"
}

// Build ESM
esbuild.build(testOptions).catch(() => process.exit(1))
