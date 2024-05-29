import figlet from "figlet";
import { type AddressList, type Transaction, type Web3Transaction } from "./types";
import Web3 from "web3";
import { startServer, sendTxLog } from "./LineBotServer";
import { targetList, aliasList } from "./constants";
import { dbCreateTables, dbInsertTxs, dbSetLatestBlockNum, parsingTx, tx2file } from "./utils";
import { LogLevel, logger } from "./logger";

const rpc = Bun.env.RPC_PROVIDER;
const tag = "Main";

let dbWorker: Worker;
let blockWorker: Worker;

let consoleLogger: Worker;
let isBotEnabled: boolean = false;
let currChainId = 0n;

function isTragetAddressUnique(list: AddressList[]) {
  const addressSet = new Set();
  let unique = true;

  for (const item of list) {
    if (addressSet.has(item.address)) {
      // console.log("duplicated address: " + item.address);
      logger(LogLevel.Debug, tag, `duplicated address: ${item.address}`);
      unique = false;
    } else {
      addressSet.add(item.address);
    }
  }

  return unique;
}

function validateConfig(): boolean {
  if (targetList.length == 0 || targetList == undefined) {
    // console.log("Invalid target address list!");
    logger(LogLevel.Error, tag, "Invalid target address list!");
    return false;
  }

  if (!isTragetAddressUnique(targetList.concat(aliasList))) {
    // console.log("duplicate address found in the target list!");
    logger(LogLevel.Error, tag, "duplicated address found in the target list!");
    return false;
  }

  if (!Bun.env.RPC_PROVIDER) {
    // console.log("RPC_PROVIDER is not defined in env file");
    logger(LogLevel.Error, tag, "RPC_PROVIDER is not defined in env file");
    return false;
  }

  if (!Bun.env.LATEST_BLOCK_WORKER_INTERVAL) {
    // console.log("LATEST_BLOCK_WORKER_INTERVAL is not defined in env file");
    logger(LogLevel.Error, tag, "LATEST_BLOCK_WORKER_INTERVAL is not defined in env file");
    return false;
  }

  if (!Bun.env.LATEST_BLOCK_NUMBER && Bun.env.LATEST_BLOCK_NUMBER !== "0") {
    // console.log("LATEST_BLOCK_NUMBER is not defined in env file");
    logger(LogLevel.Error, tag, "LATEST_BLOCK_NUMBER is not defined in env file");
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
    // console.log("LineBot is starting...");
    startServer();
    isBotEnabled = true;
    logger(LogLevel.Info, tag, "LineBot is started");
  } else {
    // console.log("LineBot is disabled...");
    logger(LogLevel.Info, tag, "LineBot is disabled");
    isBotEnabled = false;
  }
  return true;
}

async function buildExternalTxs(web3: Web3): Promise<bigint> {
  // check if need to build from transaction hash db frist
  const externalTxs = Bun.file(Bun.env.IMPOERT_TX_HASH);
  let latestBlockNum = 0n;
  if (await externalTxs.exists()) {
    // console.log("import txs from " + Bun.env.IMPOERT_TX_HASH);
    logger(LogLevel.Info, tag, `import txs from ${Bun.env.IMPOERT_TX_HASH}`);
    const chainId = await web3.eth.getChainId();
    const txHashList = await externalTxs.json();
    const txList: Transaction[] = [];
    // get transactions from network
    for (const hash of txHashList) {
      const web3tx: Web3Transaction = (await web3.eth.getTransaction(hash).catch((err) => {
        console.log(err);
        return undefined;
      })) as unknown as Web3Transaction;
      if (!web3tx) {
        continue;
      }
      const tx = parsingTx(web3tx);
      const fromTg = targetList.find((item) => item.address === tx.from);
      const toTg = targetList.find((item) => item.address === tx.to);
      // console.log(tx);

      if (tx.blockNumber) {
        // console.log("import tx block number: " + tx.blockNumber);
        logger(LogLevel.Debug, tag, `import tx block number ${tx.blockNumber}`);
        latestBlockNum = tx.blockNumber > latestBlockNum ? tx.blockNumber : latestBlockNum;
      }

      // ignore zero tx
      if (tx.value === 0n && Bun.env.TX_IGNORE_ZERO === "1") {
        // console.log("ignore zero value tx: " + tx.hash);
        logger(LogLevel.Debug, tag, `ignore zero value: ${tx.hash}`);
        continue;
      }

      // ignore self?
      if (tx.from === tx.to && Bun.env.TX_IGNORE_SELF === "1") {
        // console.log("ignore from === to tx: " + tx.hash);
        logger(LogLevel.Debug, tag, `ignore from === to: ${tx.hash}`);
        continue;
      }

      if (!fromTg && !toTg) {
        // still update latestBlockNum but ignore the tx not in the target list
        // console.log("ignore tx: " + hash);
        logger(LogLevel.Debug, tag, `ignore tx not in address list: ${tx.hash}`);
        continue;
      }

      // add tx to list
      txList.push(tx);
    }

    // insert txs into db
    dbInsertTxs(chainId, txList);
  }

  return latestBlockNum;
}

