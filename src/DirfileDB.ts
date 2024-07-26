import { PathLike } from "fs"
import { mkdir, writeFile, readFile, readdir, rm, unlink } from "fs/promises"
import { randomUUID } from "crypto"
import path from "path"
import undefinedReplacer from "~/util/undefinedReplacer"

interface DirfileDBConfig {
    rootDir?: string
}

/**
 * A directory/file-system NoSQL database.
 * database = directory
 * collection = directory
 * document = file
 */
class DirfileDB {

    #rootDir: string
    #collections: Map<string, PathLike> // key= collection name, value = collection file path
    //TODO add index for faster queries
    //TODO add cache for frequently requested data

    constructor(args?: DirfileDBConfig) {
        this.#rootDir = args?.rootDir || "./defaultDB"
        this.#collections = new Map<string, PathLike>()
    }

    getRootDir() { return this.#rootDir }
    getCollection(name: string) { return this.#collections.get(name) }

    async init() {
        //create root dir for the DirDB
        try {
            await mkdir(this.#rootDir, { recursive: true })
            return this.#rootDir
        } catch (error) {
            console.error("failed to init new db: ", error)
            throw error
        }
    }

    async newCollection(name: string): Promise<string | undefined> {
        try {
            const collection = this.#collections.get(name)
            if (collection) throw Error("collection already exists")

            const collectionDir = path.join(this.#rootDir, name)
            await mkdir(collectionDir, { recursive: true })
            console.log("new collection created: ", name)

            this.#collections.set(name, collectionDir)

            return collectionDir
        } catch (error) {
            console.error("failed to create new collection: ", error)
            throw error
        }
    }

    /**
     * CREATE Functions
     */

    async create(collection: string, data: any) {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw Error(`collection ${collection}, does not exist`)

            const id = data._id ?  data._id : randomUUID({ disableEntropyCache: true })
            //TODO verify id uniqueness from index, fail on existing _id

            const jsonDataString = JSON.stringify(data, undefinedReplacer, 2)
            const documentPath = path.join(collectionPath.toString(), `${id}.json`)

            await writeFile(documentPath, jsonDataString, { encoding: "utf8" })

        } catch (error) {
            console.error(`failed to add data to ${collection}: `, error)
            throw error
        }
    }

    /**
     * READ Functions
     */

    listCollections() { return Array.from(this.#collections.keys()) }

    //TODO query needs to handle arrays and objects, detect array/object then string comparison?

    async find(collection: string, query: any) {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw new Error("Collection does not exist")

            const files = await readdir(collectionPath)

            for (const file of files) {
                const filePath = path.join(collectionPath.toString(), file)
                const fileContent = await readFile(filePath, "utf8")
                const document = JSON.parse(fileContent)
                const matches = Object.keys(query).every(key => document[key] === query[key])
                if (matches) {
                    return document
                }
            }

            return null // Return null if no document matches the query
        } catch (error) {
            console.error(`Failed to find data in ${collection}: `, error)
            throw error
        }
    }

    async findAll(collection: string, query?: any) {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw new Error("Collection does not exist")

            const files = await readdir(collectionPath)
            const results: any[] = []

            for (const file of files) {
                const filePath = path.join(collectionPath.toString(), file)
                const fileContent = await readFile(filePath, "utf8")
                const document = JSON.parse(fileContent)

                if (!query || Object.keys(query).every(key => document[key] === query[key])) {
                    results.push(document)
                }
            }

            return results
        } catch (error) {
            console.error(`Failed to find data in ${collection}: `, error)
            throw error
        }
    }

    /**
     * UPDATE Functions
     */

    async update(collection: string, newData: any): Promise<any> {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw Error("collection does not exist")
            if (!newData._id) throw Error("missing required _id parameter")
            //TODO using index verify if id exists, check changes in _id should also throw

            const filePath = path.join(collectionPath.toString(), `${newData._id}.json`)

            const documentFile = await readFile(filePath, { encoding: "utf8" })
            const documentJSON = JSON.parse(documentFile)

            const updatedDocument = Object.assign(documentJSON, newData)

            await writeFile(
                filePath,
                JSON.stringify(updatedDocument, undefinedReplacer, 2),
                { encoding: "utf8" }
            )

            return updatedDocument
        } catch (error) {
            console.error(`failed to update data in ${collection}: `, error)
            throw error
        }
    }

    /**
     * DELETE Functions
     */

    async deleteCollection(collection: string) {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw Error("collection does not exist")

            await rm(collectionPath, { recursive: true, force: true })
            this.#collections.delete(collection)
        } catch (error) {
            console.error(`failed to delete collection ${collection}: `, error)
            throw error
        }
    }

    async delete(collection: string, query: any) {
        try {
            await this.#performDelete(collection, query)
        } catch(error) {
            console.error(`failed to delete document from ${collection}: `, error)
            throw error
        }
    }

    async deleteAll(collection: string, query: any) {
        try {
            await this.#performDelete(collection, query, true)
        } catch(error) {
            console.error(`failed to delete document(s) from ${collection}: `, error)
            throw error
        }
    }

    async #performDelete(collection: string, query: any, all = false) {
        const collectionPath = this.#collections.get(collection)
        if (!collectionPath) throw Error("collection does not exist")

        const files = await readdir(collectionPath)
        console.log("files in collection: ", files)

        for (const file of files) {
            const filePath = path.join(collectionPath.toString(), file)
            const fileContent = await readFile(filePath, { encoding: "utf8" })
            const document = JSON.parse(fileContent)
            const matches = Object.keys(query).every(key => document[key] === query[key])
            if (matches) {
                await unlink(filePath)

                if (!all) return
            }
        }
    }
}

export default DirfileDB
