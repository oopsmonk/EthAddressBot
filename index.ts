import figlet from "figlet";
import { type AddressList, type Transaction } from "./types";
import Web3 from "web3";
import { startServer, sendTxLog } from "./LineBotServer";
import { existsSync } from "fs";
import { Database } from "bun:sqlite";
import { targetList, aliasList } from "./constants";

const rpc = Bun.env.RPC_PROVIDER;

let dbWorker: Worker;
let blockWorker: Worker;

let consoleLogger: Worker;
let isBotEnabled: boolean = false;

function isTragetAddressUnique(list: AddressList[]) {
  const addressSet = new Set();
  let unique = true;

  for (const item of list) {
    if (addressSet.has(item.address)) {
      console.log("duplicated address: " + item.address);
      unique = false;
    } else {
      addressSet.add(item.address);
    }
  }

  return unique;
}

function validateConfig(): boolean {
  if (targetList.length == 0 || targetList == undefined) {
    console.log("Invalid target address list!");
    return false;
  }

  if (!isTragetAddressUnique(targetList.concat(aliasList))) {
    console.log("duplicate address found in the target list!");
    return false;
  }

  if (!Bun.env.RPC_PROVIDER) {
    console.log("RPC_PROVIDER is not defined in env file");
    return false;
  }

  if (!Bun.env.LATEST_BLOCK_WORKER_INTERVAL) {
    console.log("LATEST_BLOCK_WORKER_INTERVAL is not defined in env file");
    return false;
  }

  if (!Bun.env.LATEST_BLOCK_NUMBER && Bun.env.LATEST_BLOCK_NUMBER !== "0") {
    console.log("LATEST_BLOCK_NUMBER is not defined in env file");
    return false;
  }

  return true;
}

function greeding(): boolean {
  const welcome = figlet.textSync("* * Eth Address Bot * *");
  console.log(welcome);
  console.log("Build with Bun v" + Bun.version);
  if (!validateConfig()) {
    return false;
  }

  console.log("==========Configure=============");
  console.log("RPC Endpoint: " + Bun.env.RPC_PROVIDER);
  console.log("LatestBlock interval: " + Bun.env.LATEST_BLOCK_WORKER_INTERVAL);
  console.log("TX Explorer: " + Bun.env.TX_HASH_URL);
  console.log("Ignore Zero transactions: " + String(Bun.env.TX_IGNORE_ZERO === "1"));
  console.log("Ignore `from` == `to` transactions: " + String(Bun.env.TX_IGNORE_SELF === "1"));
  console.log("===== Monitoring Addresses =====");
  targetList.forEach((a) => {
    console.log(a.name + ": " + a.address);
  });
  console.log("======= Alias Addresses ========");
  aliasList.forEach((a) => {
    console.log(a.name + ": " + a.address);
  });
  console.log("================================");

  if (Bun.env.LINE_USERS || Bun.env.LINE_USERS) {
    console.log("LineBot is starting...");
    startServer();
    isBotEnabled = true;
  } else {
    console.log("LineBot is disabled...");
    isBotEnabled = false;
  }
  return true;
}

function initLatestBlockNum(chainId: bigint): bigint {
  const cfgBlockNum = BigInt(Bun.env.LATEST_BLOCK_NUMBER || 0n);
  const dbFile = Bun.env.DB_FILE;
  if (!existsSync(dbFile)) {
    // db not exist
    return cfgBlockNum;
  }

  // read latest block from DB
  const db = new Database(dbFile);
  const query = db.query(`select blockNumber from block where chainId = ${chainId}`);
  const dbBlockNum = query.get() as { blockNumber: bigint };
  // close db
  db.close(false);

  if (dbBlockNum && dbBlockNum.blockNumber > cfgBlockNum) {
    // use DB block number
    return dbBlockNum.blockNumber;
  }
  return cfgBlockNum;
}

async function buildExternalTxs(web3: Web3, db: Database): Promise<bigint> {
  // check if need to build from transaction hash db frist
  const externalTxs = Bun.file("./txHash.json");
  let latestBlockNum = 0n;
  if (await externalTxs.exists()) {
    console.log("insert external txs...");
    const txHashList = await externalTxs.json();
    const txList: Transaction[] = [];
    // get transactions from network
    for (const hash of txHashList) {
      const tx = await web3.eth.getTransaction(hash);
      const txBlockNum = tx.blockNumber ? BigInt(tx.blockNumber) : undefined;
      const fromTg = targetList.find((item) => item.address === tx.from);
      const toTg = targetList.find((item) => item.address === tx.to);

      if (!fromTg && !toTg) {
        console.log("ignore tx: " + hash);
        continue;
      }

      if (txBlockNum) {
        latestBlockNum = txBlockNum > latestBlockNum ? txBlockNum : latestBlockNum;
        console.log("external tx latest block number: " + latestBlockNum);
      }
      // add tx to list
      txList.push({
        blockHash: tx.blockHash,
        blockNumber: tx.blockNumber ? BigInt(tx.blockNumber) : undefined,
        from: tx.from,
        gas: BigInt(tx.gas),
        gasPrice: BigInt(tx.gasPrice),
        hash: tx.hash,
        input: tx.input,
        nonce: BigInt(tx.nonce),
        to: tx.to,
        transactionIndex: tx.transactionIndex ? BigInt(tx.transactionIndex) : undefined,
        value: BigInt(tx.value),
        type: BigInt(tx.type),
        chainId: tx.chainId ? BigInt(tx.chainId) : undefined,
        v: tx.v ? BigInt(tx.v) : undefined,
        r: tx.r,
        s: tx.s,
      });
    }

    // insert txs into db
    for (const tx of txList) {
      console.log("db add tx: " + tx.hash);
      db.query(
        `INSERT OR IGNORE INTO txs_${tx.chainId!.toString()}
        (blockHash, blockNumber, addrFrom, hash, addrTo, transactionIndex, value)
        VALUES (?, ?, ?, ?, ?, ?, ?);`
      ).run(
        tx.blockHash ? tx.blockHash : "",
        tx.blockNumber ? tx.blockNumber : 0n,
        tx.from,
        tx.hash,
        tx.to ? tx.to : "",
        tx.transactionIndex ? tx.transactionIndex : 0n,
        tx.value
      );
    }
  }

  return latestBlockNum;
}

