export enum LogLevel {
  Info = "I",
  Error = "E",
  Debug = "D",
}

// Log level priorities
const logLevelPriority = {
  [LogLevel.Debug]: 0,
  [LogLevel.Info]: 1,
  [LogLevel.Error]: 2,
};

const getDebugCgf = (): LogLevel => {
  const cfg = Bun.env.DEBUG_LEVEL.toLocaleLowerCase();
  switch (cfg) {
    case "info":
      return LogLevel.Info;
    case "error":
      return LogLevel.Error;
    case "debug":
      return LogLevel.Debug;
    default:
      return LogLevel.Error;
  }
};

// Set the current log level
const currentLogLevel: LogLevel = getDebugCgf();

// Function to determine if a message should be logged based on the current log level
const shouldLog = (level: LogLevel): boolean =>
  logLevelPriority[level] >= logLevelPriority[currentLogLevel];

export const logger = (level: LogLevel, tag: string = "", message: string) => {
  if (shouldLog(level)) {
    tag === ""
      ? console.log(`[${new Date().toISOString()}] [${level}] ${message}`)
      : console.log(`[${new Date().toISOString()}] [${level}] [${tag}] ${message}`);
  }
};
