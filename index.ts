import { Web3 } from "web3";
import figlet from "figlet";
import addrList from "./targetAddresses.json";

declare module "bun" {
  interface Env {
    RPC_PROVIDER: string;
  }
}

interface AddressList {
  name: string;
  address: string;
}

interface Transaction {
  blockHash: string;
  blockNumber: bigint;
  from: string;
  gas: bigint;
  gasPrice: bigint;
  hash: string;
  input: string;
  nonce: bigint;
  to: string;
  transactionIndex: bigint;
  value: bigint;
  type: bigint;
  chainId: bigint;
  v: bigint;
  r: string;
  s: string;
}

const targetList: AddressList[] = addrList.target;
const aliasList: AddressList[] = addrList.alias;
const rpc = Bun.env.RPC_PROVIDER;

function greeding(): boolean {
  const welcome = figlet.textSync("* * Eth Address Logger * *");
  console.log(welcome);
  console.log("Build with Bun v" + Bun.version);
  console.log("RPC Endpoint: " + rpc);

  if (targetList.length == 0 || targetList == undefined) {
    console.log("Invalid target address list!");
    return false;
  }

  console.log("===== Monitoring Addresses =====");
  targetList.forEach((a) => {
    console.log(a.name + ": " + a.address);
  });

  if (aliasList.length > 0) {
    console.log("========== Alias List ==========");
    aliasList.forEach((a) => {
      console.log(a.name + ": " + a.address);
    });
  }
  return true;
}

if (rpc != undefined) {
  if (greeding()) {
    const web3 = new Web3(new Web3.providers.HttpProvider(rpc));
    if (web3) {
      console.log("starting worker....");
      // const blockWorker = new Worker(
      //   new URL("latestBlockWorker.ts", import.meta.url).href
      // );
      const blockWorker = new Worker("./latestBlockWorker.ts");

      blockWorker.addEventListener("open", () => {
        console.log("worker init");
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
          txs.forEach((tx) => {
            console.log(
              "value: " +
                Web3.utils.fromWei(tx.value, "ether") +
                " ether , from: " +
                tx.from +
                " , to: " +
                tx.to +
                " , hash: " +
                tx.hash
            );
          });
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