function createTables(db: Database, chainId: bigint) {
  const txSchema = `CREATE TABLE IF NOT EXISTS txs_${chainId.toString()} (
    id INTEGER PRIMARY KEY,
    blockNumber INTEGER,
    blockHash TEXT,
    addrFrom TEXT,
    addrTo TEXT,
    value INTEGER,
    transactionIndex INTEGER,
    hash TEXT UNIQUE
    );`;

  const blockSchema = `CREATE TABLE IF NOT EXISTS block (
    id INTEGER PRIMARY KEY,
    chainId INTEGER UNIQUE,
    blockNumber INTEGER
    );`;

  // create tx schema if not exist
  // console.log(txSchema);
  db.run(txSchema);

  // create block history if not exist
  // console.log(blockSchema);
  db.run(blockSchema);
  console.log("create db tables");
}

async function initDBAndBlockNumber(web3: Web3): Promise<bigint> {
  let latestBLockNum = 0n;
  const id = await web3.eth.getChainId();
  const db = new Database(Bun.env.DB_FILE);
  // create db if not exist
  createTables(db, id);

  // import external tx?
  const blockNum = await buildExternalTxs(web3, db);
  latestBLockNum = blockNum > latestBLockNum ? blockNum : latestBLockNum;

  // update the latest block in db
  const query = `INSERT INTO block (chainid, blockNumber)
      VALUES (${id.toString()}, ${latestBLockNum.toString()})
      ON CONFLICT (chainid) DO UPDATE SET blockNumber=${latestBLockNum.toString()};`;

  // insert tx to db
  db.prepare(query).run();
  console.log("db update latest block: " + latestBLockNum);
  db.close();

  return latestBLockNum;
}

if (greeding()) {
  // get network info
  const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
  const id = await web3.eth.getChainId();
  // make sure db is create and import transactions if needed
  const initBlockNum = await initDBAndBlockNumber(web3);
  console.log("Network chainId: " + id);
  console.log("Starting Block Number: " + initBlockNum);

  // init db worker
  dbWorker = new Worker("./workerDB.ts");
  dbWorker.addEventListener("open", () => {
    // TODO: unnecessary to create db since db was created in initDBAndBlockNumber()
    dbWorker.postMessage({ create: id });
  });

  dbWorker.addEventListener("message", (event) => {
    if (event.data.init) {
      console.log("database is created...");
    }
  });

  // console logger
  // TODO: can be configured via env
  consoleLogger = new Worker("./workerLoggerConsole.ts");
  consoleLogger.addEventListener("open", () => {
    console.log("console logger is ready");
  });

  // init latestblock worker
  blockWorker = new Worker("./workerLatestBlock.ts");
  blockWorker.addEventListener("open", () => {
    console.log("LatestBlock worker init: " + rpc);
    blockWorker.postMessage({ nodeRPC: rpc });
  });

  blockWorker.addEventListener("message", (event) => {
    if (event.data.ready) {
      console.log("latest block worker ready to go!!");
      blockWorker.postMessage({ start: true, blockNum: initBlockNum });
    } else if (event.data.done) {
      console.log("blockWorker finished: " + event.data.done);
      const blockNum: bigint = event.data.done;
      // update latest block in db
      dbWorker.postMessage({ updateLatestBlockNumber: { chainId: id, latestNum: blockNum } });
      // start latest block worker agian with new block number
      blockWorker.postMessage({ start: true, blockNum: blockNum });
    } else if (event.data.txs) {
      const txs: Transaction[] = event.data.txs;
      console.log("block txs: " + txs.length);
      const txWorker = new Worker("./workerTx.ts");

      txWorker.addEventListener("open", () => {
        // console.log("starting tx worker....");
        txWorker.postMessage({ txs: txs });
      });

      txWorker.addEventListener("message", (event) => {
        const loggedTxs = event.data as Transaction[];
        console.log("txWorker logging txs: " + loggedTxs.length);
        // insert to db
        if (dbWorker) {
          dbWorker.postMessage({ txs: loggedTxs });
        }
        // show on console
        if (consoleLogger) {
          consoleLogger.postMessage({ txs: loggedTxs });
        }
        // notify via LineBot
        if (isBotEnabled) {
          sendTxLog(loggedTxs);
        }
      });

      // for debug
      // txWorker.addEventListener("close", (event) => {
      //   console.log("txWorker is being closed");
      // });
    }
  });
} else {
  process.exit();
}
