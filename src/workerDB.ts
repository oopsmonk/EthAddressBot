import { LogLevel, logger } from "./logger";
import type { Transaction } from "./types";
import { dbCreateTables, dbInsertTxs, dbSetLatestBlockNum } from "./utils";
const tag = "dbWorker";

self.addEventListener("message", async (event) => {
  if (event.data.create) {
    const chainId: bigint = event.data.create;
    // console.log("create db: " + event.data.create);
    logger(LogLevel.Debug, tag, `create db: ${event.data.create}`);
    dbCreateTables(chainId);
    postMessage({ init: true });
  } else if (event.data.updateLatestBlockNumber) {
    const chainId: bigint = event.data.updateLatestBlockNumber.chainId;
    const num: bigint = event.data.updateLatestBlockNumber.latestNum;
    logger(LogLevel.Info, tag, `update block number: ${num}`);
    dbSetLatestBlockNum(chainId, num);
  } else if (event.data.txs) {
    const txs: Transaction[] = event.data.txs;
    const id: bigint = event.data.chainId;
    logger(LogLevel.Info, tag, `insert ${txs.length} rows`);
    dbInsertTxs(id, txs);
  } else if (event.data.destroy) {
    // console.log("terminate DB worker");
    logger(LogLevel.Info, tag, "terminate");
    process.exit();
  }
});
