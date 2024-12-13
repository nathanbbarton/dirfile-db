import pkgJson from  "../../package.json" assert { type: "json" }

/**
 * @description Utility function for extracting the package version from its package.json file
 * 
 * @returns {string} The string version from package.json
 */
const getPackageVersion = (): string => pkgJson.version

export default getPackageVersion
