import figlet from "figlet";
import addrList from "./targetAddresses.json";
import { type AddressList, type Transaction } from "./types";

const targetList: AddressList[] = addrList.target;
const aliasList: AddressList[] = addrList.alias;
const rpc = Bun.env.RPC_PROVIDER;

let dbWorker: Worker;
let blockWorker: Worker;

let consoleLogger: Worker;
// let lineBotLogger: Worker; // TODO

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
    "Ignore Zero transactions: " + String(Bun.env.TX_IGNORE_ZERO === "1")
  );
  console.log(
    "Ignore `from` == `to` transactions: " +
      String(Bun.env.TX_IGNORE_SELF === "1")
  );
  console.log("===== Monitoring Addresses =====");
  targetList.forEach((a) => {
    console.log(a.name + ": " + a.address);
  });
  console.log("======= Alias Addresses ========");
  aliasList.forEach((a) => {
    console.log(a.name + ": " + a.address);
  });
  console.log("================================");

  return true;
}

if (greeding()) {
  // init db worker
  dbWorker = new Worker("./workerDB.ts");
  dbWorker.addEventListener("open", () => {
    dbWorker.postMessage({ create: true });
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
        // TODO
        // if (lineBotLogger) {
        //   lineBotLogger.postMessage({ txs: loggedTxs });
        // }
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

// const server = Bun.serve({
//   // defualt port is 3030
//   port: Bun.env.PORT || 3030,
//   fetch(req) {
//     console.log("request from:" + req.headers.get("host"));
//     return new Response("How! Bun! Bun!");
//   },
// });
//
// console.log(`Listening on http://localhost:${server.port} ...`);
