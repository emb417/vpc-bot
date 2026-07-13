# VPC Bot

Discord bot for the Virtual Pinball Chat league - manages weekly competitions, high scores, playoffs, and leaderboards.

## Tech Stack

- Node.js 24
- discord.js 14
- @sapphire/framework
- @sapphire/plugin-subcommands
- MongoDB

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:
   - `BOT_TOKEN` - Discord bot token
   - `GUILD_ID` - Discord server ID
   - `COMMANDS_DIR` - Path to commands directory
   - `CONTEST_CHANNELS` - Comma-separated list of channel IDs where contests are active
   - `COMPETITION_CHANNEL_NAME` - Main competition channel name
   - `HIGHSCORES_CHANNEL_NAME` - High scores channel name
   - `BOT_COMPETITION_ADMIN_ROLE_NAME` - Role name for competition admins
   - `BOT_HIGH_SCORE_ADMIN_ROLE_NAME` - Role name for high score admins

3. Start the bot:

   ```bash
   npm start
   ```

## Automated Tasks

The bot performs several maintenance tasks automatically based on a schedule:

- **Weekly Raffle & Competition Rollover:** Every Monday at 12:00 AM PT, the bot runs the weekly raffle, selects winners, and prepares the next competition week.
- **Tournament Maintenance:** Every day at 12:05 AM PT, the bot:
  - Ends any active tournaments that have reached their end date.
  - Announces any new tournaments that are starting that day by posting the tournament details card.

## Commands

### User Commands

These commands are available to all users in the appropriate channels.

#### `/post-score`

Post your score for the current weekly competition. **Requires an attached screenshot.**

```bash
/post-score 1234567
/post-score 1,234,567
/post-score 9876543 y    # Also post to high scores channel
```

#### `/post-high-score`

Post a high score to a specific table. **Requires an attached screenshot.**

```bash
/post-high-score 5000000 medieval madness
/post-high-score 12345678 attack from mars
```

#### `/show-leaderboard`

Display the current weekly leaderboard for the competition.

```bash
/show-leaderboard
```

#### `/show-score`

Show your current score in the weekly competition.

```bash
/show-score
```

#### `/show-teams`

Display the teams for the current team competition.

```bash
/show-teams
```

#### `/show-playoffs`

Show the current playoff bracket and standings.

```bash
/show-playoffs
```

#### `/show-tournament`

Show the active tournament for the current channel and its associated tables.

```bash
/show-tournament
```

#### `/post-tournament-score`

Post a score for a specific table in the active tournament. **Requires an attached screenshot and table selection.**

```bash
/post-tournament-score score:1234567 table:Medieval Madness
```

#### `/show-tournament-leaderboard`

Display the overall standings for the active tournament.

```bash
/show-tournament-leaderboard
```

#### `/show-tournament-rules`

Show the tournament rules and how points are scored.

```bash
/show-tournament-rules
```

#### `/generate-random-number`

Generate a random number between 1 and a specified maximum.

```bash
/generate-random-number max:100
```

---

### Admin Commands

These commands require the Competition Admin or High Score Admin role.

#### Competition Management

##### `/create-week`

Create a new weekly competition by VPS ID.

```bash
/create-week vpsid:xyz123 romrequired:true mode:classic
/create-week vpsid:xyz123 romrequired:false mode:default startdateoverride:2024-01-15 enddateoverride:2024-01-22
```

| Parameter         | Description                        |
| ----------------- | ---------------------------------- |
| vpsid             | VPS table ID                       |
| romrequired       | Whether ROM is required            |
| mode              | Game mode (default, classic, etc.) |
| startdateoverride | Optional start date                |
| enddateoverride   | Optional end date                  |
| b2sidoverride     | Optional B2S ID override           |
| notes             | Optional notes                     |

##### `/edit-current-week`

Edit the current week's settings.

```bash
/edit-current-week weeknumber:5 table:Medieval Madness mode:classic
```

##### `/edit-score`

Edit a user's score in the current competition.

```bash
/edit-score username:PlayerName score:5000000
```

##### `/remove-score`

Remove a score by rank from the current competition.

```bash
/remove-score rank:3
```

#### Tournament Management

##### `/create-tournament`

Create a new tournament in the current channel.

```bash
/create-tournament name:"Spring Classic" vpsids:"vps1,vps2" startdate:2024-04-01 enddate:2024-04-15
```

