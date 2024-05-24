declare module "bun" {
  interface Env {
    RPC_PROVIDER: string;
    LATEST_BLOCK_WORKER_INTERVAL: string;
    TX_HASH_URL: string;
    TX_IGNORE_ZERO: string;
    TX_IGNORE_SELF: string;
    LATEST_BLOCK_NUMBER: string;
    LINE_ACCESS_TOKEN: string;
    LINE_CHANNEL_SECRET: string;
    LINE_USERS: string;
    LINE_GROUPS: string;
    DB_FILE: string;
  }
}

export interface AddressList {
  name: string;
  address: string;
}

export interface Transaction {
  blockHash?: string;
  blockNumber?: string;
  from: string;
  gas: string;
  gasPrice: string;
  hash: string;
  input: string;
  nonce: string;
  to: string | undefined | null;
  transactionIndex?: string;
  value: string;
  chainId?: bigint;
}
