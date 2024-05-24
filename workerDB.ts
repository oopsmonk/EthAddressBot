import type { Transaction } from "./types";
import { dbCreateTables, dbInsertTxs, dbSetLatestBlockNum } from "./utils";

self.addEventListener("message", async (event) => {
  if (event.data.create) {
    const chainId: bigint = event.data.create;
    // console.log("create db: " + event.data.create);
    dbCreateTables(chainId);
    postMessage({ init: true });
  } else if (event.data.updateLatestBlockNumber) {
    const chainId: bigint = event.data.updateLatestBlockNumber.chainId;
    const num: bigint = event.data.updateLatestBlockNumber.latestNum;
    dbSetLatestBlockNum(chainId, num);
  } else if (event.data.txs) {
    const txs = event.data.txs as Transaction[];
    dbInsertTxs(txs);
  } else if (event.data.destroy) {
    console.log("terminate DB worker");
    process.exit();
  }
});
