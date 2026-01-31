import "dotenv/config";
import { SapphireClient, LogLevel } from "@sapphire/framework";
import { GatewayIntentBits, Partials } from "discord.js";
import { initDatabase, closeDatabase } from "./services/database.js";
import logger from "./utils/logger.js";
import { SapphirePinoLogger } from "./utils/sapphire-logger.js";

// Register preconditions
import "./preconditions/CompetitionChannel.js";
import "./preconditions/CompetitionAdminRole.js";
import "./preconditions/HighScoresChannel.js";

const client = new SapphireClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
  loadMessageCommandListeners: true,
  defaultPrefix: "!",
  baseUserDirectory: import.meta.dirname,
  logger: { instance: new SapphirePinoLogger(LogLevel.Info) },
});

async function main() {
  try {
    logger.info("Starting VPC Bot...");

    // Initialize database connection
    logger.info("Connecting to database...");
    await initDatabase();
    logger.info("Database connected successfully");

    // Login to Discord
    logger.info("Logging in to Discord...");
    await client.login(process.env.BOT_TOKEN);
  } catch (error) {
    logger.error("Failed to start bot:", error);
    await closeDatabase();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully...");
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully...");
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection at:", promise, "reason:", reason);
});

main();
