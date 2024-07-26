// const { DirfileDB } = require("dirfile-db")
const DirfileDB = require("dirfile-db").default

const setupDB = async () => {
    //construct the new db
    const newDB = new DirfileDB({rootDir: "./cjs-exampleDB"})
    //init the db (sets up directory for the db)
    await newDB.init()
    console.log("cjs-exampleDB setup complete")
}

setupDB()
