// Ref: https://github.com/line/line-bot-sdk-nodejs/tree/master/examples/echo-bot-ts-esm

// Import all dependencies, mostly using destructuring for better view.
import type { ClientConfig, MessageAPIResponseBase, MiddlewareConfig } from "@line/bot-sdk";
import { messagingApi, middleware, webhook, HTTPFetchError } from "@line/bot-sdk";
import type { Application, Request, Response } from "express";
import express from "express";
import { targetList, aliasList } from "./constants";
import Web3 from "web3";
import type { Transaction } from "./types";
import { dbGetLatestBlockNum, tx2file } from "./utils";
import * as path from "path";
import { LogLevel, logger } from "./logger";
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

const lineUsers: string = Bun.env.LINE_USERS || "";
const lineGroups: string = Bun.env.LINE_GROUPS || "";
const userList: string[] = lineUsers.split(",");
const groupList: string[] = lineGroups.split(",");
const tag = "LineBot";

let zrokProcess: ChildProcessWithoutNullStreams | undefined = undefined;

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

const prepareHistory = async (event: webhook.MessageEvent, url: string) => {
  const filePath = path.join(Bun.env.ZROK_SHARE_DIR, Bun.env.EXPORT_TX_FILE);
  const downloadURL = `${url}/${Bun.env.EXPORT_TX_FILE}`;
  const rows = tx2file(filePath);
  let msg = `Export ${rows} txs into\n${downloadURL}\n`;
  msg = msg.concat(`the link will be expired in ${Bun.env.ZROK_SHARE_DURATION} minutes\n`);

  if (!event.replyToken) return;

  logger(LogLevel.Debug, tag, `sent: \n${msg}`);
  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: msg,
      },
    ],
  });
};

// Function handler to receive the text.
const textEventHandler = async (
  event: webhook.Event,
): Promise<MessageAPIResponseBase | undefined> => {
  // Process all variables here.

  if (event.type === "join" || event.type === "leave") {
    if (event.source && event.source.type === "group")
      logger(LogLevel.Info, tag, `Bot: ${event.type} , group id: ${event.source.groupId}`);
  }
  // Check if for a text message
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  // Process all message related variables here.

  // Check if message is repliable
  if (!event.replyToken) return;

  logger(LogLevel.Info, tag, `user: ${event.source?.userId} , msg: ${event.message.text}`);
  // handle commands
  if (event.message.text === "alias") {
    let text = "";
    for (const t of targetList) {
      text = text.concat(`${t.name}:\n${t.address}\n`);
    }
    for (const a of aliasList) {
      text = text.concat(`${a.name}:\n${a.address}\n`);
    }

    logger(LogLevel.Debug, tag, `sent: \n${text}`);
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
    text = text.concat("alias - List of Known Addresses\n");
    text = text.concat("config - Current Settings\n");
    text = text.concat("history- Trasaction History\n");
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: text,
        },
      ],
    });
  } else if (event.message.text === "config") {
    const web3 = new Web3(new Web3.providers.HttpProvider(Bun.env.RPC_PROVIDER));
    const networkBlock = await web3.eth.getBlockNumber();
    const chainId = await web3.eth.getChainId();
    const dbBlockNum = dbGetLatestBlockNum(chainId);
    let config = `RPC endpoint:\n${Bun.env.RPC_PROVIDER}\n`;
    config = config.concat(`Chain ID: ${chainId}\n`);
    config = config.concat(`Network Block Number: ${networkBlock}\n`);
    config = config.concat(`DB Block Number: ${dbBlockNum}\n`);
    config = config.concat(
      `Block Interval: ${Number(Bun.env.LATEST_BLOCK_WORKER_INTERVAL) / 1000}s\n`,
    );
    config = config.concat(`Explorer: ${Bun.env.TX_HASH_URL}\n`);
    config = config.concat(`Zrok share duration: ${Bun.env.ZROK_SHARE_DURATION} mins\n`);
    // config = config.concat(`DB File: ${Bun.env.DB_FILE}\n`);

    logger(LogLevel.Debug, tag, `sent: \n${config}`);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        {
          type: "text",
          text: config,
        },
      ],
    });
  } else if (event.message.text === "history") {
    if (!Bun.env.ZROK_SHARE_DURATION || !Bun.env.ZROK_SHARE_DIR || !Bun.env.EXPORT_TX_FILE) {
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [
          {
            type: "text",
            text: "Feature is not supported!",
          },
        ],
      });
    } else {
      zrokProcess = spawn("zrok", [
        "share",
        "public",
        "--headless",
        "--backend-mode",
        "web",
        Bun.env.ZROK_SHARE_DIR,
      ]);

      const killZrok = (signal: NodeJS.Signals) => {
        if (zrokProcess) {
          zrokProcess.kill(signal);
          logger(LogLevel.Info, tag, `Zrok process killed: ${signal}`);
        }
      };

      setTimeout(
        () => {
          // Send Ctrl+C to terminate the zrok
          killZrok("SIGINT");
          logger(LogLevel.Info, tag, `Share terminated after ${Bun.env.ZROK_SHARE_DURATION} mins.`);
        },
        Number(Bun.env.ZROK_SHARE_DURATION) * 60 * 1000,
      ); //  in milliseconds

      zrokProcess.stderr.on("data", (data) => {
        // console.error(`Error: ${data}`);
        const jsonData = JSON.parse(data);
        if (jsonData.msg) {
          const urlRegex = /(https?:\/\/[^\s]+)/;
          const match = jsonData.msg.match(urlRegex);

          if (match) {
            const url = match[0];
            // console.log("URL:", url);
            logger(LogLevel.Info, tag, `found URL: ${url}`);
            prepareHistory(event, url);
          }
        }
      });
    }
  } else if (event.message.text === "ping") {
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
      logger(LogLevel.Error, tag, `unexpected tx: ${tx.hash}`);
    }
  }
  // console.log("Bot text:\n" + text);
  logger(LogLevel.Debug, tag, `text: \n${text}`);
  // send out the text
  sendGroupText(text);
}

export function sendUsersText(text: string) {
  // to user list
  for (const user of userList) {
    if (user.length) {
      logger(LogLevel.Info, tag, `to user: ${user} , msg: ${text}`);
      client.pushMessage({ to: user, messages: [{ type: "text", text: text }] }).catch((err) => {
        logger(LogLevel.Error, tag, "sent msg error: ");
        console.log(err);
      });
    }
  }
}

export function sendGroupText(text: string) {
  // to group list
  for (const group of groupList) {
    if (group.length) {
      logger(LogLevel.Info, tag, `to group: ${group} , msg: ${text}`);
      client.pushMessage({ to: group, messages: [{ type: "text", text: text }] }).catch((err) => {
        logger(LogLevel.Error, tag, "sent msg error: ");
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
        }),
      );

      // Return a successful message.
      return res.status(200).json({
        status: "success",
        results,
      });
    },
  );

  // Create a server and listen to it.
  app.listen(PORT, () => {
    logger(LogLevel.Info, tag, `Line Bot start at port: ${PORT}`);
    logger(LogLevel.Info, tag, `Users: ${userList}`);
    logger(LogLevel.Info, tag, `Groups: ${groupList}`);
  });
}
