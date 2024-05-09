// worker that polling latest block from RPC endpoint

import Web3 from "web3";

// prevents TS errors
declare var self: Worker;

let web3: any = undefined;
let latestBlock: bigint = 0n;
const interval: number = 1000;

self.addEventListener("message", async (event) => {
  if (event.data.nodeRPC) {
    web3 = new Web3(new Web3.providers.HttpProvider(event.data.nodeRPC));
    if (web3) {
      postMessage({ ready: true });
    } else {
      console.log("init work failed: " + event.data.nodeRPC);
    }
  } else if (event.data.start) {
    console.log("start work....");
    if (web3 == undefined) {
      console.log("cannot init node PRC, terminat worker...");
      process.exit();
    }
    while (true) {
      const block = await web3.eth.getBlock("latest", true);
      if (latestBlock != block.number) {
        latestBlock = block.number;
        console.log("new block: " + latestBlock);
        postMessage({ txs: block.transactions });
      }
      Bun.sleepSync(interval);
    }
  }
});
