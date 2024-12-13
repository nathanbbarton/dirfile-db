/**
 * @module DirfileDB
 * @author Nathan Barton
 * @fileoverview This file contains all types, interfaces and class definitions for creating a
 * DirfileDB instance, a filesystem/directory based NoSQL-like database.
 *
 * @exports {
 *     @name DirfileDBConfig
 *     @name KeyValuePair
 *     @name DirfileDBMetadata
 *     @name DirfileDBMetadataFile
 * }
 *
 * @default DirfileDB
 */

/**
 * ------ NodeJs  Dependencies ------
 */

import {
    PathLike,
    statSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    readdirSync
} from "fs"
import {
    mkdir,
    writeFile,
    readFile,
    readdir,
    rm,
    unlink
} from "fs/promises"
import { randomUUID } from "crypto"
import { join } from "path"

/**
 * ------ Local Dependencies ------
 */

import { undefinedReplacer, getPackageVersion, dirExists } from "~/util/index.js"

/**
 * ------ Interfaces and Types ------
 */

/**
 * @interface DirfileDBConfig
 * @description Configuration options for the DirfileDB constructor
 * @property {string} [rootDir] - Relative path to the root directory of the DirfileDB instance.
 */
export interface DirfileDBConfig {
    rootDir?: string
}

/**
 * @type KeyValuePair
 *
 * @description Represents a key-value pair tuple, commonly used in the DirfileDB system to store
 * collection mappings.
 *
 * @template K - The type of the key.
 * @template V - The type of the value.
 */
export type KeyValuePair<K, V> = [K, V]

/**
 * @interface DirfileDBMetadata
 * @description Metadata for a DirfileDB database.
 * @property {string} _id - Unique identifier for the database instance (UUID).
 * @property {string} dbSignature - Signature string to validate a directory is a DirfileDB instance
 * @property {Map<string, PathLike>} collections - A map of collection names to their fs paths.
 * @property {string} version - The version of the DirfileDB client associated with this database.
 */
export interface DirfileDBMetadata {
    readonly _id: string
    readonly dbSignature: string
    collections: Map<string, PathLike>
    version: string
}

/**
 * @interface DirfileDBMetadataFile
 * @description File-based format for DirfileDB metadata. This format is useful for serialization
 * since Maps cannot be directly serialized to JSON. ex: 'new Map(KeyValuePair[])'
 * @extends Omit<DirfileDBMetadata,"collections">
 * @property {KeyValuePair<string, PathLike>[]} collections - An array of key-value pairs
 * representing the name and path of each collection.
 */
export interface DirfileDBMetadataFile extends Omit<DirfileDBMetadata, "collections"> {
    collections: KeyValuePair<string, PathLike>[]
}

/**
 * @type
 * @description A type for the data passed to the `update` function. The `_id` field is required,
 * and any other properties are allowed as they may vary for each document.
 */
type UpdateData = {
    _id: string
    [key: string]: any
}

/**
 * ------ Class Definition ------
 */

/**
 * @class DirfileDB
 * @classdesc
 * A NoSQL-like database implemented using a filesystem directory structure.
 *
 * **Concepts**:
 * - **Database**: Represented as a root directory.
 * - **Collection**: Represented as sub-directories within the root directory.
 * - **Document**: Represented as individual files within a collection.
 *
 * The DirfileDB provides methods to create, read, update, and delete collections and documents.
 *
 * @example
 * ```typescript
 * const db = new DirfileDB()
 * db.newCollection('users')
 * db.create('users', { id: 1, name: 'Alice' })
 * ```
 *
 *
 * @todo add index for faster queries
 * @todo add cache for frequently requested data
 * @todo query needs to handle arrays and objects, detect array/object then string comparison
 * @todo collections directory should have their own metadata file
 */
class DirfileDB {

    // A generic value to scan to confirm a directory is a dirfileDB directory
    static DB_SIGNATURE = "DirfileDB"
    // expected filename of the database metadata file
    static METADATA_FILENAME = "metadata-dirfile-db.json"
    // current version of the running client, should match metadata version
    static VERSION = getPackageVersion()

    // root directory of DirfileDB database
    #rootDir: string
    // metadata about the database instance
    #metadata!: DirfileDBMetadata
    // path to the metadata file
    #metadataPath: PathLike
    // the collections in the database, Map<collection name, collection path>
    #collections: Map<string, PathLike>

