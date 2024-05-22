// Ref: https://github.com/line/line-bot-sdk-nodejs/tree/master/examples/echo-bot-ts-esm

// Import all dependencies, mostly using destructuring for better view.
import type { ClientConfig, MessageAPIResponseBase, MiddlewareConfig } from "@line/bot-sdk";
import { messagingApi, middleware, webhook, HTTPFetchError } from "@line/bot-sdk";
import type { Application, Request, Response } from "express";
import express from "express";
import { targetList, aliasList } from "./constants";
import Web3 from "web3";
import type { Transaction } from "./types";

const lineUsers: string = Bun.env.LINE_USERS || "";
const lineGroups: string = Bun.env.LINE_GROUPS || "";
const userList: string[] = lineUsers.split(",");
const groupList: string[] = lineGroups.split(",");

// Setup all LINE client and Express configurations.
const clientConfig: ClientConfig = {
  channelAccessToken: Bun.env.LINE_ACCESS_TOKEN || "",
};

const middlewareConfig: MiddlewareConfig = {
  channelSecret: Bun.env.LINE_CHANNEL_SECRET || "",
};

const PORT = Bun.env.PORT || 3030;

// Create a new LINE SDK client.
const client = new messagingApi.MessagingApiClient(clientConfig);

// Create a new Express application.
const app: Application = express();

// Function handler to receive the text.
const textEventHandler = async (
  event: webhook.Event
): Promise<MessageAPIResponseBase | undefined> => {
  // Process all variables here.

  if (event.type === "join" || event.type === "leave") {
    if (event.source && event.source.type === "group")
      console.log("Bot " + event.type + " group id: " + event.source.groupId);
  }
  // Check if for a text message
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  // Process all message related variables here.

  // Check if message is repliable
  if (!event.replyToken) return;

  console.log("user : " + event.source?.userId + " , msg: " + event.message.text);
  // handle commands
  if (event.message.text === "\\alias") {
    let text = "";
    for (const t of targetList) {
      text = text.concat(`${t.name}:\n${t.address}\n`);
    }
    for (const a of aliasList) {
      text = text.concat(`${a.name}:\n${a.address}\n`);
    }

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: text,
        },
      ],
    });
  } else if (event.message.text === "help") {
    let text = "";
    text = text.concat("\\alias - List of Known Addresses\n");
    text = text.concat("\\config - Current Settings\n");
    text = text.concat("\\history- Trasaction History\n");
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: text,
        },
      ],
    });
  } else if (event.message.text === "\\config") {
    const web3 = new Web3(new Web3.providers.HttpProvider(Bun.env.RPC_PROVIDER));
    const networkBlock = await web3.eth.getBlockNumber();
    const chainId = await web3.eth.getChainId();
    let config = `RPC endpoint:\n${Bun.env.RPC_PROVIDER}\n`;
    config = config.concat(`Chain ID: ${chainId}\n`);
    config = config.concat(`Network Block Number: ${networkBlock}\n`);
    config = config.concat(
      `Block Interval: ${Number(Bun.env.LATEST_BLOCK_WORKER_INTERVAL) / 1000}s`
    );
    config = config.concat(`Explorer: ${Bun.env.TX_HASH_URL}\n`);
    config = config.concat(`DB File: ${Bun.env.DB_FILE}\n`);

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: config,
        },
      ],
    });
  } else if (event.message.text === "\\history") {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: "TODO",
        },
      ],
    });
  } else if (event.message.text === "\\ping") {
    // Create a new message.
    // Reply to the user.
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: "pong",
        },
      ],
    });
  }
};

function tx2Text(value: bigint, from: string, to: string, hash: string): string {
  const ether = Web3.utils.fromWei(value, "ether");
  return `from: ${from}\nto: ${to}\nvalue:${ether}\n${Bun.env.TX_HASH_URL}${hash}\n===\n`;
}

export function sendTxLog(txs: Transaction[]) {
  let text = "";
  for (const tx of txs) {
    const fromTg = targetList.find((item) => item.address === tx.from);
    const fromAlias = aliasList.find((item) => item.address === tx.from);
    const toTg = targetList.find((item) => item.address === tx.to);
    const toAlias = aliasList.find((item) => item.address === tx.to);
    if (fromTg && toTg) {
      // from taget to target
      text = text.concat(tx2Text(tx.value, fromTg.name, toTg.name, tx.hash));
    } else if (fromTg && toAlias) {
      // from target to alias
      text = text.concat(tx2Text(tx.value, fromTg.name, toAlias.name, tx.hash));
    } else if (fromAlias && toTg) {
      // from alias to target
      text = text.concat(tx2Text(tx.value, fromAlias.name, toTg.name, tx.hash));
    } else if (fromTg) {
      // from target to unknow
      text = text.concat(tx2Text(tx.value, fromTg.name, tx.hash, tx.hash));
    } else if (toTg) {
      // from unknow to target
      text = text.concat(tx2Text(tx.value, tx.hash, toTg.name, tx.hash));
    } else {
      // unexpected case?
      console.log("[uncexpected] tx skip??");
    }
  }
  // console.log("Bot text:\n" + text);
  // send out the text
  sendGroupText(text);
}

export function sendUsersText(text: string) {
  // to user list
  for (const user of userList) {
    if (user.length) {
      console.log("msg to user: " + user + " , " + text);
      client.pushMessage({ to: user, messages: [{ type: "text", text: text }] }).catch((err) => {
        console.log("send msg err: ");
        console.log(err);
      });
    }
  }
}

export function sendGroupText(text: string) {
  // to group list
  for (const group of groupList) {
    if (group.length) {
      console.log("msg to group: " + group + " , " + text);
      client.pushMessage({ to: group, messages: [{ type: "text", text: text }] }).catch((err) => {
        console.log("send msg err: ");
        console.log(err);
      });
    }
  }
}

export function startServer() {
  // Register the LINE middleware.
  // As an alternative, you could also pass the middleware in the route handler, which is what is used here.
  // app.use(middleware(middlewareConfig));

  // Route handler to receive webhook events.
  // This route is used to receive connection tests.
  app.get("/", async (_: Request, res: Response): Promise<Response> => {
    return res.status(200).json({
      status: "success",
      message: "Connected successfully!",
    });
  });

  // This route is used for the Webhook.
  app.post(
    "/callback",
    middleware(middlewareConfig),
    async (req: Request, res: Response): Promise<Response> => {
      const callbackRequest: webhook.CallbackRequest = req.body;
      const events: webhook.Event[] = callbackRequest.events!;

      // Process all the received events asynchronously.
      const results = await Promise.all(
        events.map(async (event: webhook.Event) => {
          try {
            await textEventHandler(event);
          } catch (err: unknown) {
            if (err instanceof HTTPFetchError) {
              console.error(err.status);
              console.error(err.headers.get("x-line-request-id"));
              console.error(err.body);
            } else if (err instanceof Error) {
              console.error(err);
            }

            // Return an error message.
            return res.status(500).json({
              status: "error",
            });
          }
        })
      );

      // Return a successful message.
      return res.status(200).json({
        status: "success",
        results,
      });
    }
  );

  // Create a server and listen to it.
  app.listen(PORT, () => {
    console.log(`Line Bot start at port: ${PORT}`);
    console.log("Users:" + userList);
    console.log("Groups: " + groupList);
  });
}
