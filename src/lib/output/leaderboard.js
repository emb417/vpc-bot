import { EmbedBuilder } from "discord.js";
import { truncate, formatNumber } from "../../utils/formatting.js";
import { calculateSeasonPoints } from "../scores/points.js";

// Discord message character limit
const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Create a table row for weekly leaderboard.
 * Returns an array of strings representing the cells.
 */
export const createTableRow = (
  rank,
  score,
  expandedLayout,
  showScores,
) => {
  const row = [rank.toString()];
  
  row.push(truncate(score?.username?.replace(/`/g, ""), 11));

  if (showScores) {
    row.push(formatNumber(score?.score));
  }

  if (expandedLayout) {
    const diff = score?.diff || 0;
    const str = formatNumber(diff);
    const formatted = "(" + (diff > 0 ? "+" : "") + str + ")";
    row.push(formatted);
    row.push(score?.posted || "");
  }

  return row;
};

/**
 * Create a table row for season leaderboard.
 * Returns an array of strings representing the cells.
 */
export const createTableRowSeason = (rank, player, expandedLayout) => {
  const row = [rank.toString()];
  row.push(truncate(player?.username, 15));
  row.push(formatNumber(player?.points));

  if (expandedLayout) {
    row.push(formatNumber(player?.score));
  }

  return row;
};

/**
 * Create a table row for team summary.
 * Returns an array of strings representing the cells.
 */
export const createTableRowTeam = (rank, team) => {
  return [
    rank.toString(),
    truncate(team?.name, 11),
    formatNumber(team?.totalScore)
  ];
};

/**
 * Calculate team totals from scores.
 */
export const calculateTeamTotals = (teams, scores) => {
  teams.forEach((team) => {
    const teamScores = team.members.map((member) => {
      const found = scores.find((x) => x.username === member.trim());
      return found ? found.score : 0;
    });
    team.totalScore = teamScores.reduce((a, b) => a + b, 0);
  });
};

/**
 * Print weekly leaderboard.
 * Returns an array of strings, each representing a line of the table output.
 */
export const printWeeklyLeaderboard = (
  scores,
  numOfScoresToShow,
  expandedLayout,
  showScores,
) => {
  if (!scores || scores.length === 0) {
    return ["NO SCORES CURRENTLY POSTED"];
  }

  const embed = new EmbedBuilder()
    .setTitle("Weekly Leaderboard")
    .setColor("#0099ff");

  const limit = numOfScoresToShow || scores.length;

  for (let i = 0; i < limit; i++) {
    const score = scores[i];
    let value = `**User:** ${truncate(score?.username?.replace(/`/g, ""), 11)}`;

    if (showScores) {
      value += `\n**Score:** ${formatNumber(score?.score)}`;
    }

    if (expandedLayout) {
      const diff = score?.diff || 0;
      const str = formatNumber(diff);
      const formatted = "(" + (diff > 0 ? "+" : "") + str + ")";
      value += `\n**+/- Last:** ${formatted}`;
      value += `\n**Posted:** ${score?.posted || ""}`;
    }

    embed.addFields({ name: `#${i + 1}`, value });
  }

  return [embed];
};

/**
 * Print team summary.
 * Returns an array of strings, each representing a line of the table output.
 */
export const printTeamSummary = (teams, scores) => {
  calculateTeamTotals(teams, scores);

  // Sort teams by total score descending
  teams.sort((a, b) => b.totalScore - a.totalScore);

  const embed = new EmbedBuilder()
    .setTitle("Team Summary")
    .setColor("#0099ff");

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    let value = `**Score:** ${formatNumber(team?.totalScore)}`;

    embed.addFields({ name: `#${i + 1} - ${truncate(team?.name, 15)}`, value });
  }

  return [embed];
};

/**
 * Print team leaderboard with member details.
 * Returns an array of strings, each representing a line of the table output.
 */
export const printTeamLeaderboard = (scores, teams, expandedLayout) => {
  const embeds = [];

  for (const team of teams) {
    const embed = new EmbedBuilder()
      .setTitle(`Team Leaderboard - ${team.name}`)
      .setColor("#0099ff");

    const memberScores = team.members.map((member) => {
      const found = scores.find((x) => x.username === member.trim());
      return found || { username: member, score: 0, posted: "" };
    });

    // Sort by score descending
    memberScores.sort((a, b) => b.score - a.score);

    for (let i = 0; i < memberScores.length; i++) {
      const score = memberScores[i];
      let value = `**User:** ${truncate(score?.username?.replace(/`/g, ""), 11)}`;
      value += `\n**Score:** ${formatNumber(score?.score)}`;

      if (expandedLayout) {
        const diff = score?.diff || 0;
        const str = formatNumber(diff);
        const formatted = "(" + (diff > 0 ? "+" : "") + str + ")";
        value += `\n**+/- Last:** ${formatted}`;
        value += `\n**Posted:** ${score?.posted || ""}`;
      }

      embed.addFields({ name: `#${i + 1}`, value });
    }

    // Total row
    const totalScore = memberScores.reduce((acc, curr) => acc + (curr.score || 0), 0);
    embed.addFields({ name: "Total:", value: formatNumber(totalScore) });

    embeds.push(embed);
  }

  return embeds;
};

/**
 * Print combined leaderboard (teams + scores).
 */
export const printCombinedLeaderboard = (
  scores,
  numOfScoresToShow,
  teams,
  showTeamDetails,
  expandedLayout,
) => {
  let allEmbeds = [];

  if (!scores || scores.length === 0) {
    return [new EmbedBuilder().setTitle("NO SCORES CURRENTLY POSTED").setColor("#ff0000")];
  }

  if (teams && teams.length > 0) {
    allEmbeds.push(...printTeamSummary(teams, scores));

    if (showTeamDetails) {
      allEmbeds.push(...printTeamLeaderboard(scores, teams, expandedLayout));
    }
  }

  allEmbeds.push(...printWeeklyLeaderboard(
    scores,
    numOfScoresToShow,
    expandedLayout,
    true,
  ));

  return allEmbeds;
};

/**
 * Print season leaderboard.
 */
export const printSeasonLeaderboard = (
  weeks,
  numOfScoresToShow,
  expandedLayout,
) => {
  if (!weeks || weeks.length === 0) {
    return [new EmbedBuilder().setTitle("NO SEASON LEADERBOARD CURRENTLY POSTED").setColor("#ff0000")];
  }

  const allEmbeds = [];
  const leaderboard = calculateSeasonPoints(weeks);
  const limit = numOfScoresToShow || leaderboard.length;

  const embed = new EmbedBuilder()
    .setTitle("Season Leaderboard")
    .setColor("#0099ff");

  for (let i = 0; i < limit; i++) {
    const player = leaderboard[i];
    let value = `**Points:** ${formatNumber(player?.points)}`;

    if (expandedLayout) {
      value += `\n**Score:** ${formatNumber(player?.score)}`;
    }

    embed.addFields({ name: `#${i + 1} - ${truncate(player?.username, 15)}`, value });
  }

  allEmbeds.push(embed);

  return allEmbeds;
};

/**
 * Split long posts into multiple messages, optimizing for memory usage.
 * Takes an array of content lines and splits them into Discord-friendly message chunks.
 * It keeps bold headers (lines starting with **) outside of code blocks.
 */
export const splitPosts = (contentLines) => {
  const messages = [];
  let currentMessage = "";
  let inCodeBlock = false;

  const closeCodeBlock = () => {
    if (inCodeBlock) {
      currentMessage += "```\n";
      inCodeBlock = false;
    }
  };

  const openCodeBlock = () => {
    if (!inCodeBlock) {
      currentMessage += "```\n";
      inCodeBlock = true;
    }
  };

  for (const line of contentLines) {
    const isHeader = line.trim().startsWith("**");
    const lineToAdd = line + "\n";

    // Check if adding this line would exceed the limit (including potential code block tags)
    if (currentMessage.length + lineToAdd.length + 20 > DISCORD_MESSAGE_LIMIT) {
      closeCodeBlock();
      if (currentMessage.trim() !== "") {
        messages.push(currentMessage.trim());
      }
      currentMessage = "";
    }

    if (isHeader) {
      closeCodeBlock();
      currentMessage += lineToAdd;
    } else if (line.trim() === "") {
      currentMessage += lineToAdd;
    } else {
      openCodeBlock();
      currentMessage += lineToAdd;
    }
  }

  closeCodeBlock();
  if (currentMessage.trim() !== "") {
    messages.push(currentMessage.trim());
  }

  return messages;
};

export default {
  createTableRow,
  createTableRowSeason,
  createTableRowTeam,
  calculateTeamTotals,
  printWeeklyLeaderboard,
  printTeamSummary,
  printTeamLeaderboard,
  printCombinedLeaderboard,
  printSeasonLeaderboard,
  splitPosts,
};
