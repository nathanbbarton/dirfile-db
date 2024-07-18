import path from "path"
import TsConfigsPathPlugin from "tsconfig-paths-webpack-plugin"

const prodConfig = {
    mode: "production",
    entry: "./src/DirfileDB.ts",
    experiments: {
        outputModule: true
    },
    output: {
        path: path.resolve("./dist"),
        filename: "index.js",
        library: {
            type: "module"
        },
        chunkFormat: "module"
    },
    resolve: {
        extensions: [".js", ".ts"],
        plugins: [ new TsConfigsPathPlugin()]
    },
    module: {
        rules: [
            {
                test: /\.ts$/, // Handle .ts files
                use: ["ts-loader"],
                exclude: /node_modules/
            }
        ],
    },
    target: "node", // Specify the target environment
    externals: [], // Define external dependencies here if any
    plugins: []
}

export default prodConfig
