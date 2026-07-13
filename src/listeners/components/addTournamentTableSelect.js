import { Listener } from "@sapphire/framework";
import { ObjectId } from "mongodb";
import { findOne, updateOne } from "../../services/database.js";
import { getVpsGameById } from "../../lib/data/vps.js";
import { findTable } from "../../lib/data/tables.js";
import logger from "../../utils/logger.js";

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

export default class AddTournamentTableSelectListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== "add_tournament_table_select") return;

    try {
      await interaction.deferUpdate();

      const { tournamentId, vpsId } = JSON.parse(interaction.values[0]);

      const tournament = await findOne(
        { _id: new ObjectId(tournamentId) },
        "tournaments",
      );

      if (!tournament) {
        return interaction.editReply({
          content: "Tournament not found.",
          flags: 64,
        });
      }

      // Check if table already exists in the tournament
      if (tournament.tables?.some(t => t.vpsId === vpsId)) {
        return interaction.editReply({
          content: "Table is already in the tournament.",
          flags: 64,
        });
      }

      // Add the table
      const newTable = await resolveTournamentTable(vpsId, (tournament.tables?.length ?? 0) + 1);
      
      // Sync table
      await findTable({ vpsId });

      await updateOne(
        { _id: new ObjectId(tournamentId) },
        { $push: { tables: newTable } },
        {},
        "tournaments"
      );

      return interaction.editReply({
        content: `✅ Table added to tournament **${tournament.name}**.`,
        components: [],
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to add tournament table via select menu:");
      return interaction.editReply({
        content: `An error occurred: ${e.message}`,
        flags: 64,
      });
    }
  }
}
