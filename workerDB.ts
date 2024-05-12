import { Database } from "bun:sqlite";
import { access, constants } from "node:fs/promises";
import type { Transaction } from "./types";

let db: Database;
const dbFile: string = "./ledger.db";

const txSchema = `CREATE TABLE IF NOT EXISTS txs (
    blockHash TEXT type UNIQUE,
    blockNumber INTEGER,
    addrFrom TEXT,
    hash TEXT PRIMARY KEY,
    addrTo TEXT,
    transactionIndex INTEGER,
    value INTEGER,
    chainId INTEGER
);`;

self.addEventListener("message", async (event) => {
  console.log("db worker on msg: " + event.data);
  if (event.data.create) {
    console.log("create db: " + event.data.create);
    await access(dbFile, constants.W_OK)
      .then(() => {
        db = new Database(dbFile);
        console.log("db exist");
      })
      .catch((err) => {
        console.log("create db: " + err.message);
        db = new Database(dbFile);
        db.run(txSchema);
      });

    postMessage({ init: true });
  } else if (event.data.tx) {
    const tx = event.data.tx as Transaction;
    console.log("added tx: " + tx.hash);
    db.query(
      `INSERT INTO txs (blockHash, blockNumber, addrFrom, hash, addrTo, transactionIndex, value, chainId) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);`
    ).run(
      tx.blockHash,
      tx.blockNumber,
      tx.from,
      tx.hash,
      tx.to,
      tx.transactionIndex,
      tx.value,
      tx.chainId
    );
  } else if (event.data.destroy) {
    db.close();
    process.exit();
  }
});
