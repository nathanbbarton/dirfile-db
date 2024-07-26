import DirfileDB from "dirfile-db"

const newDB = new DirfileDB({rootDir: "./esm-exampleDB"})
await newDB.init()
