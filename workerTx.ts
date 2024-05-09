import Web3 from "web3";
import { type AddressList, type Transaction } from "./types";
import addrList from "./targetAddresses.json";

// prevents TS errors
declare var self: Worker;

const interval: number = 2000;
const targetList: AddressList[] = addrList;

// compare addresses with lowercase
targetList.forEach((t) => {
  t.address = t.address.toLocaleLowerCase();
});

function txlogger(value: bigint, from: string, to: string, hash: string) {
  console.log(
    "value: " +
      Web3.utils.fromWei(value, "ether") +
      " ether , from: " +
      from +
      " , to: " +
      to +
      " , hash: " +
      hash
  );
}

self.addEventListener("message", (event) => {
  const txs: Transaction[] = event.data.txs;
  // compare addresses with lowercase
  txs.forEach((tx) => {
    tx.from = tx.from.toLocaleLowerCase();
    tx.to = tx.to.toLocaleLowerCase();
  });

  for (let txIdx = 0; txIdx < txs.length; txIdx++) {
    const tx = txs[txIdx];

    // ignore zero tx
    if (tx.value === 0n) {
      console.log("ignore zero value tx: " + tx.hash);
      continue;
    }

    // ignore self
    if (tx.from === tx.to) {
      console.log("ignore from === to tx: " + tx.hash);
      continue;
    }

    // filter by targets
    for (let trgIdx = 0; trgIdx < targetList.length; trgIdx++) {
      const trg = targetList[trgIdx];
      if (tx.from === trg.address) {
        const toTrg = targetList.find((item) => item.address === tx.to);
        if (toTrg) {
          // from target to a know address
          txlogger(tx.value, trg.name, toTrg.name, tx.hash);
        } else {
          // from target to unknow
          txlogger(tx.value, trg.name, tx.to, tx.hash);
        }
      } else if (tx.to === trg.address) {
        const fromTrg = targetList.find((item) => item.address === tx.from);
        if (!fromTrg) {
          // from unknow to target
          txlogger(tx.value, tx.from, trg.name, tx.hash);
        }
      }
    }
  }

  // end of parsing transactions
  process.exit();
});
