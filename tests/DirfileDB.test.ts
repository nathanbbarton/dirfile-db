import DirfileDB from "../src/DirfileDB"
import path from "path"
import { readFile } from "node:fs/promises"
import { expect, test, describe, beforeAll, afterEach } from "@jest/globals"

describe("dir-db", () => {

    let testDB: DirfileDB
    const testDbRootDir = "./testDB"

    beforeAll(() => {
        testDB = new DirfileDB({ rootDir: testDbRootDir })
        testDB.init()
    })

    describe("init", () => {

        test("creates new db dir on success ", async () => {
            expect(testDB.getRootDir()).toEqual(testDbRootDir)
        })

        test("fails on invalid dir string", async () => {
            try {
                const badDB = new DirfileDB({rootDir: " 11 1f248914f@#$%^&*'z  . . ."})
                await badDB.init()
            } catch (error) {
                expect(error).toBeDefined()
            }
        })
    })

    describe("newCollection", () => {
        const testCollection = "test-collection"

        test("successfully creates a new collection", async () => {
            const collectionPath = await testDB.newCollection(testCollection)

            expect(collectionPath).toEqual(path.join(testDB.getRootDir(), testCollection))
        })

        test("doesn't overwrite existing collection", async () => {
            try {
                await testDB.newCollection(testCollection)
                await testDB.newCollection(testCollection)
            } catch (error) {
                expect(error).toBeDefined()
            }
        })

        afterEach(async () => {
            testDB.deleteCollection(testCollection)
        })
    })

    describe("create", () => {
        const createCollection = "create-test-collection"

        beforeAll(async () => {
            await testDB.newCollection(createCollection)
        })

        test("successfully creates new data file in collection", async () => {
            const _id = "1238120"
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

            expect(JSON.stringify(testData)).toEqual(JSON.stringify(json))
        })

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

            const collectionPath = testDB.getCollection(createCollection)
            await testDB.create(createCollection, testData)

            const file = await readFile(
                path.join(collectionPath!.toString(), `${_id}.json`),
                { encoding: "utf8" }
            )
            const json = JSON.parse(file)

            expect(JSON.stringify(json)).toEqual(JSON.stringify(expectedData))
        })
    })

    describe("listCollections", () => {

        test("successfully lists all available collections", async () => {
            const collection = "collection1"
            const collection2 = "collection2"

            await testDB.newCollection(collection)
            await testDB.newCollection(collection2)

            const collections = testDB.listCollections()

            expect(collections).toContain(collection)
            expect(collections).toContain(collection2)
        })
    })

    describe("find", () => {
        const findCollection = "find-test-collection"

        beforeAll(async () => {
            await testDB.newCollection(findCollection)
        })

        test("successfully return a found document", async () => {
            const testData = {
                _id: "findtestId",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            await testDB.create(findCollection, testData)
            const document = await testDB.find(findCollection, { _id: "findtestId" })

            expect(JSON.stringify(testData) === JSON.stringify(document)).toEqual(true)
        })

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

            await testDB.create(findCollection, testData)
            await testDB.create(findCollection, testData2)
            const document = await testDB.find(findCollection, { value: "test" })

            expect(JSON.stringify(testData) === JSON.stringify(document)).toEqual(true)
        })

    })

    describe("findAll", () => {

        const findAllCollection = "findAll-test-collection"

        beforeAll(async () => {
            await testDB.newCollection(findAllCollection)
        })

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

            await testDB.create(findAllCollection, testData)
            await testDB.create(findAllCollection, testData2)
            const documents = await testDB.findAll(findAllCollection, { thing2: 1 })

            expect(documents.length).toEqual(2)

        })
    })

    describe("update", () => {

        const updateCollection = "update-test-collection"

        beforeAll(async () => {
            await testDB.newCollection(updateCollection)
        })

        test("successfully appends data to a document", async () => {
            const _id = "add-to-existing-id"
            const testData = {
                _id,
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            await testDB.create(updateCollection, testData)
            await testDB.update(
                updateCollection,
                { _id, new: "data", add: "add" }
            )

            const document = await testDB.find(updateCollection, { new: "data" })
            expect(document).toBeDefined()
        })

        test("successfully updates existing data in a document", async () => {
            const _id = "update-existing-id"
            const testData = {
                _id,
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            await testDB.create(updateCollection, testData)
            await testDB.update(
                updateCollection,
                { _id, thing2: 5 }
            )

            const document = await testDB.find(updateCollection, { _id })
            expect(document).toBeDefined()
            expect(document?.thing2).toEqual(5)
        })

        test("returns null if no document is found", async () => {
            const _id = "expect-null-id"
            const testData = {
                _id,
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value"},
            }

            await testDB.create(updateCollection, testData)
            await testDB.update(
                updateCollection,
                { _id, thing2: 5 }
            )

            const document = await testDB.find(updateCollection, { _id: "invalid _id" })
            expect(document).toBeNull()
        })
    })

    describe("deleteCollection", () => {

        test("successfully removes existing collection", async () => {
            const collection = "deleteCollection"
            const collection2 = "deleteCollection2"

            await testDB.newCollection(collection)
            await testDB.newCollection(collection2)

            await testDB.deleteCollection(collection)

            const collections = testDB.listCollections()

            expect(collections).toContain(collection2)
            expect(collections).not.toContain(collection)
        })
    })

    describe("delete", () => {

        const deleteCollection = "delete-test-collection"

        beforeAll(async () => {
            await testDB.newCollection(deleteCollection)
        })

        test("successfully deletes first document that matches query", async () => {
            const testData = {
                value: "test",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value" },
            }

            await testDB.create(deleteCollection, testData)
            await testDB.delete(deleteCollection, { value: "test" })

            const document = await testDB.find(deleteCollection, { value: "test" })
            expect(document).toBeNull()
        })

    })

    describe("deleteAll", () => {

        const deleteAllCollection = "deleteAll-test-collection"

        beforeAll(async () => {
            await testDB.newCollection(deleteAllCollection)
        })

        test("successfully deletes all matching documents", async () => {

            const testData = {
                value: "test",
                "thing1": 1,
                thing2: 2,
                array: ["item"],
                object: { key: "value" },
            }

            await testDB.create(deleteAllCollection, testData)
            await testDB.create(deleteAllCollection, testData)
            await testDB.create(deleteAllCollection, testData)

            let documents = await testDB.findAll(deleteAllCollection)

            expect(documents.length).toEqual(3)

            await testDB.deleteAll(deleteAllCollection, { value: "test" })

            documents = await testDB.findAll(deleteAllCollection)
            expect(documents.length).toEqual(0)
        })
    })

})