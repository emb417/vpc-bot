import "dotenv/config";
import { Command } from "@sapphire/framework";
import { EmbedBuilder } from "discord.js";
import logger from "../../utils/logger.js";
import { formatDateISO, parseDate, addDays } from "../../utils/formatting.js";
import {
  editWeeklyCompetitionCornerMessage,
  editSeasonCompetitionCornerMessage,
} from "../../lib/output/messages.js";
import { getVpsGameById } from "../../lib/data/vps.js";
import { getCurrentWeek } from "../../lib/data/vpc.js";
import {
  findCurrentSeason,
  updateOne,
  insertOne,
  find,
} from "../../services/database.js";

export class CreateWeekCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-week",
      description: "Create new week by VPS Id.",
      preconditions: ["CompetitionChannel", "CompetitionAdminRole"],
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
              .setName("vpsid")
              .setDescription("VPS ID for the table")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("mode")
              .setDescription("Game mode")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("startdateoverride")
              .setDescription("Override start date (YYYY-MM-DD)")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("enddateoverride")
              .setDescription("Override end date (YYYY-MM-DD)")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option
              .setName("b2sidoverride")
              .setDescription("Override B2S ID")
              .setRequired(false),
          )
          .addStringOption((option) =>
            option.setName("notes").setDescription("Notes").setRequired(false),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();

    const vpsid = interaction.options.getString("vpsid");
    const options = {
      mode: interaction.options.getString("mode") ?? "default",
      startdateoverride: interaction.options.getString("startdateoverride"),
      enddateoverride: interaction.options.getString("enddateoverride"),
      b2sidoverride: interaction.options.getString("b2sidoverride"),
      notes: interaction.options.getString("notes"),
      interaction,
    };

    try {
      const result = await createWeek(
        this.container.client,
        interaction.channel,
        vpsid,
        options,
      );
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("Green")
            .setTitle(`✅ Week ${result.week.weekNumber} Created`)
            .setURL(
              `https://discord.com/channels/${process.env.GUILD_ID}/${interaction.channel.id}/${process.env.COMPETITION_WEEKLY_POST_ID}`,
            )
            .addFields(
              {
                name: "Table",
                value: result.week.tableUrl
                  ? `[🔗 ${result.week.table}](${result.week.tableUrl})`
                  : result.week.table,
                inline: false,
              },
              { name: "Author", value: result.week.authorName, inline: true },
              {
                name: "Version",
                value: result.week.versionNumber,
                inline: true,
              },
              {
                name: "Period",
                value: `${result.week.periodStart} – ${result.week.periodEnd}`,
                inline: false,
              },
              {
                name: "ROM",
                value: (() => {
                  const label =
                    result.week.romName && result.week.romName !== "N/A"
                      ? `${result.week.romName} - Required`
                      : "Required";
                  const hasUrl =
                    result.week.romUrl && result.week.romUrl !== "N/A";
                  const hasRom =
                    hasUrl ||
                    (result.week.romName && result.week.romName !== "N/A");
                  return hasRom
                    ? hasUrl
                      ? `[🔗 ${label}](${result.week.romUrl})`
                      : label
                    : "N/A";
                })(),
                inline: true,
              },
              {
                name: "B2S",
                value:
                  result.week.b2sUrl !== "N/A"
                    ? `[🔗 Available](${result.week.b2sUrl})`
                    : "N/A",
                inline: true,
              },
            )
            .setFooter({ text: "Good luck everyone!" }),
        ],
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to create week:");
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor("Red").setDescription(`❌ ${e.message}`),
        ],
      });
    }
  }
}

/**
 * Service to handle the creation of a new competition week.
 */
