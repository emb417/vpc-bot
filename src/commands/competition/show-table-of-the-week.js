import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { getCurrentWeek } from "../../lib/data/vpc.js";

export class ShowTableOfTheWeekCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "show-table-of-the-week",
      description: "Show the current table of the week and its details.",
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
    await interaction.deferReply({ flags: 64 });

    try {
      const week = await getCurrentWeek(interaction.channel.name);

      if (!week) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setDescription("❌ No active week found for this channel."),
          ],
        });
      }

      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Blue")
            .setTitle(`🎰 Week ${week.weekNumber} – Table of the Week`)
            .setURL(
              `https://discord.com/channels/${process.env.GUILD_ID}/${interaction.channel.id}/${process.env.COMPETITION_WEEKLY_POST_ID}`,
            )
            .addFields(
              {
                name: "Table",
                value: week.tableUrl
                  ? `[🔗 ${week.table}](${week.tableUrl})`
                  : week.table,
                inline: false,
              },
              { name: "Author", value: week.authorName || "N/A", inline: true },
              {
                name: "Version",
                value: week.versionNumber || "N/A",
                inline: true,
              },
              {
                name: "Period",
                value: `${week.periodStart} – ${week.periodEnd}`,
                inline: false,
              },
              {
                name: "ROM",
                value: (() => {
                  const label =
                    week.romName && week.romName !== "N/A"
                      ? `${week.romName} - Required`
                      : "Required";
                  const hasUrl = week.romUrl && week.romUrl !== "N/A";
                  const hasRom =
                    hasUrl || (week.romName && week.romName !== "N/A");
                  return hasRom
                    ? hasUrl
                      ? `[🔗 ${label}](${week.romUrl})`
                      : label
                    : "N/A";
                })(),
                inline: true,
              },
              {
                name: "B2S",
                value:
                  week.b2sUrl !== "N/A"
                    ? `[🔗 Available](${week.b2sUrl})`
                    : "N/A",
                inline: true,
              },
              ...(week.notes
                ? [{ name: "Notes", value: week.notes, inline: false }]
                : []),
            )
            .setFooter({ text: "Good luck everyone!" }),
        ],
      });
    } catch (e) {
      logger.error(e);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
      });
    }
  }
}
