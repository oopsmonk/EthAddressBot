import { type Transaction } from "./types";
import { targetList } from "./constants";
import { LogLevel, logger } from "./logger";

// prevents TS errors
declare var self: Worker;

const loggedTxs: Transaction[] = [];
const tag = "txWorker";

self.addEventListener("message", (event) => {
  logger(LogLevel.Debug, tag, `start`);
  const txs: Transaction[] = event.data.txs;
  // compare addresses with lowercase
  txs.forEach((tx) => {
    tx.from = tx.from.toLocaleLowerCase();
    tx.to = tx.to ? tx.to.toLocaleLowerCase() : "";
  });

  for (const tx of txs) {
    // ignore zero tx
    if (BigInt(tx.value) === 0n && Bun.env.TX_IGNORE_ZERO === "1") {
      // console.log("ignore zero value tx: " + tx.hash);
      logger(LogLevel.Debug, tag, `ignore zero value tx: ${tx.hash}`);
      continue;
    }

    // ignore self?
    if (tx.from === tx.to && Bun.env.TX_IGNORE_SELF === "1") {
      // console.log("ignore from === to tx: " + tx.hash);
      logger(LogLevel.Debug, tag, `ignore from === to tx: ${tx.hash}`);
      continue;
    }

    // if from and to addresses are both in the target list
    const toTg = targetList.find((item) => item.address === tx.to);
    const fromTg = targetList.find((item) => item.address === tx.from);
    if (toTg && fromTg) {
      logger(LogLevel.Debug, tag, `append tx: ${tx.hash}`);
      loggedTxs.push(tx);
      continue;
    }

    // filter by targets
    for (const trg of targetList) {
      if (tx.from === trg.address || tx.to === trg.address) {
        // push to tx list
        logger(LogLevel.Debug, tag, `append tx: ${tx.hash}`);
        loggedTxs.push(tx);
      }
    }
  }

  if (loggedTxs.length) {
    // dump txs for debug
    logger(LogLevel.Debug, tag, `logged transactions: ${loggedTxs.length}`);
    // loggedTxs.forEach((tx) => console.log(tx.hash));
    postMessage(loggedTxs);
  }
  // end of parsing transactions
  logger(LogLevel.Debug, tag, `done`);
  process.exit();
});
