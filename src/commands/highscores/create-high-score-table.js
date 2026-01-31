import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { getVpsGame } from "../../lib/data/vps.js";
import {
  findOne,
  insertOne,
  updateOne,
  generateObjectId,
} from "../../services/database.js";

export class CreateHighScoreTableCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "create-high-score-table",
      description: "Creates new high score table.",
      preconditions: ["CompetitionAdminRole", "HighScoresChannel"],
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
        ),
    );
  }

  async chatInputRun(interaction) {
    const vpsid = interaction.options.getString("vpsid");

    try {
      const result = await createHighScoreTable(vpsid);
      return interaction.reply({
        content: result,
        flags: 64,
      });
    } catch (e) {
      logger.error(e);
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}

// Export for use by events
export const createHighScoreTable = async (vpsid) => {
  const vpsGame = await getVpsGame(vpsid);

  if (!vpsGame?.table) {
    return "No VPS Tables were found. Please double check your VPS Id.";
  }

  const tableName = `${vpsGame?.name} (${vpsGame?.manufacturer} ${vpsGame?.year})`;
  const comment = vpsGame?.table?.comment;
  const authorName = vpsGame?.table?.authors?.join(", ") ?? "";
  const versionNumber = vpsGame?.table?.version ?? "";
  const versionUrl = vpsGame?.table?.urls?.[0]?.url ?? "";
  const romName = vpsGame?.romFiles?.[0]?.version ?? "";

  const table = {
    _id: generateObjectId(),
    tableName,
    authors: [
      {
        _id: generateObjectId(),
        authorName,
        versions: [
          {
            _id: generateObjectId(),
            versionNumber,
            versionUrl,
            romName,
            scores: [],
          },
        ],
        vpsId: vpsid,
        comment,
      },
    ],
  };

  const existingTable = await findOne({ tableName }, "tables");

  if (!existingTable) {
    await insertOne(table, "tables");
    return `${table.tableName} (${authorName} ${versionNumber}) created successfully`;
  }

  const existingAuthor = existingTable?.authors?.find((a) => a.vpsId === vpsid);
  const existingVersion = existingAuthor?.versions?.find(
    (v) => v.versionNumber === versionNumber,
  );

  if (!existingAuthor) {
    await updateOne(
      { tableName: existingTable.tableName },
      {
        $push: {
          authors: {
            _id: generateObjectId(),
            authorName,
            versions: [
              {
                versionNumber,
                versionUrl,
                romName,
                scores: [],
              },
            ],
            vpsId: vpsid,
            comment,
          },
        },
      },
      null,
      "tables",
    );
    return `New author and version created for ${existingTable.tableName}.`;
  }

  if (!existingVersion) {
    await updateOne(
      { tableName: existingTable.tableName },
      {
        $push: {
          "authors.$[a].versions": {
            _id: generateObjectId(),
            versionNumber,
            versionUrl,
            romName,
            scores: [],
          },
        },
      },
      { arrayFilters: [{ "a.vpsId": vpsid }] },
      "tables",
    );
    return `New version created for ${existingTable.tableName} (${existingAuthor.authorName}).`;
  }

  return `${existingTable.tableName} (${existingAuthor.authorName}) (${versionNumber}) already exists.`;
};
