import Web3 from "web3";
import { type AddressList, type Transaction } from "./types";
import addrList from "./targetAddresses.json";

// prevents TS errors
declare var self: Worker;

const targetList: AddressList[] = addrList.target;
const aliasList: AddressList[] = addrList.alias;
const loggedTxs: Transaction[] = [];

// compare addresses with lowercase
targetList.forEach((t) => {
  t.address = t.address.toLocaleLowerCase();
});
aliasList.forEach((t) => {
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

  for (const tx of txs) {
    // ignore zero tx
    if (tx.value === 0n) {
      console.log("ignore zero value tx: " + tx.hash);
      continue;
    }

    // ignore self?
    if (tx.from === tx.to) {
      console.log("ignore from === to tx: " + tx.hash);
      continue;
    }

    // if from and to addresses are both in the target list
    const toTg = targetList.find((item) => item.address === tx.to);
    const fromTg = targetList.find((item) => item.address === tx.from);
    if (toTg && fromTg) {
      // console.log("push to db: " + tx.hash);
      loggedTxs.push(tx);
      continue;
    }

    // filter by targets
    for (const trg of targetList) {
      if (tx.from === trg.address || tx.to === trg.address) {
        // push to tx list
        // console.log("push to tx list: " + tx.hash);
        loggedTxs.push(tx);
      }
    }
  }

  if (loggedTxs.length) {
    // dump txs for debug
    // console.log("logged [" + loggedTxs.length + "]transactions: ");
    // loggedTxs.forEach((tx) => console.log(tx.hash));
    postMessage(loggedTxs);
  }
  // end of parsing transactions
  process.exit();
});
