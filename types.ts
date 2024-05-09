export interface AddressList {
  name: string;
  address: string;
}

export interface Transaction {
  blockHash: string;
  blockNumber: bigint;
  from: string;
  gas: bigint;
  gasPrice: bigint;
  hash: string;
  input: string;
  nonce: bigint;
  to: string;
  transactionIndex: bigint;
  value: bigint;
  type: bigint;
  chainId: bigint;
  v: bigint;
  r: string;
  s: string;
}
