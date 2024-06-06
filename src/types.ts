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
    IMPOERT_TX_HASH: string;
    ZROK_SHARE_DURATION: string;
    ZROK_SHARE_DIR: string;
    EXPORT_TX_FILE: string;
    DEBUG_LEVEL: string;
  }
}

export interface AddressList {
  name: string;
  address: string;
}

export interface Web3Transaction {
  hash: string;
  type: bigint;
  nonce: bigint;
  blockHash?: string;
  blockNumber?: bigint;
  transactionIndex: bigint;
  from: string;
  to?: string;
  value: bigint;
  gas: bigint;
  gasPrice: bigint;
  input: string;
  v: bigint;
  r: string;
  s: string;
}

export interface Transaction {
  blockHash?: string;
  blockNumber?: bigint;
  hash: string;
  from: string;
  to?: string;
  transactionIndex: bigint;
  value: bigint;
}
