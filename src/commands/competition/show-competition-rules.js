import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";

export class ShowCompetitionRulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-competition-rules",
      description: "Show the Competition Corner rules.",
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    registry.registerChatInputCommand(
      (builder) => builder.setName(this.name).setDescription(this.description),
      { guildIds: [guildId] },
    );
  }

  async chatInputRun(interaction) {
    return showCompetitionRules(interaction);
  }
}

export const showCompetitionRules = async (interaction) => {
  const rulesEmbed = new EmbedBuilder()
    .setTitle("🕹️ Welcome to COMPETITION CORNER")
    .setDescription(
      `Where we all play the [**Table of the Week!**](https://discord.com/channels/${process.env.GUILD_ID}/${process.env.COMPETITION_CHANNEL_ID}/${process.env.COMPETITION_WEEKLY_POST_ID})`,
    )
    .addFields(
      {
        name: "📜 Rules",
        value:
          "1. Look at the Leaderboard pin for a link to the current table. You **MUST** use the specified table and version.\n" +
          "2. No table or script modifications allowed that affect gameplay (including ROM selection).\n" +
          "3. Number of balls per game **MUST NOT** be modified.\n" +
          "4. No **EXTRA BALL** buy-ins.\n" +
          "5. Only **SINGLE-PLAYER** games allowed.\n" +
          "6. **Death Saves** and **Bangbacks** are banned. Natural lazarus bounces are permitted.\n" +
          "7. You **MUST** post a pic/screenshot of your score including full table (and backglass if needed). Score must be at end of game (Match Sequence, Credit Award, etc). High Score roster screenshots are not allowed.\n" +
          "8. **Rollovers:** Scores exceeding game limits require proof prior to rollover (photo or video).\n" +
          "9. To post a score you **MUST** use `/post-score` or `!score` (see below).\n" +
          "10. Gameplay runs **Monday–Sunday**, ending at midnight Pacific time.",
      },
      {
        name: "🤖 How to Use Score Bot",
        value:
          "Post a score: `!score <value>` and attach a photo\n" +
          "Or use: `/post-score`\n" +
          "View your score info: `/show-score`\n" +
          "View the current leaderboard: `/show-leaderboard`",
      },
      {
        name: "🎟️ Table Raffle",
        value:
          "Post a score, then use `/enter-raffle` to enter a table of your choice. Draw happens at midnight Pacific on the final day.\n" +
          "Monitor the raffle with `/show-raffle-board`.\n" +
          "See raffle rules with `/show-raffle-rules`.",
      },
    )
    .setColor("Blue");

  const leagueEmbed = new EmbedBuilder()
    .setTitle("🏆 Competition Corner Pinball League")
    .addFields(
      {
        name: "📅 Season 6 Info",
        value:
          "**Dates:** TBD\n" +
          "**Length:** Regular Season – 12 weeks | Playoffs – 4 weeks\n" +
          "Any player who participates during the season automatically accumulates points. No extra step to join.",
      },
      {
        name: "📊 Weekly Scoring",
        value:
          "1st: 12pts | 2nd: 10pts | 3rd: 9pts | 4th: 8pts | 5th: 7pts\n" +
          "6th: 6pts | 7th: 5pts | 8th: 4pts | 9th: 3pts | 10th: 2pts | 11th+: 1pt\n" +
          "Ties broken by total accumulated scores. Scores must be posted by **Sunday, 12am PST**. Missing a week means **no points** — including during playoffs.",
      },
      {
        name: "🥊 Playoff Format",
        value:
          "Top 16 players at end of regular season advance to the **Tournament of Champions**. Single elimination over 4 weeks, bracketed via S-curve method (1 vs. 16, 2 vs. 15, etc.).\n" +
          "No exceptions for missing a playoff week — missing = forfeit (if opponent posted).",
      },
      {
        name: "❓ Questions?",
        value:
          "Contact <@1069383371127541800> or <@718313274164117505> with questions about posting scores.\n\n" +
          `Winner at the end of the weekly competition will be posted with their score in the [**${process.env.BRAGGING_RIGHTS_CHANNEL_NAME}**](https://discord.com/channels/${process.env.GUILD_ID}/${process.env.BRAGGING_RIGHTS_CHANNEL_ID}) channel.`,
      },
    )
    .setColor("Blue");

  return interaction.reply({ embeds: [rulesEmbed, leagueEmbed], flags: 64 });
};
