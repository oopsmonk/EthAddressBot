# :warning: WORK IN PROGRESS :warning:

# EthAddressLogger

Monitoring Addresses from the `targetAddresses.json` file, show transactions of `target` addresses in the console or via Line Bot.

1. copy and modify the `targetAddresses-example.json` to `targetAddressess.json`
2. copy and modify the `.env.exmaple` to `.env`
3. Run `bun install` to install requirments
4. Run `bun dev` to start the service

This project was created using `bun init` in bun v1.1.7. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Get history via Line (Optional)

Adds Line configurations in `.env` file and shares transaction history via [zrok](https://zrok.io/)

Install and configure Zrok: [Getting Started with zrok](https://docs.zrok.io/docs/getting-started/)

Setup configurations in `.env`

```
LINE_ACCESS_TOKEN=""
LINE_CHANNEL_SECRET=""
# whitelist
LINE_USERS=""
LINE_GROUPS=""
# for history download
ZROK_SHARE_DURATION=5
ZROK_SHARE_DIR="./bin/history"
EXPORT_TX_FILE="transactions.xlsx"
```
