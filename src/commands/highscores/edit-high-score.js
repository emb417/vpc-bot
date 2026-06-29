import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logger.js";
import { findOneAndUpdate } from "../../services/database.js";
import { highScoreExists } from "../../listeners/custom/crossPostHighScore.js";

export class EditHighScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "edit-high-score",
      description: "Edit a high score value.",
      preconditions: ["HighScoresAdminRole", "HighScoresChannel"],
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
              .setDescription("VPS ID of the table")
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("username")
              .setDescription("Username of the score to edit")
              .setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("oldscore")
              .setDescription("Current score value to edit")
              .setRequired(true),
          )
          .addIntegerOption((option) =>
            option
              .setName("newscore")
              .setDescription("New score value")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const vpsId = interaction.options.getString("vpsid");
    const username = interaction.options.getString("username");
    const oldScore = interaction.options.getInteger("oldscore");
    const newScore = interaction.options.getInteger("newscore");

    try {
      const updated = await editHighScore(vpsId, username, oldScore, newScore);
      return interaction.reply({
        content: updated
          ? "High score updated successfully."
          : "No high score updated. Score not found.",
        flags: 64,
      });
    } catch (e) {
      logger.error({ err: e }, "Failed to edit high score:");
      return interaction.reply({
        content: e.message,
        flags: 64,
      });
    }
  }
}

// Update the score value of an existing high score entry, matched by
// vpsId + username + the previous score value. When versionNumber is provided
// the update is scoped to that version; otherwise it matches across all versions.
// Returns true if a matching entry existed and was updated, false otherwise.
export const editHighScore = async (
  vpsId,
  username,
  oldScore,
  newScore,
  versionNumber = null,
) => {
  // Pre-check existence so we can reliably report whether a match was found —
  // findOneAndUpdate returns the doc even when the arrayFilters match nothing.
  const exists = await highScoreExists({
    vpsId,
    u: username,
    s: parseInt(oldScore),
  });

  if (!exists) {
    return false;
  }

  const arrayFilters = [
    { "a.vpsId": vpsId },
    ...(versionNumber ? [{ "v.versionNumber": versionNumber }] : []),
    { "s.username": username, "s.score": parseInt(oldScore) },
  ];
  const versionsPath = versionNumber ? "versions.$[v]" : "versions.$[]";

  await findOneAndUpdate(
    { authors: { $elemMatch: { vpsId } } },
    {
      $set: {
        [`authors.$[a].${versionsPath}.scores.$[s].score`]: parseInt(newScore),
      },
    },
    {
      returnDocument: "after",
      arrayFilters,
    },
    "tables",
  );

  return true;
};
