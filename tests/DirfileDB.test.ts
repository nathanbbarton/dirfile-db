import DirfileDB, { DirfileDBMetadataFile, KeyValuePair } from "../src/DirfileDB.js"
import path from "path"
import assert from "node:assert"
import { readFile } from "node:fs/promises"
import { test } from "@kistools/test"
import { PathLike, readFileSync } from "node:fs"

//directory to contain all test DirfileDB databases
const rootTestDbsDir = "./testDBs/"

//short form helper function
const newDB = (rootDir: string) => new DirfileDB({ rootDir })

const constructorDBDir = `${rootTestDbsDir}.constructorDB`
test("constructor", {
    subTests: [
        test("creates new db dir", () => {
            const testDB = newDB(constructorDBDir)
            assert.equal(testDB.getRootDir(), constructorDBDir)
        }),

        test("fails on invalid dir string", () => {
            const invalidStr = "\0dir/CON:/*?|" // Invalid on both Windows and Linux

            assert.throws(() => new DirfileDB({rootDir: invalidStr})) 
        }),

        test("should persist metadata when connecting to existing db", () => {
            const testDB = newDB(constructorDBDir)
            const newDBMetadata = testDB.getMetadata()

            const reconnectDB = newDB(constructorDBDir)
            const reconnectDBMetadata = reconnectDB.getMetadata()

            assert.deepEqual(newDBMetadata, reconnectDBMetadata)
        })
    ]
})

const newCollectionDBDir = `${rootTestDbsDir}.newCollectionDB`
test("newCollection", {
    subTests: [
        test("successfully creates a new collection", async () => {
            const createNewCollection = "create-new-collection"

            const testDB = newDB(newCollectionDBDir)

            const collectionPath = await testDB.newCollection(createNewCollection)
    
            assert.equal(
                collectionPath,
                path.join(testDB.getRootDir(), createNewCollection)
            )
        }),

        test("creating a new collection should update in memory metadata", async () => {
            const collectionInMemoryMetadata = "collection-in-memory-metadata"

            const testDB = newDB(newCollectionDBDir)

            await testDB.newCollection(collectionInMemoryMetadata)
    
            assert(testDB.getMetadata().collections.has(collectionInMemoryMetadata))
        }),

        test("creating a new collection should update metadata file", async () => {
            const updateMetadataStr = "update-metadata-collection"

            const testDB = newDB(newCollectionDBDir)
            
            await testDB.newCollection(updateMetadataStr)
    
            const metadataFilePath = path.resolve(newCollectionDBDir, DirfileDB.METADATA_FILENAME)
            const rawMetadata = readFileSync(metadataFilePath, { encoding: "utf8" })
            const metadataFile = JSON.parse(rawMetadata) as DirfileDBMetadataFile
    
            const containsCollection = metadataFile.collections.some(
                (pair: KeyValuePair<string, PathLike>) => pair[0] === updateMetadataStr)
    
            assert(containsCollection)
        }),

        test("doesn't overwrite existing collection", async () => {
            try {
                const collectionStr = "existing-collection"
    
                const testDB = newDB(newCollectionDBDir)
                await testDB.newCollection(collectionStr)  // Expect this to succeed
                await testDB.newCollection(collectionStr)  // This should throw an error
        
                assert(false)  // This should never be reached
            } catch (error) {
                assert(true)  // Pass the test
            }
        })
    ]
})

const createDocumentDBDir = `${rootTestDbsDir}.createDocumentDB`
const createCollection = "create-document-collection"
test("create", {
    subTests: [
        test("successfully creates new document file in collection directory", async () => {
            const testDB = newDB(createDocumentDBDir)

            await testDB.newCollection(createCollection)

            const _id = "create-new-document-file"
            const testData = {
                _id,
                value: "test",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }
            const collectionPath = testDB.getCollection(createCollection)

            await testDB.create(createCollection, testData)

            const file = await readFile(
                path.join(collectionPath!.toString(), `${_id}.json`),
                { encoding: "utf8" }
            )

            const json = JSON.parse(file)

            assert.equal(JSON.stringify(testData), JSON.stringify(json))
        }),

        test("preserve undefined as null when writing to collection", async () => {
            const _id = "ljkadfnasdklf"

            const testData = {
                _id,
                value: "test",
                empty: undefined
            }
            const expectedData = {
                _id,
                value: "test",
                empty: null
            }

            const testDB = newDB(createDocumentDBDir)
            const collectionPath = testDB.getCollection(createCollection)
            await testDB.create(createCollection, testData)

            const file = await readFile(
                path.join(collectionPath!.toString(), `${_id}.json`),
                { encoding: "utf8" }
            )
            const json = JSON.parse(file)

            assert.equal(JSON.stringify(json), JSON.stringify(expectedData))
        }),

        test("fails to create document when given non-existent collection", async () => {
            try {
                const testDB = newDB(createDocumentDBDir)

                await testDB.create("non-existent-collection", { key: "value" })
                assert(false)
            } catch (error) {
                assert(true) //expected failure
            }
        })
    ]
})

const listCollectionDBDir = `${rootTestDbsDir}.listCollectionDB`
test("listCollections", {
    subTests: [
        test("successfully lists all available collections", async () => {
            const testDB = newDB(listCollectionDBDir)
            const collection1 = "collection1"
            const collection2 = "collection2"

            await testDB.newCollection(collection1)
            await testDB.newCollection(collection2)

            const collections = new Set(testDB.listCollections())

            assert(collections.has(collection1) && collections.has(collection2))
        })
    ]
})

