import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import {
  find,
  findOne,
  insertOne,
  updateOne,
} from "../../services/database.js";
import {
  isEntryQualified,
  loadApprovedTables,
  notifyQualificationChange,
} from "./raffle.js";
import logger from "../../utils/logger.js";

/**
 * Process a raffle entry (insert or update) for a given user and table.
 * findTable and validateEntry must be called by the caller before deferReply,
 * so that validation errors can be returned ephemerally.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {object} params.table           - Resolved table object from findTable
 * @param {object} params.validation      - Result from validateEntry
 * @param {string|null} params.notes      - Optional notes
 * @param {string} params.username        - Display name for embed
 * @param {string} params.avatarURL       - Avatar URL for embed thumbnail
 * @param {object} params.currentWeek     - Already-resolved current week document
 * @param {object} params.client          - Discord client (for notifications)
 * @returns {{ embeds, components }}      - Reply payload ready for interaction.editReply()
 */
export async function processRaffleEntry({
  userId,
  table,
  validation,
  notes,
  username,
  avatarURL,
  currentWeek,
  client,
}) {
  const weekId = currentWeek._id.toString();

  const tableData = {
    name: table.name,
    url: table.url,
    vpsId: table.vpsId,
    romUrl: table.romUrl,
    notes: notes || null,
  };

  const existingEntry = await findOne({ userId, weekId }, "raffles");
  const tableIsChanging =
    existingEntry && existingEntry.table.vpsId !== table.vpsId;

  // Qualification state before the change
  const approvedTables = await loadApprovedTables();
  const weekEntriesBefore = await find({ weekId }, "raffles");

  let wasQualified, oldWasQualified, newWasQualified;
  if (!existingEntry) {
    wasQualified = isEntryQualified(
      table.vpsId,
      weekEntriesBefore,
      currentWeek.scores ?? [],
      approvedTables,
    );
  } else if (tableIsChanging) {
    oldWasQualified = isEntryQualified(
      existingEntry.table.vpsId,
      weekEntriesBefore,
      currentWeek.scores ?? [],
      approvedTables,
    );
    newWasQualified = isEntryQualified(
      table.vpsId,
      weekEntriesBefore,
      currentWeek.scores ?? [],
      approvedTables,
    );
  }

  // Persist
  if (!existingEntry) {
    await insertOne(
      {
        userId,
        weekId,
        table: tableData,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      "raffles",
    );
  } else {
    await updateOne(
      { userId, weekId },
      { $set: { table: tableData, updatedAt: new Date() } },
      null,
      "raffles",
    );
  }

  // Qualification state after the change
  const weekEntriesAfter = await find({ weekId }, "raffles");

  if (!existingEntry) {
    const nowQualified = isEntryQualified(
      table.vpsId,
      weekEntriesAfter,
      currentWeek.scores ?? [],
      approvedTables,
    );
    if (nowQualified) validation.warning = null;

    notifyQualificationChange(
      client,
      process.env.COMPETITION_CHANNEL_ID,
      tableData,
      weekEntriesAfter.filter((e) => e.table.vpsId === table.vpsId),
      wasQualified,
      nowQualified,
    ).catch((e) =>
      logger.error({ err: e }, "notifyQualificationChange error:"),
    );
  } else if (tableIsChanging) {
    const oldNowQualified = isEntryQualified(
      existingEntry.table.vpsId,
      weekEntriesAfter,
      currentWeek.scores ?? [],
      approvedTables,
    );
    const newNowQualified = isEntryQualified(
      table.vpsId,
      weekEntriesAfter,
      currentWeek.scores ?? [],
      approvedTables,
    );
    if (newNowQualified) validation.warning = null;

    notifyQualificationChange(
      client,
      process.env.COMPETITION_CHANNEL_ID,
      existingEntry.table,
      weekEntriesAfter.filter(
        (e) => e.table.vpsId === existingEntry.table.vpsId,
      ),
      oldWasQualified,
      oldNowQualified,
    ).catch((e) =>
      logger.error({ err: e }, "notifyQualificationChange (old table) error:"),
    );

    notifyQualificationChange(
      client,
      process.env.COMPETITION_CHANNEL_ID,
      tableData,
      weekEntriesAfter.filter((e) => e.table.vpsId === table.vpsId),
      newWasQualified,
      newNowQualified,
    ).catch((e) =>
      logger.error({ err: e }, "notifyQualificationChange (new table) error:"),
    );
  }

  const isNew = !existingEntry;
  const embed = new EmbedBuilder()
    .setTitle(isNew ? "🎟 New Raffle Entry" : "🎟 Changed Raffle Entry")
    .setDescription(
      `**${username}** ${isNew ? "entered" : "changed to"}\n[${table.name}](${table.url})${validation.warning ? `\n\n⏳ ${validation.warning}` : ""}`,
    )
    .setColor(validation.warning ? "Yellow" : "Green")
    .setThumbnail(avatarURL)
    .setFooter({ text: "Use /change-raffle-entry to change your entry." });

  const components = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("show_raffle_board")
        .setLabel("📋 Raffle Board")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("show_raffle_rules")
        .setLabel("📜 Raffle Rules")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`raffle-enter:${table.vpsId}`)
        .setLabel("🎯 Enter Table for Me Too!")
        .setStyle(ButtonStyle.Secondary),
    ),
  ];

  return { embeds: [embed], components };
}
