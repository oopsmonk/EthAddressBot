import { Database } from "bun:sqlite";
import type { Transaction, Web3Transaction } from "./types";

const dbPath = Bun.env.DB_FILE;

export function dbCreateTables(chainId: bigint) {
  const txSchema = `CREATE TABLE IF NOT EXISTS txs_${chainId.toString()} (
    id INTEGER PRIMARY KEY,
    blockNumber TEXT,
    blockHash TEXT,
    addrFrom TEXT,
    addrTo TEXT,
    value TEXT,
    transactionIndex TEXT,
    hash TEXT UNIQUE
    );`;

  const blockSchema = `CREATE TABLE IF NOT EXISTS block (
    id INTEGER PRIMARY KEY,
    chainId INTEGER UNIQUE,
    blockNumber INTEGER
    );`;

  const db = new Database(dbPath);
  // create tx schema if not exist
  // console.log(txSchema);
  db.run(txSchema);

  // create block history if not exist
  // console.log(blockSchema);
  db.run(blockSchema);

  db.close();
  console.log("create db tables");
}

export function dbInsertTxs(chainId: bigint, txs: Transaction[]) {
  const db = new Database(dbPath);
  // insert txs into db
  for (const tx of txs) {
    console.log("db add tx: " + tx.hash);
    db.query(
      `INSERT OR IGNORE INTO txs_${chainId.toString()}
        (blockNumber, blockHash, addrFrom, addrTo, value, transactionIndex, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?);`
    ).run(
      tx.blockNumber ? tx.blockNumber.toString() : "",
      tx.blockHash ? tx.blockHash : "",
      tx.from,
      tx.to ? tx.to : "",
      tx.value.toString(),
      tx.transactionIndex ? tx.transactionIndex.toString() : "",
      tx.hash
    );
  }

  db.close();
}

export function dbSetLatestBlockNum(chainId: bigint, Num: bigint) {
  const db = new Database(dbPath);
  // update the latest block in db
  const query = `INSERT INTO block (chainid, blockNumber)
      VALUES (${chainId.toString()}, ${Num.toString()})
      ON CONFLICT (chainid) DO UPDATE SET blockNumber=${Num.toString()};`;

  // insert tx to db
  db.prepare(query).run();
  console.log("db update latest block: " + Num);
  db.close();
}

export const parsingTx = (wTx: Web3Transaction) => {
  return {
    blockHash: wTx.blockHash,
    blockNumber: wTx.blockNumber,
    hash: wTx.hash,
    from: wTx.from,
    to: wTx.to,
    transactionIndex: wTx.transactionIndex,
    value: wTx.value,
  } as Transaction;
};

export function parsingTransactions(web3Txs: Web3Transaction[]) {
  const txs: Transaction[] = [];
  for (const tx of web3Txs) {
    txs.push(parsingTx(tx));
  }
  return txs;
}
