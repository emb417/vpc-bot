# VPC Bot Project Context

This document provides an overview of the VPC Bot project, its structure, and how to build, run, and develop it.

## Project Overview

The VPC Bot is a Discord bot designed for the Virtual Pinball Chat (VPC) league. Its primary purpose is to manage and facilitate various aspects of the league, including:

- **Weekly Competitions:** Handling score submissions and leaderboards for ongoing competitions.
- **High Scores:** Managing high score tables for individual pinball machines.
- **Playoffs:** Organizing and tracking playoff brackets and standings.
- **Team Management:** Facilitating team creation and management for team-based competitions.

**Key Technologies:**

- **Runtime:** Node.js (v22 specified in README, v24 in Dockerfile)
- **Discord API Wrapper:** discord.js (v14)
- **Command Framework:** @sapphire/framework (with @sapphire/plugin-subcommands)
- **Database:** MongoDB (using `mongodb` driver and `mongo-dot-notation`)
- **Configuration:** dotenv
- **Logging:** pino, pino-pretty
- **Scheduling:** node-cron (potentially for automated tasks, though not explicitly detailed in commands)
- **Containerization:** Docker

**Architecture:**

The project follows a modular structure within the `src/` directory:

- `commands/`: Contains various command handlers for user and admin interactions, categorized by function (e.g., `competition`, `highscores`, `teams`, `utility`).
- `lib/`: Houses reusable logic and data handling, such as data pipelines, VPC/VPS data, and output formatting.
- `listeners/`: Handles Discord events and custom event listeners.
- `preconditions/`: Implements checks for command execution (e.g., channel restrictions, role requirements).
- `services/`: Contains core business logic, like database interactions (`database.js`).
- `utils/`: Provides utility functions for argument parsing, formatting, and logging.
- `index.js`: The main entry point for the application, responsible for initializing the Discord client, database connection, and logging in.

## Building and Running

### Local Development

1. **Install Dependencies:**

   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory and populate it with the following variables. Refer to the `README.md` for detailed descriptions of each variable:
   - `BOT_TOKEN`
   - `GUILD_ID`
   - `COMMANDS_DIR`
   - `CONTEST_CHANNELS`
   - `COMPETITION_CHANNEL_NAME`
   - `HIGHSCORES_CHANNEL_NAME`
   - `BOT_CONTEST_ADMIN_ROLE_NAME`
   - `BOT_HIGH_SCORE_ADMIN_ROLE_NAME`

3. **Start the Bot:**

   ```bash
   npm start
   ```

   This command executes `node src/index.js`.

### Docker

The project includes a `Dockerfile` for containerized deployment.

1. **Build and Run with Docker Compose:**
   Navigate to the `vpc-compose` directory (if separate) or ensure `docker-compose-local.yml` is accessible.

   ```bash
   # Assuming docker-compose-local.yml is in the project root or a known path
   docker-compose -f docker-compose-local.yml up -d --build vpc-bot
   ```

2. **View Logs:**

   ```bash
   docker-compose -f docker-compose-local.yml logs --tail=50 vpc-bot
   ```

## Development Conventions

- **Language Features:** Uses modern JavaScript features, including ES Modules (`"type": "module"` in `package.json`).
- **Code Organization:** Follows a clear directory structure for commands, services, utilities, etc., promoting maintainability.
- **Command Handling:** Leverages `@sapphire/framework` for robust command loading, argument parsing, and precondition checks. Commands can be message-based (prefixed with `!`) or slash commands (prefixed with `/`).
- **Error Handling:** Implements graceful shutdown procedures for `SIGINT` and `SIGTERM` signals, and includes handlers for uncaught exceptions and unhandled rejections for stability.
- **Logging:** Utilizes `pino` for structured, high-performance logging, with `pino-pretty` for development readability.
- **Configuration Management:** Relies on environment variables managed via `dotenv` for sensitive information and configurable settings.
- **Security:** The Dockerfile creates a non-root user (`nodejs`) for running the application, enhancing security. It also ensures the data directory has correct ownership.
- **Data Storage:** Interacts with MongoDB for persistent data storage.