const findDBDir = `${rootTestDbsDir}.findDB`
const findCollection = "find-collection"
test("find", {
    subTests: [
        test("successfully return a found document", async () => {
            const testData = {
                _id: "findtestId",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            const testDB = newDB(findDBDir)
            await testDB.newCollection(findCollection)
            await testDB.create(findCollection, testData)
            const document = await testDB.find(findCollection, { _id: "findtestId" })

            assert.equal(JSON.stringify(testData), JSON.stringify(document))
        }),

        test("returns only first found document", async () => {

            const testData = {
                _id: "id1",
                value: "test",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }
            const testData2 = {
                _id: "id2",
                value: "test",
                "thing1": 4,
                thing2: 1,
                array: ["text"],
                object: { key: "stuff"},
            }

            const testDB = newDB(findDBDir)
            await testDB.newCollection(findCollection)
            await testDB.create(findCollection, testData)
            await testDB.create(findCollection, testData2)
            const document = await testDB.find(findCollection, { value: "test" })

            assert.equal(JSON.stringify(testData), JSON.stringify(document))
        })
    ]
})

const findAllDBDir = `${rootTestDbsDir}.findAllDB`
const findAllCollection = "find-all-collection"
test("findAll", {
    subTests: [
        test("returns all matching documents", async () => {
            const testData = {
                _id: "id1",
                value: "test",
                "thing1": 1,
                thing2: 1,
                array: ["item"],
                object: { key: "value"},
            }
            const testData2 = {
                _id: "id2",
                value: "test",
                "thing1": 4,
                thing2: 1,
                array: ["text"],
                object: { key: "stuff"},
            }

            const testDB = newDB(findAllDBDir)
            await testDB.newCollection(findAllCollection)

            await testDB.create(findAllCollection, testData)
            await testDB.create(findAllCollection, testData2)
            const documents = await testDB.findAll(findAllCollection, { thing2: 1 })

            assert.equal(documents.length, 2)
        })
    ]
})

const updateDBDir = `${rootTestDbsDir}.updateDB`
const updateCollection = "update-collection"
test("update", {
    subTests: [
        test("successfully appends data to a document", async () => {
            const _id = "add-to-existing-id"
            const testData = {
                _id,
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            const testDB = newDB(updateDBDir)
            await testDB.newCollection(updateCollection)
            await testDB.create(updateCollection, testData)
            await testDB.update(
                updateCollection,
                { _id, new: "data", add: "add" }
            )

            const document = await testDB.find(updateCollection, { new: "data" })

            assert(document)
            assert.equal(document.add, "add")
        }),

        test("successfully updates existing data in a document", async () => {
            const _id = "update-existing-id"
            const testData = {
                _id,
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            const testDB = newDB(updateDBDir)
            await testDB.newCollection(updateCollection)
            await testDB.create(updateCollection, testData)
            await testDB.update(
                updateCollection,
                { _id, thing2: 5 }
            )

            const document = await testDB.find(updateCollection, { _id })
            assert(document)
            assert.equal(document.thing2, 5)
        }),

        test("returns null if no document is found", async () => {
            const _id = "expect-null-id"
            const testData = {
                _id,
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            const testDB = newDB(updateDBDir)
            await testDB.newCollection(updateCollection)
            await testDB.create(updateCollection, testData)

            const document = await testDB.find(updateCollection, { _id: "invalid _id" })
            assert(!document)
        })
    ]
})

const deleteCollectionDBDir = `${rootTestDbsDir}.deleteCollectionDB`
test("deleteCollection", {
    subTests: [
        test("successfully removes existing collection", async () => {
            const collection = "deleteCollection"
            const collection2 = "deleteCollection2"

            const testDB = newDB(deleteCollectionDBDir)

            await testDB.newCollection(collection)
            await testDB.newCollection(collection2)

            await testDB.deleteCollection(collection)

            const collections = new Set(testDB.listCollections())

            assert(!collections.has(collection))
            assert(collections.has(collection2))
        })
    ]
})


const deleteDBDir = `${rootTestDbsDir}.deleteDB`
const deleteCollection = "delete-collection"
test("delete", {
    subTests: [
        test("successfully deletes first document that matches query", async () => {
            const testData = {
                value: "test",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value" },
            }
            const testDB = newDB(deleteDBDir)
            await testDB.newCollection(deleteCollection)

            await testDB.create(deleteCollection, testData)
            await testDB.delete(deleteCollection, { value: "test" })

            const document = await testDB.find(deleteCollection, { value: "test" })
            assert(!document)
        })
    ]
})


const deleteAllDBDir = `${rootTestDbsDir}.deleteAllDB`
const deleteAllCollection = "delete-all-collection"
test("deleteAll", {
    subTests: [
        test("successfully deletes all matching documents", async () => {

            const testData = {
                value: "test",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value" },
            }

            const testDB = newDB(deleteAllDBDir)
            await testDB.newCollection(deleteAllCollection)

            await testDB.create(deleteAllCollection, testData)
            await testDB.create(deleteAllCollection, testData)
            await testDB.create(deleteAllCollection, testData)

            await testDB.deleteAll(deleteAllCollection, { value: "test" })

            const documents = await testDB.findAll(deleteAllCollection)
            assert.equal(documents.length, 0)
        })
    ]
})
