import { Listener } from "@sapphire/framework";
import { InteractionType } from "discord.js";
import logger from "../../utils/logger.js";
import {
  saveHighScore,
  resolveExistingTopScore,
  postHighScoreEmbed,
  pendingAttachments,
} from "../../commands/highscores/post-high-score.js";
import { findTable } from "../../lib/data/tables.js";

export class HighScoreSelectListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (interaction.type !== InteractionType.MessageComponent) return;
    if (interaction.customId !== "select") return;

    try {
      const selectedJson = JSON.parse(interaction.values[0]);
      const { vpsId, s: newScore } = selectedJson;

      const isSlashCommand = pendingAttachments.has(interaction.user.id);
      const attachmentUrl = pendingAttachments.get(interaction.user.id);
      if (isSlashCommand) pendingAttachments.delete(interaction.user.id);

      // Resolve table via VPS — source of truth, handles upsert of new tables/authors/versions
      const { table, error: tableError } = await findTable({ vpsId });
      if (tableError || !table) {
        return interaction.reply({
          content:
            (tableError ?? "Could not resolve table from VPS data.") +
            " Please try again using `tablesearchterm` instead.",
          components: [],
          flags: 64,
        });
      }

      // Resolve existing top score before saving so we can detect a new grand champion
      const { existingScore, existingUserId } = await resolveExistingTopScore(
        table.vpsId,
        table.metadata.versionNumber,
      );

      let existingUser = null;
      if (existingUserId) {
        existingUser = await this.container.client.users.fetch(existingUserId);
      }

      const isNewTopScore = !existingScore || newScore > existingScore;

      await saveHighScore(
        {
          tableName: table.name,
          authorName: table.metadata.authorName,
          vpsId: table.vpsId,
          v: table.metadata.versionNumber,
          s: newScore,
        },
        interaction.user,
      );

      logger.info(
        `${interaction.user.username} posted high score: ${newScore} for ${table.name}`,
      );

      const resolvedAttachmentUrl = isSlashCommand
        ? attachmentUrl
        : (interaction.message.attachments.first()?.url ?? null);

      let attachmentBuffer = null;
      if (!isSlashCommand && resolvedAttachmentUrl) {
        try {
          const res = await fetch(resolvedAttachmentUrl);
          if (res.ok) attachmentBuffer = Buffer.from(await res.arrayBuffer());
        } catch (e) {
          logger.error("Failed to pre-fetch attachment buffer:", e);
        }
      }

      await interaction.deferUpdate();

      if (isSlashCommand) {
        await interaction.editReply({
          content: "✅ High Score Posted Successfully",
          components: [],
        });
      }

      await postHighScoreEmbed({
        channel: interaction.channel,
        user: interaction.user,
        table,
        scoreValue: newScore,
        isNewTopScore,
        attachmentUrl: resolvedAttachmentUrl,
        existingUser,
        messageUrl: interaction.message?.url ?? null,
      });

      await interaction.message.delete().catch(() => {});
    } catch (e) {
      logger.error(e);
      if (!interaction.replied) {
        await interaction.reply({
          content: e.message,
          components: [],
          flags: 64,
        });
      } else {
        await interaction.followUp({
          content: e.message,
          components: [],
          flags: 64,
        });
      }
    }
  }
}
