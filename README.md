# DirfileDB

DirfileDB is a file system based data store. Currently built as a NoSQL style JSON store, it defines a new database as a directory, collections as a sub-directory and documents as files. It can be used as a quick local testing database, or in low user/throughput applications. Originally built for local first/offline capable single user applications. 

It aims to maintain zero dependencies (outside of devDependencies), using only NodeJs functionality. 

It is very much still in early development and subject to large breaking changes. 

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## Installation

1. Clone the repository
    ```
    git clone https://github.com/nathanbbarton/dirfile-db.git

    cd dirfile-db
    ```

2. Install dependencies
    ```
    npm install
    ```

## Usage

### Using your first DirfileDB

```
import DirfileDB from "dirfile-db"

const newDB = DirfileDB({rootDir: myNewDB})

await newDB.init() //directory structure is not created until init is run

```

After a DirfileDB has been setup with `init()` you can create new collections and add new documents.

### Creating a new Collection

```
await newDB.newCollection("firstCollection")
```

### Creating a new Document

```
await newDB.create("firstCollection", { key: "value" })
```
DirfileDB has a universal expectation of an `_id` key value pair, and if a new document is provided without one it will create append and id to the document.

### Find a Document

`find()` is a "find first instance" function meaning, given the provided query returns the first instance of a document that matches the query

```
newDB.find("firstCollection", { key: "value" })
```

to find by id simply pass the id as the query

```
newDB.find("firstCollection", { _id: "someId" })
```

### Find multiple Documents

`findAll()` will return all documents that match a query.

Same as find,

```
newDB.findAll("firstCollection", { key: "value" })
```

A full set of documentation will be published as the project stabilizes from early development

### Building the Project

Currently esbuild is used to bundle a cjs and esm version.

To build the project, run:

```
npm run build
```

### Running Tests

Currently testing is done using `jest`, feelings toward this are unstable and may change.

To run tests, run:

```
npm test
```

### Additional Scripts

```
//Compiles typescript types
"build:types": "tsc --project configs/tsconfig.types.json",

//Runs the esbuild script to bundle the module
"esbuild": "node ./scripts/build.js",

// Runs eslint, config found under ./configs
"lint": "eslint src/**/*.ts --config configs/.eslintrc.json --format stylish",

//Attempts to fix any fixable linting warnings/errors
"lint:fix": "eslint src/**/*.ts --format stylish --fix",

//Helper script that cleans up build directory and default DBs that are made during development
"clean": "npm-run-all clean:dist clean:dbs",

//Removes the build directory
"clean:dist": "rimraf dist",

//Removes commonly made DBs during development
"clean:dbs": "rimraf defaultDB testDB",

//Full package reinstallation
"reinstall": "rimraf node_modules && npm install",

//Cleans and Reinstalls for a full development reset
"reset": "npm-run-all clean reinstall"
```

## Configuration

Current configuration is limited to naming the directory of your database.

```

const config = {
    rootDir: "CustomDB"
}

const newDB = DirfileDB(config)

```

If no rootDir is provided your database will default to "defaultDB"

## Contributing

Contributions are welcome! Please follow these steps to contribute:

    Fork the repository.
    Create a new branch (git checkout -b feature/your-feature).
    Make your changes.
    Commit your changes (git commit -m 'Add some feature').
    Push to the branch (git push origin feature/your-feature).
    Open a Pull Request.

License

This project is licensed under the MIT License - see the LICENSE file for details.
