// worker that polling latest block from RPC endpoint
import Web3 from "web3";
import { type Web3Transaction } from "./types";
import { parsingTransactions } from "./utils";
import { LogLevel, logger } from "./logger";

// prevents TS errors
declare var self: Worker;

const tag = "blockWorker";

let web3: any = undefined;
let latestBlock: bigint = 0n;

self.addEventListener("message", async (event) => {
  if (event.data.nodeRPC) {
    web3 = new Web3(new Web3.providers.HttpProvider(event.data.nodeRPC));
    if (web3) {
      postMessage({ ready: true });
    } else {
      // console.log("init work failed: " + event.data.nodeRPC);
      logger(LogLevel.Error, tag, `init failed: ${event.data.nodeRPC}`);
    }
  } else if (event.data.start) {
    const startNum = BigInt(event.data.blockNum);
    if (web3 == undefined) {
      logger(LogLevel.Error, tag, `cannot init node PRC, terminat worker`);
      process.exit();
    }

    await web3.eth.getBlockNumber().then(async (blockNum: bigint) => {
      logger(LogLevel.Debug, tag, `current block: ${blockNum}`);
      if (startNum === 0n) {
        // frist block to handle
        await web3.eth
          .getBlock(blockNum, true)
          .then((block: { transactions: Web3Transaction[] }) => {
            logger(LogLevel.Info, tag, `frist block: ${blockNum}`);
            if (block.transactions === undefined) {
              // console.log("no txs");
              postMessage({ txs: [] });
            } else {
              const txs = parsingTransactions(block.transactions);
              postMessage({ txs: txs });
            }
          });
      } else if (startNum < blockNum && startNum !== 0n) {
        let diffBlockNum = blockNum - startNum;
        logger(
          LogLevel.Info,
          tag,
          `latest: ${startNum}, current: ${blockNum}, diff: ${diffBlockNum}`
        );
        while (diffBlockNum) {
          // get blocks detail
          const n = blockNum - diffBlockNum + 1n;
          await web3.eth
            .getBlock(n, true)
            .then((block: { transactions: Web3Transaction[] }) => {
              // console.log("new block: " + n);
              logger(LogLevel.Debug, tag, `new block: ${n}`);
              if (block.transactions === undefined || block.transactions.length === 0) {
                // console.log("no txs");
                postMessage({ txs: [] });
              } else {
                const txs = parsingTransactions(block.transactions);
                postMessage({ txs: txs });
              }
            })
            .catch((err: any) => {
              // TODO: retry?
              logger(LogLevel.Error, tag, "getBlock err: ");
              console.log(err);
            });
          diffBlockNum--;
        }
      }
      // update latest block number
      latestBlock = blockNum;
    });

    logger(LogLevel.Info, tag, `done: ${latestBlock}`);
    postMessage({ done: latestBlock });
  }
});
