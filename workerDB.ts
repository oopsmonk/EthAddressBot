import { Database } from "bun:sqlite";
import { access, constants } from "node:fs/promises";
import type { Transaction } from "./types";

let db: Database;
const dbFile: string = "./ledger.db";

const txSchema = `CREATE TABLE IF NOT EXISTS txs (
    blockHash TEXT,
    blockNumber INTEGER,
    addrFrom TEXT,
    hash TEXT PRIMARY KEY,
    addrTo TEXT,
    transactionIndex INTEGER,
    value INTEGER,
    chainId INTEGER
);`;

self.addEventListener("message", async (event) => {
  if (event.data.create) {
    // console.log("create db: " + event.data.create);
    await access(dbFile, constants.W_OK)
      .then(() => {
        console.log("open db: " + dbFile);
        db = new Database(dbFile);
      })
      .catch((err) => {
        console.log("create db: " + dbFile);
        db = new Database(dbFile);
        db.run(txSchema);
      });

    postMessage({ init: true });
  } else if (event.data.txs) {
    const txs = event.data.txs as Transaction[];
    for (const tx of txs) {
      console.log("db add tx: " + tx.hash);
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
    }
  } else if (event.data.destroy) {
    db.close();
    process.exit();
  }
});
