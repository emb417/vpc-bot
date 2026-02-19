import "dotenv/config";
import { Command } from "@sapphire/framework";
import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import logger from "../../utils/logger.js";
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

global.pendingAttachments = global.pendingAttachments ?? new Map();
export const pendingAttachments = global.pendingAttachments;

export class PostHighScoreCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "post-high-score",
      aliases: ["high"],
      description: "Post a high score.",
      preconditions: ["HighScoresChannel"],
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
              .setName("score")
              .setDescription("Your score")
              .setRequired(true),
          )
          .addAttachmentOption((option) =>
            option
              .setName("image")
              .setDescription(
                "Screenshot of your high score and full playfield",
              )
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("tablesearchterm")
              .setDescription("Search term for table")
              .setRequired(true),
          ),
      {
        guildIds: [guildId],
      },
    );
  }

  async chatInputRun(interaction) {
    const score = interaction.options.getString("score") ?? "<score>";
    const tableSearchTerm =
      interaction.options.getString("tablesearchterm") ?? "<table>";
    const attachment = interaction.options.getAttachment("image");

    if (attachment?.url) {
      pendingAttachments.set(interaction.user.id, attachment.url);

      logger.info(
        `pendingAttachments set for ${interaction.user.id}, size: ${pendingAttachments.size}`,
      );
    }

    const fakeContext = {
      attachments: { first: () => attachment },
      reply: (opts) => interaction.reply({ ...opts, flags: 64 }),
      delete: () => Promise.resolve(),
      channel: interaction.channel,
    };

    return this.handleHighScore(
      fakeContext,
      interaction.user,
      score,
      tableSearchTerm,
      false,
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
          const authorName =
            item?.authors?.[0]?.authorName ??
            item?.authorName ??
            "Unknown Author";

          const authorsArray = authorName.split(", ");
          const firstAuthor = authorsArray.shift();

          return {
            label: `${item.tableName} (${firstAuthor}... ${item.versionNumber})`,
            value: JSON.stringify({
              vpsId: item.vpsId,
              v: item.versionNumber,
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
                "No photo attached. Please attach a photo with your high score.\n" +
                `\`!high ${scoreValue} ${tableSearchTerm}\`\n` +
                "This message will be deleted in 10 seconds.",
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
          });
        }
      } else if (tables.length > 10) {
        const content = `More than 10 tables were found. The search term "${tableSearchTerm}" is too broad, please narrow your search term.`;
        if (isMessage) {
          const reply = await context.reply({ content });
          await context.delete().catch(() => {});
          setTimeout(() => reply.delete().catch(() => {}), 10000);
        } else {
          return context.reply({ content });
        }
      } else {
        const content = `No high score tables were found using "${tableSearchTerm}". Try posting high score again using a different table search term.`;
        if (isMessage) {
          const reply = await context.reply({ content });
          await context.delete().catch(() => {});
          setTimeout(() => reply.delete().catch(() => {}), 10000);
        } else {
          return context.reply({ content });
        }
      }
    } catch (e) {
      logger.error(e);
      if (isMessage) {
        context.reply({ content: e.message });
      } else {
        context.reply({ content: e.message });
      }
    }
  }
}

export const saveHighScore = async (data, user) => {
  const userObj = user || data.user;
  const username = userObj?.username || data.username;
  const versionNumber = data.versionNumber || data.v;
  const scoreValue = data.score || data.s;

  return findOneAndUpdate(
    { tableName: data.tableName },
    {
      $push: {
        "authors.$[a].versions.$[v].scores": {
          _id: generateObjectId(),
          user: userObj,
          username: username,
          score: scoreValue,
          mode: data.mode,
          postUrl: data.postUrl ?? "",
          createdAt: formatDateTime(new Date()),
        },
      },
    },
    {
      returnDocument: "after",
      arrayFilters: [
        { "a.vpsId": data.vpsId },
        { "v.versionNumber": versionNumber },
      ],
    },
    "tables",
  );
};