export const createWeek = async (client, channel, vpsid, options = {}) => {
  const {
    mode = "default",
    startdateoverride,
    enddateoverride,
    b2sidoverride,
    notes,
    interaction,
  } = options;

  try {
    const vpsGame = await getVpsGameById(vpsid);
    const tableFile = vpsGame?.tableFiles?.find((t) => t.id === vpsid);

    if (!tableFile) {
      throw new Error(`No VPS Tables were found for ID: ${vpsid}`);
    }

    const currentSeason = await findCurrentSeason(channel.name);
    const currentWeek = await getCurrentWeek(channel.name);

    // Calculate week details
    const weekNumber = parseInt(currentWeek.weekNumber) + 1;
    const currentSeasonWeekNumber = currentWeek.currentSeasonWeekNumber
      ? parseInt(currentWeek.currentSeasonWeekNumber) + 1
      : null;

    const periodStart =
      startdateoverride ||
      formatDateISO(addDays(parseDate(currentWeek.periodStart), 7));

    const periodEnd =
      enddateoverride ||
      formatDateISO(addDays(parseDate(currentWeek.periodEnd), 7));

    const table = `${vpsGame?.name} (${vpsGame?.manufacturer} ${vpsGame?.year})`;
    const authorName = tableFile?.authors?.join(", ") ?? "";
    const versionNumber = tableFile?.version ?? "";
    const tableUrl = tableFile?.urls?.[0]?.url ?? "";

    let romUrl = "N/A";
    let romName = "N/A";
    let b2sUrl = "N/A";

    // Handle B2S
    if (b2sidoverride) {
      b2sUrl =
        vpsGame?.b2sFiles?.find((b) => b.id === b2sidoverride)?.urls?.[0]
          ?.url ?? "N/A";
    } else if (vpsGame?.b2sFiles?.[0]?.urls?.[0]?.url) {
      b2sUrl = vpsGame.b2sFiles[0].urls[0].url;
    }

    // Handle ROM - derived from VPS data, no manual override needed
    const romFile = vpsGame?.romFiles?.[0];
    if (romFile?.urls?.[0]?.url) {
      romUrl = romFile.urls[0].url;
      romName = romFile.version ?? "N/A";
    }

    // Create new week
    const newWeek = {
      channelName: channel.name,
      weekNumber,
      periodStart,
      periodEnd,
      table,
      authorName,
      versionNumber,
      vpsId: vpsid,
      mode,
      tableUrl,
      romUrl,
      romName,
      b2sUrl,
      season: currentSeason?.seasonNumber
        ? parseInt(currentSeason.seasonNumber)
        : null,
      currentSeasonWeekNumber,
      notes,
      scores: [],
      teams: [],
      isArchived: false,
    };

    // Archive current week and insert new one
    await updateOne(
      { channelName: channel.name, isArchived: false },
      { $set: { isArchived: true } },
      null,
      "weeks",
    );
    await insertOne(newWeek, "weeks");

    let resultMessage;

    // Update pinned messages for competition channel
    if (channel.name === process.env.COMPETITION_CHANNEL_NAME) {
      await editWeeklyCompetitionCornerMessage(
        newWeek.scores,
        client,
        newWeek,
        newWeek.teams,
      );

      if (currentSeason) {
        const weeksInSeason = await find(
          {
            channelName: channel.name,
            isArchived: true,
            periodStart: { $gte: currentSeason.seasonStart },
            periodEnd: { $lte: currentSeason.seasonEnd },
          },
          "weeks",
        );

        await editSeasonCompetitionCornerMessage(
          currentSeason,
          weeksInSeason,
          client,
        );
      }

      resultMessage = `New week created and the ${channel.name} pinned message was updated successfully.`;

      // Emit events
      client.emit("advancePlayoffRound", {
        client,
        interaction,
        channel,
        currentWeek,
      });

      client.emit("postBraggingRights", {
        client,
        channelId: process.env.BRAGGING_RIGHTS_CHANNEL_ID,
        channel,
        currentWeek,
      });

      client.emit("createHighScoreTable", {
        client,
        vpsId: newWeek.vpsId,
        interaction,
        channel,
      });
    } else {
      resultMessage = `New week created for the ${channel.name} channel.`;
    }

    return { success: true, message: resultMessage, week: newWeek };
  } catch (e) {
    logger.error({ err: e }, "Failed to create week:");
    throw e;
  }
};