    /**
     * @constructor
     * @param {DirfileDBConfig} args
     */
    constructor(args?: DirfileDBConfig) {
        this.#rootDir = args?.rootDir || "./defaultDB"
        this.#collections = new Map<string, PathLike>()
        this.#metadataPath = join(this.#rootDir, DirfileDB.METADATA_FILENAME)

        this.init()
    }

    /**
     * ------ Init/Setup Functions ------
     */

    /**
     * @description Initializes a client instance of DirfileDB.
     * - For a new database instance, it creates the root directory and initializes metadata.
     * - For an existing database structure, it loads metadata and populates in-memory values.
     *
     * @returns {DirfileDBMetadata} The metadata for the initialized or loaded database instance.
     * @throws {Error} Throws an error if the directory structure is invalid or metadata is invalid.
     */
    init(): DirfileDBMetadata {
        try {
            if (!dirExists(this.#rootDir)) {
                mkdirSync(this.#rootDir, { recursive: true })

                this.#initMetadata()

                console.log("initialized database at:", this.#rootDir)
            } else {
                //read dirfile metadata to confirm directory is dirfile-db instance
                const metadata = this.#readMetadataFileSync()

                //Check for unsafe states
                if (metadata.dbSignature !== DirfileDB.DB_SIGNATURE) {
                    throw Error("root directory exists, but could not validate instance metadata")
                }

                if (metadata.version !== DirfileDB.VERSION) {
                    throw Error("metadata version does not match package version")
                }

                //set the in memory metadata
                this.#metadata = metadata

                //initialize existing DB to load collections
                this.#initExistingDB()

                console.log("loaded database from:", this.#rootDir)
            }

            return this.#metadata
        } catch (error) {
            throw Error(`failed to initialize DB: ${error}`)
        }
    }

    /**
     * @private
     * @description Initializes the in-memory collections map by scanning the root directory for
     * subdirectories (which represent collections in DirfileDB). This function is called when the
     * database is initialized from an existing file structure.
     *
     * @throws {Error} Throws an error if there is an issue reading the directory contents.
     */
    #initExistingDB () {
        try {
            const collections = readdirSync(this.#rootDir)

            for (const collection of collections) {
                const collectionPath = join(this.#rootDir, collection)
                const stats = statSync(collectionPath)

                if (stats.isDirectory()) {
                    this.#collections.set(collection, collectionPath)
                }
            }

        } catch (error) {
            console.error("Failed to initialize existing DB:", error)
            throw error
        }
    }

    /**
     * ------ Metadata Functions ------
     */

    /**
     * @private
     * @description Initializes the DirfileDB metadata file by creating a new metadata object and
     * saving it to both the in-memory metadata and the file system for persistence.
     *
     * @throws {Error} Throws an error if writing the metadata file fails.
     */
    #initMetadata () {
        // Create initial metadata
        const metadata: DirfileDBMetadata = {
            _id: randomUUID(),
            dbSignature: DirfileDB.DB_SIGNATURE,
            version: DirfileDB.VERSION,
            collections: new Map<string, PathLike>()
        }

        //save to current instance
        this.#metadata = metadata

        //save to file for persistence
        this.#writeMetadataFileSync()
    }

    /**
     * @private
     * @description Synchronously reads the metadata file from the database directory. It then
     * parses the JSON file and converts it into a DirfileDBMetadata object.
     *
     * @returns {DirfileDBMetadata} The metadata of the DirfileDB instance.
     * @throws {Error} If the metadata file cannot be read or is invalid.
     */
    #readMetadataFileSync(): DirfileDBMetadata | never {
        try {
            const rawMetadata = readFileSync(this.#metadataPath, "utf8")
            const metadataFile = JSON.parse(rawMetadata) as DirfileDBMetadataFile

            // Create a new DirfileDBMetadata object from metadataFile
            const metadata: DirfileDBMetadata = {
                _id: metadataFile._id,
                dbSignature: metadataFile.dbSignature,
                version: metadataFile.version,
                // convert <K, V>[] from metadata file to Map<K, V>
                collections: new Map(metadataFile.collections)
            }

            return metadata
        } catch (error) {
            throw Error(`failed to read metadata file: ${error}` )
        }
    }

    /**
     * @private
     * @description Synchronously writes the current metadata to the metadata file in the database
     * directory. It serializes the DirfileDBMetadata object and saves it in JSON format.
     *
     * @throws {Error} If the metadata file cannot be written.
     */
    #writeMetadataFileSync() {
        try {
            const writeMetadata: DirfileDBMetadataFile = {
                ...this.#metadata,
                collections: Array.from(this.#metadata.collections)
            }

            writeFileSync(
                this.#metadataPath,
                JSON.stringify(writeMetadata, undefinedReplacer, 2),
                { encoding: "utf8" }
            )
        } catch (error) {
            console.error(error)
        }

    }

    /**
     * @private
     * @description Updates the metadata of the DirfileDB instance with the given partial updates.
     * It merges the current metadata with the provided updates and writes the updated
     * metadata to the metadata file.
     *
     * @param {Partial<DirfileDBMetadata>} updates - A partial metadata object containing updates.
     *
     * @throws {Error} If the metadata file cannot be written after the update.
     */
    #updateMetadata(updates: Partial<DirfileDBMetadata>) {
        this.#metadata = {
            ...this.#metadata,
            ...updates
        }

        this.#writeMetadataFileSync()
    }

    /**
     * ------ Collection Functions ------
     */

    /**
     * @description Creates a new collection directory within the database. If the collection
     * already exists, it returns the existing collection path. Otherwise, it creates a new
     * directory and adds the collection to the in-memory collection list and metadata.
     *
     * @param {string} name - The name of the collection to create.
     *
     * @returns {Promise<string | PathLike>} The path of created or existing collection directory.
     * @throws {Error} If there is a failure during the collection creation process.
     */
    async newCollection(name: string): Promise<string | PathLike> {
        try {
            const collection = this.#collections.get(name)
            if (collection) {
                console.log("collection already exists")
                return collection
            }

            const collectionDir = join(this.#rootDir, name)
            await mkdir(collectionDir, { recursive: true })

            this.#collections.set(name, collectionDir)

            this.#updateMetadata({
                collections: this.#collections
            })

            return collectionDir
        } catch (error) {
            console.error("failed to create new collection: ", error)
            throw error
        }
    }

    /**
     * @description Returns the names of all collections stored in the DirfileDB instance.
     *
     * @returns {string[]} An array of collection names.
     */
    listCollections(): string[] { return Array.from(this.#collections.keys()) }

    /**
     * @description Removes the specified collection directory from the filesystem and deletes it
     * from the in-memory collections list. The metadata is updated to reflect collection removal.
     *
     * @param {string} collection - The name of the collection to delete.
     *
     * @returns {Promise<void>} A promise indicating completion.
     * @throws {Error} If the collection does not exist or if deletion fails.
     */
    async deleteCollection(collection: string): Promise<void> {
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

    /**
     * ------ Document Functions ------
     */

    /**
     * @description Creates a new document by converting the data to a JSON string, and saving it
     * as a `.json` file within the specified collection directory. If document _id is not provided
     * a UUID value will be appeneded to the JSON document.
     *
     * @param {string} collection - The name of the collection where the document will be created.
     * @param {any} data - The data to be stored in the new document.
     *
     * @returns {Promise<void>} A promise indicating completion of the document creation process.
     * @throws {Error} If the collection does not exist or there is a document creation failure.
     *
     * @todo return minimal version of created entity id atleast
     * @todo verify id uniqueness from index, fail on existing _id
     */
    async create(collection: string, data: any): Promise<void> {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw Error(`collection ${collection}, does not exist`)

            const id = data._id ?  data._id : randomUUID({ disableEntropyCache: true })

            const jsonDataString = JSON.stringify(data, undefinedReplacer, 2)
            const documentPath = join(collectionPath.toString(), `${id}.json`)

            await writeFile(documentPath, jsonDataString, { encoding: "utf8" })

        } catch (error) {
            console.error(`failed to add data to ${collection}: `, error)
            throw error
        }
    }

    /**
     * @description Searches through the documents in the specified collection directory and returns
     * the first document that matches the query. The query is matched by comparing key-value pairs
     * between the document and the query object.
     *
     * @param {string} collection - The name of the collection to search within.
     * @param {any} query - The query object of key-value pairs to match against documents.
     *
     * @returns {Promise<any | null>} The first document found or `null` if no document is found.
     */
    async find(collection: string, query: any): Promise<any | null> {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw new Error("Collection does not exist")

            const files = await readdir(collectionPath)

            for (const file of files) {
                const filePath = join(collectionPath.toString(), file)
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

    /**
     * @description Searches through all documents in the specified collection directory and returns
     * all documents that match the query. If no query is provided, all documents are returned.
     *
     * @param {string} collection - The name of the collection to search within.
     * @param {any} [query] - The optional query containing key-value pairs to match documents.
     *
     * @returns {Promise<any[]>} A promise that resolves to an array of found documents.
     */
    async findAll(collection: string, query?: any): Promise<any[]> {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw new Error("Collection does not exist")

            const files = await readdir(collectionPath)
            const results: any[] = []

            for (const file of files) {
                const filePath = join(collectionPath.toString(), file)
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
     * @description Updates an existing document in the specified collection by merging the provided
     * `newData` with the existing document, identified by the `_id` field. The document is then
     * rewritten with the updated data.
     *
     * @param {string} collection - The name of the collection that contains the document to update.
     * @param {UpdateData} newData - The data to merge/update the document with.
     *
     * @returns {Promise<any>} A promise that resolves to the updated document.
     *
     * @todo using index verify if id exists, check changes in _id should also throw
     */
    async update(collection: string, newData: UpdateData): Promise<any> {
        try {
            const collectionPath = this.#collections.get(collection)
            if (!collectionPath) throw Error("collection does not exist")
            if (!newData._id) throw Error("missing required _id parameter")

            const filePath = join(collectionPath.toString(), `${newData._id}.json`)

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
     * @description Deletes the first document from the specified collection that matches the
     * provided query. If no document matches the query, no action is taken.
     * This function is a wrapper for the private `#performDelete` function, passing the query
     * and collection to it.
     *
     * @param {string} collection - The name of the collection to delete the document from.
     * @param {any} query - The query containing key-value pairs to match the document to delete.
     *
     * @returns {Promise<void>} A promise that resolves when the document is successfully deleted.
     */
    async delete(collection: string, query: any): Promise<void> {
        try {
            await this.#performDelete(collection, query)
        } catch(error) {
            console.error(`failed to delete document from ${collection}: `, error)
            throw error
        }
    }

    /**
     * @description Deletes all documents from the specified collection that match the provided
     * query. If no documents match the query, no action is taken. This function is a wrapper
     * for the private `#performDelete` function, passing the query and collection to it with the
     * `all` flag set to `true` to delete all matching documents.
     * @param {string} collection - The name of the collection to delete documents from.
     * @param {any} query - The query containing key-value pairs to match the documents to delete.
     *
     * @returns {Promise<void>} A promise that resolves when the documents are successfully deleted.
     */
    async deleteAll(collection: string, query: any): Promise<void> {
        try {
            await this.#performDelete(collection, query, true)
        } catch(error) {
            console.error(`failed to delete document(s) from ${collection}: `, error)
            throw error
        }
    }

    /**
     * @description Performs the deletion of documents from the specified collection based on the
     * provided query. If the `all` flag is set to `true`, all matching documents will be deleted.
     * Otherwise, only the first matching document is deleted.
     *
     * @param {string} collection - The name of the collection to delete documents from.
     * @param {any} query - The query containing key-value pairs to match the documents to delete.
     * @param {boolean} [all=false] - A flag indicating whether to delete all matching documents
     *
     * @returns {Promise<void>} A promise that resolves when the documents are successfully deleted.
     */
    async #performDelete(collection: string, query: any, all: boolean = false): Promise<void> {
        const collectionPath = this.#collections.get(collection)
        if (!collectionPath) throw Error("collection does not exist")

        const files = await readdir(collectionPath)
        console.log("files in collection: ", files)

        for (const file of files) {
            const filePath = join(collectionPath.toString(), file)
            const fileContent = await readFile(filePath, { encoding: "utf8" })
            const document = JSON.parse(fileContent)
            const matches = Object.keys(query).every(key => document[key] === query[key])
            if (matches) {
                await unlink(filePath)

                if (!all) return
            }
        }
    }

    /**
     * ------ Getters/Setters ------
     */

    getRootDir() { return this.#rootDir }
    getMetadata() { return this.#metadata }
    getCollection(name: string) { return this.#collections.get(name) }

}

export default DirfileDB
