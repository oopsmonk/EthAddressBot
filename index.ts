import figlet from "figlet";
import addrList from "./targetAddresses.json";
import { type AddressList, type Transaction } from "./types";
import Web3 from "web3";
import { startServer, sendTxLog } from "./LineBotServer";

const targetList: AddressList[] = addrList.target;
const aliasList: AddressList[] = addrList.alias;
const rpc = Bun.env.RPC_PROVIDER;

let dbWorker: Worker;
let blockWorker: Worker;

let consoleLogger: Worker;
// let lineBotLogger: Worker; // TODO
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
  console.log(
    "Starting Block Number: " +
      (Bun.env.LATEST_BLOCK_NUMBER === "0" ? "latest" : Bun.env.LATEST_BLOCK_NUMBER)
  );
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

if (greeding()) {
  // get network info
  const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
  const id = await web3.eth.getChainId();
  console.log("Network chainId: " + id);
  // init db worker
  dbWorker = new Worker("./workerDB.ts");
  dbWorker.addEventListener("open", () => {
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
      blockWorker.postMessage({ start: true });
    } else if (event.data.done) {
      console.log("blockWorker finished: " + event.data.done);
      const blockNum: bigint = event.data.done;
      // update latest block in db
      dbWorker.postMessage({ updateLatestBlockNumber: { chainId: id, latestNum: blockNum } });
      blockWorker.postMessage({ start: true });
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
        // TODO:
        // handle logger or display, like db, lineBot, console
        if (dbWorker) {
          dbWorker.postMessage({ txs: loggedTxs });
        }
        if (consoleLogger) {
          consoleLogger.postMessage({ txs: loggedTxs });
        }

        if (isBotEnabled) {
          // send txs via line bot
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
