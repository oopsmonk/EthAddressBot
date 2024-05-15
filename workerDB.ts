import { Database } from "bun:sqlite";
import type { Transaction } from "./types";

let db: Database;
const dbFile: string = "./ledger.db";

function createDB(dbPath: string, chainId: bigint) {
  const txSchema = `CREATE TABLE IF NOT EXISTS txs_${chainId.toString()} (
    blockHash TEXT,
    blockNumber INTEGER,
    addrFrom TEXT,
    hash TEXT PRIMARY KEY,
    addrTo TEXT,
    transactionIndex INTEGER,
    value INTEGER
    );`;

  const blockSchema = `CREATE TABLE IF NOT EXISTS block (
    chainId INTEGER PRIMARY KEY,
    blockNumber INTEGER
    );`;

  console.log("open db: " + dbPath);
  db = new Database(dbPath);
  // create tx schema if not exist
  db.run(txSchema);
  // create block history if not exist
  db.run(blockSchema);
}

self.addEventListener("message", async (event) => {
  if (event.data.create) {
    const chainId: bigint = event.data.create;
    // console.log("create db: " + event.data.create);
    createDB(dbFile, chainId);
    postMessage({ init: true });
  } else if (event.data.queryLatestBlockNumber) {
    // TODO
    console.log("TODO: db query latest block: ");
  } else if (event.data.updateLatestBlockNumber) {
    const chainId: bigint = event.data.updateLatestBlockNumber.chainId;
    const num: bigint = event.data.updateLatestBlockNumber.latestNum;
    const query = `INSERT INTO block (chainid, blockNumber)
      VALUES (${chainId.toString()}, ${num.toString()})
      ON CONFLICT (chainid) DO UPDATE SET blockNumber=${num.toString()};`;
    db.prepare(query).run();
    console.log("db update latest block: " + num.toString());
  } else if (event.data.txs) {
    const txs = event.data.txs as Transaction[];
    for (const tx of txs) {
      console.log("db add tx: " + tx.hash);
      db.query(
        `INSERT INTO txs_${tx.chainId.toString()}
        (blockHash, blockNumber, addrFrom, hash, addrTo, transactionIndex, value)
        VALUES (?, ?, ?, ?, ?, ?, ?);`
      ).run(tx.blockHash, tx.blockNumber, tx.from, tx.hash, tx.to, tx.transactionIndex, tx.value);
    }
  } else if (event.data.destroy) {
    db.close();
    process.exit();
  }
});
