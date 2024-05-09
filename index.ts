import { Web3 } from "web3";
import figlet from "figlet";
import addrList from "./targetAddresses.json";
import { type AddressList, type Transaction } from "./types";

declare module "bun" {
  interface Env {
    RPC_PROVIDER: string;
  }
}

const targetList: AddressList[] = addrList;
const rpc = Bun.env.RPC_PROVIDER;

function isTragetAddressUnique(list: AddressList[]) {
  const addressSet = new Set();

  for (const item of list) {
    if (addressSet.has(item.address)) {
      return false; // Duplicate address found
    } else {
      addressSet.add(item.address);
    }
  }

  return true;
}

function greeding(): boolean {
  const welcome = figlet.textSync("* * Eth Address Bot * *");
  console.log(welcome);
  console.log("Build with Bun v" + Bun.version);
  console.log("RPC Endpoint: " + rpc);

  if (targetList.length == 0 || targetList == undefined) {
    console.log("Invalid target address list!");
    return false;
  }

  if (!isTragetAddressUnique(targetList)) {
    console.log("duplicate address found in the target list!");
    return false;
  }

  console.log("===== Monitoring Addresses =====");
  targetList.forEach((a) => {
    console.log(a.name + ": " + a.address);
  });
  console.log("================================");

  return true;
}

if (rpc != undefined) {
  if (greeding()) {
    const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
    if (web3) {
      console.log("starting worker....");
      const blockWorker = new Worker("./workerLatestBlock.ts");

      blockWorker.addEventListener("open", () => {
        console.log("LatestBlock worker init");
        blockWorker.postMessage({ nodeRPC: rpc });
      });

      // blockWorker.postMessage({ web3: web3 });
      blockWorker.addEventListener("message", (event) => {
        if (event.data.ready) {
          console.log("worker ready to go!!");
          blockWorker.postMessage({ start: true });
        } else if (event.data.txs) {
          const txs: Transaction[] = event.data.txs;

          console.log("txs: " + txs.length);
          const txWorker = new Worker("./workerTx.ts");

          txWorker.addEventListener("open", () => {
            // console.log("starting tx worker....");
            txWorker.postMessage({ txs: txs });
          });

          // txWorker.addEventListener("close", (event) => {
          //   console.log("txWorker is being closed");
          // });
        }
      });
    } else {
      console.log("init web3 with endpoint failed: " + rpc);
    }
  }
} else {
  console.log("RPC_PROVIDER is not defined in .env file!");
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
