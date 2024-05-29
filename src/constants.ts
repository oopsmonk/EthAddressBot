import addrList from "../targetAddresses.json";
import type { AddressList } from "./types";

export const targetList: AddressList[] = addrList.target;
export const aliasList: AddressList[] = addrList.alias;

// compare addresses with lowercase
targetList.forEach((t) => {
  t.address = t.address.toLocaleLowerCase();
});
aliasList.forEach((t) => {
  t.address = t.address.toLocaleLowerCase();
});
