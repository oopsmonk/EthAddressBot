// worker that polling latest block from RPC endpoint
import Web3 from "web3";
import { type Transaction } from "./types";

// prevents TS errors
declare var self: Worker;

let web3: any = undefined;
// TODO: read from database?
// let latestBlock: bigint = BigInt(Bun.env.LATEST_BLOCK_NUMBER);
let latestBlock: bigint = 0n;

self.addEventListener("message", async (event) => {
  if (event.data.nodeRPC) {
    web3 = new Web3(new Web3.providers.HttpProvider(event.data.nodeRPC));
    if (web3) {
      postMessage({ ready: true });
    } else {
      console.log("init work failed: " + event.data.nodeRPC);
    }
  } else if (event.data.start) {
    const startNum = BigInt(event.data.blockNum);
    if (web3 == undefined) {
      console.log("cannot init node PRC, terminat worker...");
      process.exit();
    }

    await web3.eth.getBlockNumber().then(async (blockNum: bigint) => {
      console.log("current block: " + blockNum);
      if (startNum === 0n) {
        // frist block to handle
        await web3.eth.getBlock(blockNum, true).then((block: { transactions: Transaction[] }) => {
          console.log("frist block: " + blockNum);
          postMessage({ txs: block.transactions });
        });
      } else if (startNum < blockNum && startNum !== 0n) {
        let diffBlockNum = blockNum - startNum;
        console.log("latest: " + startNum + " , current: " + blockNum + " , diff:" + diffBlockNum);
        while (diffBlockNum) {
          // get blocks detail
          const n = blockNum - diffBlockNum + 1n;
          await web3.eth.getBlock(n, true).then((block: { transactions: Transaction[] }) => {
            console.log("new block: " + n);
            postMessage({ txs: block.transactions });
          });
          diffBlockNum--;
        }
      }
      // update latest block number
      latestBlock = blockNum;
    });

    Bun.sleepSync(Number(Bun.env.LATEST_BLOCK_WORKER_INTERVAL));
    postMessage({ done: latestBlock });
  }
});
