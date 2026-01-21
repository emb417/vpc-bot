import "dotenv/config";
import { Command } from "@sapphire/framework";
import logger from "../../utils/logging.js";
import { formatNumber } from "../../utils/formatting.js";
import { rankingPipeline } from "../../lib/data/pipelines.js";
import { findCurrentWeek, aggregate } from "../../services/database.js";

export class SuggestTeamsCommand extends Command {
  constructor(context, options) {
    super(context, {
      ...options,
      name: "suggest-teams",
      description:
        "Suggest teams for competition based on historical performance.",
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
            .setName("messageid")
            .setDescription("Message ID to get reactions from")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("numberofweeks")
            .setDescription("Number of weeks to total")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("numberofteams")
            .setDescription("Number of teams to create")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("minteamsize")
            .setDescription("Minimum team size")
            .setRequired(true),
        ),
    );
  }

  async chatInputRun(interaction) {
    const channel = interaction.channel;
    const messageId = interaction.options.getString("messageid");
    const totalWeeks = interaction.options.getInteger("numberofweeks");
    const numberOfTeams = interaction.options.getInteger("numberofteams");
    const minTeamSize = interaction.options.getInteger("minteamsize");

    try {
      // Get message and reactions
      const message = await channel.messages.fetch(messageId);
      const userReactions = message.reactions.cache;
      let users = await Promise.all(
        userReactions.map((reaction) => reaction.users.fetch()),
      );
      users = users.flat().map((u) => u.username);

      // Get current week and build week list
      const week = await findCurrentWeek(channel.name);
      const weeks = [];

      for (let i = 1; i <= totalWeeks; i++) {
        weeks.push(week.weekNumber - i);
      }

      // Get rankings from aggregation
      const pipeline = rankingPipeline(weeks, users);
      const rankings = await aggregate(pipeline, "weeks");

      // Chunk players into teams
      const chunkPlayers = this.chunkWithMinSize(
        rankings,
        numberOfTeams,
        minTeamSize,
      );
      const teams = this.equalizeChunks(chunkPlayers);

      // Build response
      let retVal = "**Player Rankings:**\n";
      rankings.forEach((r, i) => {
        retVal += `${i + 1}. **${r._id}** ${formatNumber(r.total)}\n`;
      });

      retVal += "\n**Suggested Teams:**\n";
      teams.forEach((team, i) => {
        const roster = team.roster.map((u) => u._id).join(", ");
        retVal += `**Team ${i + 1}** (${formatNumber(team.totalScore)}): ${roster}\n\n`;
      });

      // Find players who didn't play
      const playersInTeams = teams.flatMap((t) => t.roster.map((u) => u._id));
      const noHistory = users.filter((u) => !playersInTeams.includes(u));

      if (noHistory.length > 0) {
        retVal += `**Did Not Play:** ${noHistory.join(", ")}\n`;
      }

      return interaction.reply({
        content: retVal,
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

  chunkWithMinSize(arr, chunkSize, minChunkSize = 0) {
    const remainder = arr.length % chunkSize;
    const isLastChunkTooSmall = remainder > minChunkSize;
    const totalChunks = isLastChunkTooSmall
      ? Math.floor(arr.length / chunkSize)
      : Math.ceil(arr.length / chunkSize);

    return Array.from({ length: totalChunks }, (_, i) => {
      const chunk = arr.slice(i * chunkSize, i * chunkSize + chunkSize);
      if (i === totalChunks - 1 && isLastChunkTooSmall) {
        chunk.push(...arr.slice(-remainder));
      }
      return chunk;
    });
  }

  equalizeChunks(chunks) {
    const numberOfTeams = chunks[0]?.length || 0;
    const teams = Array.from({ length: numberOfTeams }, () => []);

    chunks.forEach((level, i) => {
      const orderedLevel = i % 2 !== 0 ? [...level].reverse() : level;

      let x = 0;
      let y = numberOfTeams - 1;
      let goingUp = true;

      orderedLevel.forEach((levelRank) => {
        if (x >= numberOfTeams) {
          teams[y].push(levelRank);
          goingUp ? y-- : y++;
          if (y === 0) goingUp = false;
          else if (y === numberOfTeams - 1) goingUp = true;
        } else {
          teams[x].push(levelRank);
        }
        x++;
      });
    });

    return teams.map((team) => ({
      roster: team,
      totalScore: team.reduce((sum, player) => sum + player.total, 0),
    }));
  }
}
