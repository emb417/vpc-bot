import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { formatDateISO, parseDate, addDays } from "../../utils/formatting.js";
import {
  editWeeklyCompetitionCornerMessage,
  editSeasonCompetitionCornerMessage,
} from "../../lib/output/messages.js";
import { getVpsGame } from "../../lib/data/vps.js";
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
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("vpsid")
            .setDescription("VPS ID for the table")
            .setRequired(true),
        )
        .addBooleanOption((option) =>
          option
            .setName("romrequired")
            .setDescription("Is ROM required?")
            .setRequired(false),
        )
        .addStringOption((option) =>
          option.setName("mode").setDescription("Game mode").setRequired(false),
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
    );
  }

  async chatInputRun(interaction) {
    await interaction.deferReply();

    const channel = interaction.channel;
    const vpsid = interaction.options.getString("vpsid");
    const romrequired = interaction.options.getBoolean("romrequired") ?? true;
    const mode = interaction.options.getString("mode") ?? "default";
    const startdateoverride =
      interaction.options.getString("startdateoverride");
    const enddateoverride = interaction.options.getString("enddateoverride");
    const b2sidoverride = interaction.options.getString("b2sidoverride");
    const notes = interaction.options.getString("notes");

    try {
      const vpsGame = await getVpsGame(vpsid);

      const tableFile = vpsGame?.tableFiles?.find((t) => t.id === vpsid);

      if (!tableFile) {
        return interaction.editReply({
          content: "No VPS Tables were found. Please double check your VPS ID.",
        });
      }

      const currentSeason = await findCurrentSeason(channel.name);
      const currentWeek = await getCurrentWeek(channel.name);
      const errors = [];

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

      let romUrl = "";
      let romName = "";
      let b2sUrl = "";

      // Handle B2S
      if (b2sidoverride) {
        b2sUrl =
          vpsGame?.b2sFiles?.find((b) => b.id === b2sidoverride)?.urls?.[0]
            ?.url ?? "";
      } else if (vpsGame?.b2sFiles?.[0]?.urls?.[0]?.url) {
        b2sUrl = vpsGame.b2sFiles[0].urls[0].url;
      }

      // Handle ROM
      if (romrequired) {
        const romFile = vpsGame?.romFiles?.[0];

        if (!romFile?.urls?.[0]?.url) {
          errors.push(
            "Missing romUrl. Please provide at least one rom url, or remove rom files, or set romrequired to false.",
          );
        } else if (!romFile?.version) {
          errors.push(
            "Missing rom version. Please provide a rom version, or remove rom files, or set romrequired to false.",
          );
        } else {
          romUrl = romFile.urls[0].url;
          romName = romFile.version;
        }
      } else {
        romUrl = "N/A";
        romName = "N/A";
      }

      if (errors.length > 0) {
        return interaction.editReply({
          content: `***Error creating new week. New week HAS NOT been created***: \n\n${errors.join("\n")}`,
        });
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

      let retVal;

      // Update pinned messages for competition channel
      if (channel.name === process.env.COMPETITION_CHANNEL_NAME) {
        await editWeeklyCompetitionCornerMessage(
          newWeek.scores,
          this.container.client,
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
            this.container.client,
          );
        }

        retVal = `New week created and the ${channel.name} pinned message was updated successfully.`;

        // Emit events
        this.container.client.emit("advancePlayoffRound", {
          client: this.container.client,
          interaction,
          currentWeek,
        });

        this.container.client.emit("postBraggingRights", {
          client: this.container.client,
          channelId: process.env.BRAGGING_RIGHTS_CHANNEL_ID,
          currentWeek,
        });

        this.container.client.emit("createHighScoreTable", {
          client: this.container.client,
          vpsId: newWeek.vpsId,
          interaction,
          channel,
        });
      } else {
        retVal = `New week created for the ${channel.name} channel.`;
      }

      return interaction.editReply({ content: retVal });
    } catch (e) {
      logger.error(e);
      return interaction.editReply({ content: e.message });
    }
  }
}
