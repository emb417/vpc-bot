import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { formatDateTime } from "../../utils/formatting.js";
import { getVpsGameById } from "../../lib/data/vps.js";
import { buildTournamentEmbed } from "../../lib/tournaments/embed.js";
import { findActiveTournament, insertOne } from "../../services/database.js";

/**
 * Resolve a single VPS id into a tournament table entry.
 * Mirrors the table-resolution block in createWeek (create-week.js).
 */
const resolveTournamentTable = async (vpsid, tableIndex) => {
  const vpsGame = await getVpsGameById(vpsid);
  const tableFile = vpsGame?.tableFiles?.find((t) => t.id === vpsid);

  if (!tableFile) {
    throw new Error(`No VPS Tables were found for ID: ${vpsid}`);
  }

  const table = `${vpsGame?.name} (${vpsGame?.manufacturer} ${vpsGame?.year})`;
  const authorName = tableFile?.authors?.join(", ") ?? "";
  const versionNumber = tableFile?.version ?? "";
  const tableUrl = tableFile?.urls?.[0]?.url ?? "";

  let romUrl = "N/A";
  let romName = "N/A";
  let b2sUrl = "N/A";
  let b2sName = "N/A";

  const b2sFile = vpsGame?.b2sFiles?.[0];
  if (b2sFile?.urls?.[0]?.url) {
    b2sUrl = b2sFile.urls[0].url;
    b2sName = b2sFile.version ?? "N/A";
  }

  const romFile = vpsGame?.romFiles?.[0];
  if (romFile?.urls?.[0]?.url) {
    romUrl = romFile.urls[0].url;
    romName = romFile.version ?? "N/A";
  }

  return {
    tableIndex,
    vpsId: vpsid,
    table,
    authorName,
    versionNumber,
    tableUrl,
    romUrl,
    romName,
    b2sUrl,
    b2sName,
    mode: "default",
    scores: [],
  };
};

export class StartTournamentCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "start-tournament",
      description: "Start a new tournament in this channel.",
      preconditions: ["CompetitionAdminRole"],
    });
  }

  registerApplicationCommands(registry) {
    const guildId = process.env.GUILD_ID;
    if (!guildId) {
      throw new Error("GUILD_ID environment variable is not set");
    }

    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName("name")
              .setDescription("Tournament name")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("vpsids")
              .setDescription("VPS IDs for the tables (comma or space separated)")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("startdate")
              .setDescription("Tournament start date (YYYY-MM-DD)")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("enddate")
              .setDescription("Tournament end date (YYYY-MM-DD)")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();

    const channel = interaction.channel;
    const name = interaction.options.getString("name");
    const vpsidsRaw = interaction.options.getString("vpsids");
    const startDate = interaction.options.getString("startdate");
    const endDate = interaction.options.getString("enddate");

    try {
      // Only one active tournament per channel
      const existing = await findActiveTournament(channel.name);
      if (existing) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setDescription(
                `❌ An active tournament ("${existing.name}") already exists in this channel.`,
              ),
          ],
        });
      }

      const vpsIds = vpsidsRaw
        .split(/[\s,]+/)
        .map((id) => id.trim())
        .filter(Boolean);

      if (vpsIds.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("Red")
              .setDescription("❌ Please provide at least one VPS ID."),
          ],
        });
      }

      const tables = [];
      for (let i = 0; i < vpsIds.length; i++) {
        tables.push(await resolveTournamentTable(vpsIds[i], i + 1));
      }

      const tournament = {
        channelName: channel.name,
        channelId: channel.id,
        name,
        startDate,
        endDate,
        status: "active",
        createdAt: formatDateTime(new Date()),
        tables,
      };

      await insertOne(tournament, "tournaments");

      const embed = buildTournamentEmbed(tournament, {
        title: `🏆 New Tournament: ${name}`,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      logger.error({ err: e }, "Failed to start tournament:");
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
      });
    }
  }
}
