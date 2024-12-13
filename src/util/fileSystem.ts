import { statSync, PathLike } from "fs"

/**
 * @description returns whether a directory exists or not
 * 
 * @param dir Directory path to test if it exists
 * @returns {boolean} Whether the directory exists or not
 */
const dirExists = (dir: PathLike): boolean => {
    try {
        return statSync(dir).isDirectory()
    } catch (error) {
        return false
    }
}

export {
    dirExists
}
