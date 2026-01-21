import "dotenv/config";
import { Command } from "@sapphire/framework";
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import logger from "../../utils/logging.js";
import { formatDateTime } from "../../utils/formatting.js";
import {
  searchPipeline,
  searchScoreByVpsIdUsernameScorePipeline,
} from "../../lib/data/pipelines.js";
import {
  aggregate,
  findOneAndUpdate,
  generateObjectId,
} from "../../services/database.js";

export class PostHighScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "post-high-score",
      aliases: ["high"],
      description: "Post a high score.",
      preconditions: ["HighScoreChannel"],
    });
  }

  registerApplicationCommands(registry) {
    registry.registerChatInputCommand((builder) =>
      builder
        .setName(this.name)
        .setDescription(this.description)
        .addStringOption((option) =>
          option
            .setName("score")
            .setDescription("Your score")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("tablesearchterm")
            .setDescription("Search term for table")
            .setRequired(true),
        ),
    );
  }

  async messageRun(message, args) {
    const score = await args.pick("string").catch(() => null);
    const tableSearchTerm = await args.rest("string").catch(() => null);

    if (!score || !tableSearchTerm) {
      return message.reply({
        content: "Please provide a score and table search term.",
      });
    }

    return this.handleHighScore(
      message,
      message.author,
      score,
      tableSearchTerm,
      true,
    );
  }

  async chatInputRun(interaction) {
    const score = interaction.options.getString("score");
    const tableSearchTerm = interaction.options.getString("tablesearchterm");

    return this.handleHighScore(
      interaction,
      interaction.user,
      score,
      tableSearchTerm,
      false,
    );
  }

  async handleHighScore(context, user, score, tableSearchTerm, isMessage) {
    const re = /^([1-9]|[1-9][0-9]{1,14})$/;
    const scoreValue = parseInt(score.replace(/,/g, ""));

    try {
      if (isNaN(scoreValue) || !re.test(String(scoreValue))) {
        const content =
          "The score needs to be a number between 1 and 999999999999999.";
        if (isMessage) {
          const reply = await context.reply({ content });
          await context.delete().catch(() => {});
          setTimeout(() => reply.delete().catch(() => {}), 10000);
        } else {
          return context.reply({ content, flags: 64 });
        }
        return;
      }

      const pipeline = searchPipeline(tableSearchTerm);
      const tables = await aggregate(pipeline, "tables");

      if (tables.length > 0 && tables.length <= 10) {
        const options = tables.map((item) => {
          const authorsArray = item?.authorName?.split(", ");
          const firstAuthor = authorsArray?.shift();

          return {
            label: `${item.tableName} (${firstAuthor}... ${item.versionNumber})`,
            value: JSON.stringify({
              vpsId: item.vpsId,
              v: item.versionNumber,
              u: user.username,
              s: scoreValue,
            }),
          };
        });

        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select")
            .setPlaceholder("Please select table for high score...")
            .addOptions(options),
        );

        if (isMessage) {
          const attachment = context.attachments?.first();
          if (!attachment) {
            const reply = await context.reply({
              content:
                "No photo attached. Please attach a photo with your high score. This message will be deleted in 10 seconds.",
            });
            await context.delete().catch(() => {});
            setTimeout(() => reply.delete().catch(() => {}), 10000);
            return;
          }

          await context.reply({
            content: "Which table do you want to post this high score?",
            files: [attachment],
            components: [row],
          });
          await context.delete().catch(() => {});
        } else {
          await context.reply({
            content: "Which table do you want to post this high score?",
            components: [row],
            flags: 64,
          });
        }
      } else if (tables.length > 10) {
        const content = `More than 10 tables were found. The search term "${tableSearchTerm}" is too broad, please narrow your search term.`;
        if (isMessage) {
          const reply = await context.reply({ content });
          await context.delete().catch(() => {});
          setTimeout(() => reply.delete().catch(() => {}), 10000);
        } else {
          return context.reply({ content, flags: 64 });
        }
      } else {
        const content = `No high score tables were found using "${tableSearchTerm}". Try posting high score again using a different table search term.`;
        if (isMessage) {
          const reply = await context.reply({ content });
          await context.delete().catch(() => {});
          setTimeout(() => reply.delete().catch(() => {}), 10000);
        } else {
          return context.reply({ content, flags: 64 });
        }
      }
    } catch (e) {
      logger.error(e);
      if (isMessage) {
        context.reply({ content: e.message });
      } else {
        context.reply({ content: e.message, flags: 64 });
      }
    }
  }
}

// Export utility functions for use by events
export const highScoreExists = async (data) => {
  const pipeline = searchScoreByVpsIdUsernameScorePipeline(data);
  const tables = await aggregate(pipeline, "tables");
  return tables.length > 0;
};

export const saveHighScore = async (data, interaction) => {
  const newHighScore = await findOneAndUpdate(
    { tableName: data.tableName },
    {
      $push: {
        "authors.$[a].versions.$[v].scores": {
          _id: generateObjectId(),
          user: interaction.user,
          username: data.u.replace("`", ""),
          score: data.s,
          mode: data.mode,
          postUrl: interaction.message?.url ?? "",
          createdAt: formatDateTime(new Date()),
        },
      },
    },
    {
      returnDocument: "after",
      arrayFilters: [
        { "a.vpsId": data.vpsId },
        { "v.versionNumber": data.versionNumber },
      ],
    },
    "tables",
  );
  return newHighScore;
};

export const updateHighScore = async (data, postUrl) => {
  const { ObjectId } = await import("mongodb");
  return findOneAndUpdate(
    { tableName: data.tableName },
    { $set: { "authors.$[a].versions.$[v].scores.$[s].postUrl": postUrl } },
    {
      returnDocument: "after",
      arrayFilters: [
        { "a.vpsId": data.vpsId },
        { "v.versionNumber": data.versionNumber },
        { "s._id": new ObjectId(data.scoreId) },
      ],
    },
    "tables",
  );
};