async function initDBAndBlockNumber(web3: Web3): Promise<bigint> {
  let latestBLockNum = BigInt(Bun.env.LATEST_BLOCK_NUMBER);
  const id = await web3.eth.getChainId();
  // create db if not exist
  dbCreateTables(id);

  // import external tx?
  let blockNum = 0n;
  if (Bun.env.IMPOERT_TX_HASH) {
    blockNum = await buildExternalTxs(web3);
    dbSetLatestBlockNum(id, blockNum);
  }

  if (latestBLockNum === 0n) {
    // start from the latest block number
    return latestBLockNum;
  }

  // start from block number in db or env?
  return blockNum > latestBLockNum ? blockNum : latestBLockNum;
}

if (greeding()) {
  // get network info
  const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
  currChainId = await web3.eth.getChainId();
  // make sure db is create and import transactions if needed
  const initBlockNum = await initDBAndBlockNumber(web3);
  logger(LogLevel.Info, tag, `Network chainId: ${currChainId}`);
  logger(LogLevel.Info, tag, `Starting Block Number: ${initBlockNum}`);

  // init db worker
  dbWorker = new Worker("./workerDB.ts");
  dbWorker.addEventListener("open", () => {
    logger(LogLevel.Debug, tag, "DB worker start");
    // TODO: unnecessary to create db since db was created in initDBAndBlockNumber()
    dbWorker.postMessage({ create: currChainId });
  });

  dbWorker.addEventListener("message", (event) => {
    if (event.data.init) {
      // console.log("database is created...");
      logger(LogLevel.Info, tag, "database is created...");
    }
  });

  // console logger
  // TODO: can be configured via env
  consoleLogger = new Worker("./workerLoggerConsole.ts");
  consoleLogger.addEventListener("open", () => {
    // console.log("console logger is ready");
    logger(LogLevel.Debug, tag, "Console worker start");
  });

  // init latestblock worker
  blockWorker = new Worker("./workerLatestBlock.ts");
  blockWorker.addEventListener("open", () => {
    // console.log("LatestBlock worker init: " + rpc);
    logger(LogLevel.Debug, tag, "Block worker start");
    blockWorker.postMessage({ nodeRPC: rpc });
  });

  blockWorker.addEventListener("message", (event) => {
    if (event.data.ready) {
      // console.log("latest block worker ready to go!!");
      logger(LogLevel.Debug, tag, "Block worker ready");
      blockWorker.postMessage({ start: true, blockNum: initBlockNum });
    } else if (event.data.done) {
      // console.log("blockWorker finished: " + event.data.done);
      const blockNum: bigint = event.data.done;
      logger(LogLevel.Info, tag, `Block worker finished: ${blockNum}`);
      // update latest block in db
      dbWorker.postMessage({
        updateLatestBlockNumber: { chainId: currChainId, latestNum: blockNum },
      });
      // start latest block worker agian with new block number
      blockWorker.postMessage({ start: true, blockNum: blockNum });
    } else if (event.data.txs) {
      const txs: Transaction[] = event.data.txs;
      logger(LogLevel.Info, tag, `block txs: ${txs.length}`);
      if (txs.length !== 0) {
        const txWorker = new Worker("./workerTx.ts");

        txWorker.addEventListener("open", () => {
          // console.log("starting tx worker....");
          logger(LogLevel.Debug, tag, "TX worker start");
          txWorker.postMessage({ txs: txs });
        });

        txWorker.addEventListener("message", (event) => {
          const loggedTxs = event.data as Transaction[];
          // console.log("txWorker logging txs: " + loggedTxs.length);
          logger(LogLevel.Debug, tag, `TX worker loggind txs: ${loggedTxs.length}`);
          // insert to db
          if (dbWorker) {
            dbWorker.postMessage({ txs: loggedTxs, chainId: currChainId });
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
        txWorker.addEventListener("close", (event) => {
          // console.log("txWorker is being closed");
          logger(LogLevel.Debug, tag, "TX worker is closed");
        });
      }
    }
  });
} else {
  process.exit();
}
