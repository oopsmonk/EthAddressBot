import { Web3 } from "web3";
import { type AddressList, type Transaction } from "./types";
import addrList from "./targetAddresses.json";

const targetList: AddressList[] = addrList.target;
const aliasList: AddressList[] = addrList.alias;

// compare addresses with lowercase
targetList.forEach((t) => {
  t.address = t.address.toLocaleLowerCase();
});
aliasList.forEach((t) => {
  t.address = t.address.toLocaleLowerCase();
});

function txlogger(value: bigint, from: string, to: string, hash: string) {
  const ether = Web3.utils.fromWei(value, "ether");
  console.log(`value: ${ether} , from: ${from}, to: ${to}\n${Bun.env.TX_HASH_URL}${hash}`);
}

self.addEventListener("message", async (event) => {
  if (event.data.txs) {
    const txs = event.data.txs as Transaction[];
    // console.log("console logger [" + txs.length + "] txs:");
    for (const tx of txs) {
      const fromTg = targetList.find((item) => item.address === tx.from);
      const fromAlias = aliasList.find((item) => item.address === tx.from);
      const toTg = targetList.find((item) => item.address === tx.to);
      const toAlias = aliasList.find((item) => item.address === tx.to);
      if (fromTg && toTg) {
        // from taget to target
        txlogger(tx.value, fromTg.name, toTg.name, tx.hash);
      } else if (fromTg && toAlias) {
        // from target to alias
        txlogger(tx.value, fromTg.name, toAlias.name, tx.hash);
      } else if (fromAlias && toTg) {
        // from alias to target
        txlogger(tx.value, fromAlias.name, toTg.name, tx.hash);
      } else if (fromTg) {
        // from target to unknow
        txlogger(tx.value, fromTg.name, tx.hash, tx.hash);
      } else if (toTg) {
        // from unknow to target
        txlogger(tx.value, tx.hash, toTg.name, tx.hash);
      } else {
        // unexpected case?
        console.log("unknow tx??");
        console.warn(
          "[unexpected] value:" +
            tx.value +
            " from: " +
            tx.from +
            " , to: " +
            tx.to +
            " , hash: " +
            tx.hash
        );
      }
    }
  }
});
