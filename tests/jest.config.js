const config = {
    // Uses ts-jest preset to handle TypeScript files
    preset: "ts-jest",
    // Pattern to locate test files
    testMatch: [
        "**/tests/**/*.test.ts"
    ],
    // Transforms TypeScript test files using ts-jest
    transform: {
        "^.+\\.test\\.ts$": [
            "ts-jest",
            // Uses this tsconfig file for tests
            { "tsconfig": "./configs/tsconfig.test.json" }
        ]
    },
    modulePaths: ["<rootDir>"],
    moduleNameMapper: {
        "~/(.*)": "<rootDir>/../src/$1" // '..' comes from this config being in tests/
    }
}

export default config