##### `/edit-tournament`

Edit the active tournament's ROM info, dates, or notes.

```bash
/edit-tournament table:Medieval Madness romname:"v1.2" notes:"Updated rules"
/edit-tournament startdate:2024-04-05 enddate:2024-04-20
```

##### `/edit-tournament-score`

Edit a player's score for a specific table in the active tournament.

```bash
/edit-tournament-score table:Medieval Madness username:PlayerName score:6000000
```

##### `/remove-tournament-score`

Remove a player's score from a table in the active tournament.

```bash
/remove-tournament-score table:Medieval Madness username:PlayerName
```

##### `/remove-tournament`

Remove a scheduled tournament that is not currently ongoing.

```bash
/remove-tournament
```

##### `/end-tournament`

End the active tournament and announce the winner.

```bash
/end-tournament
```

#### Season Management

##### `/create-season`

Create a new season.

```bash
/create-season seasonnumber:5 seasonname:Spring 2024 seasonstart:2024-03-01 seasonend:2024-05-31
```

##### `/edit-current-season`

Edit the current season's settings.

```bash
/edit-current-season seasonnumber:5 seasonname:Spring 2024 seasonstart:2024-03-01 seasonend:2024-05-31
```

##### `/show-season-leaderboard`

Display the season leaderboard.

```bash
/show-season-leaderboard
```

#### Team Management

##### `/create-team`

Create a new team for the current competition.

```bash
/create-team team:Team Alpha: player1, player2, player3
```

##### `/edit-team-name`

Rename an existing team.

```bash
/edit-team-name current-team-name:Team Alpha new-team-name:Team Omega
```

##### `/remove-team`

Remove a team from the current competition.

```bash
/remove-team team:Team Alpha
```

##### `/suggest-teams`

Auto-suggest balanced teams based on player history.

```bash
/suggest-teams messageId:123456789 numberOfWeeksToTotal:4 numberOfTeams:4 minTeamSize:3
```

#### Playoff Management

##### `/create-playoff`

Create a new playoff from the current season leaderboard.

```bash
/create-playoff
```

##### `/create-playoff-round`

Create a new playoff round.

```bash
/create-playoff-round roundName:Quarterfinals gameList:game1,game2,game3,game4
```

#### High Score Management

##### `/create-high-score-table`

Create a new high score table by VPS ID.

```bash
/create-high-score-table vpsid:xyz123
```

##### `/remove-high-score`

Remove a specific high score entry.

```bash
/remove-high-score vpsid:xyz123 username:PlayerName score:5000000
```

##### `/show-table-high-scores`

Search and display high scores for a table.

```bash
/show-table-high-scores tablesearchterm:medieval madness
/show-table-high-scores vpsid:xyz123
```

##### `/show-table-list`

Display the list of available high score tables.

```bash
/show-table-list
```

#### Utility Commands

##### `/create-message`

Create a placeholder message authored by the bot.

```bash
/create-message
```

##### `/repin-message`

Repin the competition corner pinned message.

```bash
/repin-message
```

##### `/run-raffle`

Run a raffle for the current competition participants.

```bash
/run-raffle
```

##### `/show-commands`

Show all available commands (admin only).

```bash
/show-commands
```

## Docker

Build and run with Docker Compose:

```bash
# From vpc-compose directory
docker-compose -f docker-compose-local.yml up -d --build vpc-bot

# View logs
docker-compose -f docker-compose-local.yml logs --tail=50 vpc-bot
```

## Project Structure

The project follows a modular structure within the `src/` directory:

- `commands/`: Contains various command handlers for user and admin interactions, categorized by function (e.g., `competition`, `highscores`, `teams`, `utility`).
- `lib/`: Houses reusable logic and data handling, such as data pipelines, VPC/VPS data, and output formatting.
- `listeners/`: Handles Discord events and custom event listeners.
- `preconditions/`: Implements checks for command execution (e.g., channel restrictions, role requirements).
- `services/`: Contains core business logic, like database interactions (`database.js`).
- `utils/`: Provides utility functions for argument parsing, formatting, and logging.
- `index.js`: The main entry point for the application, responsible for initializing the Discord client, database connection, and logging in.

## Notes

- Slash commands use `/` prefix (e.g., `/show-leaderboard`)
- Error messages auto-delete after 10 seconds
- Screenshots are required when posting scores
