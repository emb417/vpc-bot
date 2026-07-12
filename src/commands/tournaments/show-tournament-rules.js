import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";

export class ShowTournamentRulesCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-tournament-rules",
      description: "Show the tournament rules and how points are scored.",
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
    return showTournamentRules(interaction);
  }
}

export const showTournamentRules = async (interaction) => {
  const rulesEmbed = new EmbedBuilder()
    .setTitle("📋 Tournament Rules")
    .setDescription(
      "*Tournaments are multi-table events — battle across every table to climb the overall standings!*",
    )
    .addFields(
      {
        name: "🎯 Format",
        value:
          "• Each tournament runs **multiple tables** over a set start and end window. Scores only count while the tournament is **open**.\n" +
          "• Post your scores in the tournament's own Discord channel.\n" +
          "• When posting, **select the correct table** — the table is required and chosen from the tournament's table list.",
      },
      {
        name: "🛠️ Table & Gameplay",
        value:
          "• You **MUST** use the specified table and version for each table in the tournament.\n" +
          "• No table or script modifications allowed that affect gameplay (including ROM selection).\n" +
          "• Number of balls per game **MUST NOT** be modified.\n" +
          "• No **EXTRA BALL** buy-ins allowed.\n" +
          "• Only **SINGLE-PLAYER** games allowed.\n" +
          '• Techniques such as "Death Saves" and "Bangbacks" are **banned**. "Lazarus" bounces are permitted as they are mechanical in nature.',
      },
      {
        name: "📸 Score Submission",
        value:
          "• Post a pic/screenshot of your score (including backglass and full table) for entry.\n" +
          "• Scores must be posted during the Match Sequence or Credit Award. High score roster photos (Grand Champion, etc.) are **not allowed** as we cannot verify when they were taken.\n" +
          "• Rollovers require proof (photo or video) prior to the rollover.",
      },
    )
    .setColor("Blue");

  const pointsEmbed = new EmbedBuilder()
    .setTitle("🏁 Points System")
    .setDescription(
      "Points are awarded per table based on your rank on that table.",
    )
    .addFields(
      {
        name: "Per-Table Points",
        value:
          "1st: **25** | 2nd: **18** | 3rd: **15** | 4th: **12** | 5th: **10**\n" +
          "6th: **8** | 7th: **6** | 8th: **4** | 9th: **2** | 10th: **1**\n" +
          "11th and below: **1 pt** per table",
      },
      {
        name: "Overall Standings",
        value:
          "Points are **totaled across every table** in the tournament. " +
          "Ties are broken by highest total raw score.\n\n" +
          "View the current standings with `/show-tournament-leaderboard`.",
      },
    )
    .setColor("Blue");

  return interaction.reply({
    embeds: [rulesEmbed, pointsEmbed],
    flags: 64,
  });
  }
;
