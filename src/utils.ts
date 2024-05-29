import { Database } from "bun:sqlite";
import type { Transaction, Web3Transaction } from "./types";
import * as XLSX from "xlsx";
import { mkdirSync, existsSync } from "fs";
import * as path from "path";
import { LogLevel, logger } from "./logger";

const dbPath = Bun.env.DB_FILE;
const tag = "utils";

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
  // console.log("create db tables");
  logger(LogLevel.Debug, tag, "creat db tables");
}

export function dbInsertTxs(chainId: bigint, txs: Transaction[]) {
  const db = new Database(dbPath);
  // insert txs into db
  for (const tx of txs) {
    logger(LogLevel.Debug, tag, `db add tx: ${tx.hash}`);
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
      tx.transactionIndex ? tx.transactionIndex.toString() : "0",
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
  logger(LogLevel.Debug, tag, `db update latest block: ${Num}`);
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

export function tx2file(filePath: string) {
  const db = new Database(dbPath, { readonly: true });
  const qchainIds = db.query(`SELECT chainID from block;`);
  let ids = qchainIds.values();
  // console.log(ids);
  let rowCount = 0;

  // create a new book
  const workbook = XLSX.utils.book_new();

  // write table data to sheets
  for (const id of ids) {
    // console.log("parsing id " + id);
    const query = db.query(`SELECT * from txs_${id};`);
    let rows = query.all();
    rowCount += rows.length;
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, `txs_${id}`);
  }

  // make sure dir is existing
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  // Write to an Excel file
  XLSX.writeFile(workbook, filePath);

  db.close();
  return rowCount;
}
