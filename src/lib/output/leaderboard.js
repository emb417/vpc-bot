import { markdownTable } from "markdown-table";
import { codeBlock } from "@discordjs/formatters";
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
  const outputLines = ["**Weekly Leaderboard:**"];

  if (!scores || scores.length === 0) {
    outputLines.push("NO SCORES CURRENTLY POSTED");
    return outputLines;
  }

  const header = ["Rank", "User"];
  const align = ["l", "l"];

  if (showScores) {
    header.push("Score");
    align.push("r");
  }

  if (expandedLayout) {
    header.push("+/- Last");
    align.push("r");
    header.push("Posted");
    align.push("l");
  }

  const body = [];
  const limit = numOfScoresToShow || scores.length;

  scores.slice(0, limit).forEach((score, i) => {
    body.push(createTableRow(i + 1, score, expandedLayout, showScores));
  });

  const tableString = markdownTable([header, ...body], { align });
  outputLines.push(...tableString.split("\n"));

  return outputLines;
};

/**
 * Print team summary.
 * Returns an array of strings, each representing a line of the table output.
 */
export const printTeamSummary = (teams, scores) => {
  const outputLines = ["**Team Summary:**"];

  calculateTeamTotals(teams, scores);

  // Sort teams by total score descending
  teams.sort((a, b) => b.totalScore - a.totalScore);

  const header = ["Rank", "Team", "Score"];
  const align = ["l", "l", "r"];
  const body = [];
  
  teams.forEach((team, i) => {
    body.push(createTableRowTeam(i + 1, team));
  });

  const tableString = markdownTable([header, ...body], { align });
  outputLines.push(...tableString.split("\n"));

  return outputLines;
};

/**
 * Print team leaderboard with member details.
 * Returns an array of strings, each representing a line of the table output.
 */
export const printTeamLeaderboard = (scores, teams, expandedLayout) => {
  const outputLines = ["**Team Leaderboard**:"];

  teams.forEach((team) => {
    outputLines.push(`**Team:** ${team.name}`);

    const memberScores = team.members.map((member) => {
      const found = scores.find((x) => x.username === member.trim());
      return found || { username: member, score: 0, posted: "" };
    });

    // Sort by score descending
    memberScores.sort((a, b) => b.score - a.score);

    const header = ["Rank", "User", "Score"];
    const align = ["l", "l", "r"];
    
    if (expandedLayout) {
      header.push("+/- Last");
      align.push("r");
      header.push("Posted");
      align.push("l");
    }

    const body = [];
    memberScores.forEach((score, i) => {
      body.push(createTableRow(i + 1, score, expandedLayout, true));
    });

    // Total row
    const totalScore = memberScores.reduce((acc, curr) => acc + (curr.score || 0), 0);
    body.push(["", "Total:", formatNumber(totalScore), ...(expandedLayout ? ["", ""] : [])]);

    const tableString = markdownTable([header, ...body], { align });
    outputLines.push(...tableString.split("\n"));
    outputLines.push(""); // Add an empty line for spacing between teams
  });

  return outputLines;
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
  let allContentLines = [];

  if (!scores || scores.length === 0) {
    allContentLines.push("**NO SCORES CURRENTLY POSTED**");
    return allContentLines;
  }

  if (teams && teams.length > 0) {
    allContentLines.push(...printTeamSummary(teams, scores));
    allContentLines.push(""); // Add a blank line for spacing

    if (showTeamDetails) {
      allContentLines.push(...printTeamLeaderboard(scores, teams, expandedLayout));
      allContentLines.push(""); // Add a blank line for spacing
    }
  }

  allContentLines.push(...printWeeklyLeaderboard(
    scores,
    numOfScoresToShow,
    expandedLayout,
    true,
  ));

  return splitPosts(allContentLines);
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
    return ["**NO SEASON LEADERBOARD CURRENTLY POSTED**"];
  }

  const allContentLines = ["**Season Leaderboard:**"];
  const leaderboard = calculateSeasonPoints(weeks);
  const limit = numOfScoresToShow || leaderboard.length;

  const header = ["Rank", "User", "Points"];
  const align = ["l", "l", "r"];
  
  if (expandedLayout) {
    header.push("Score");
    align.push("r");
  }

  const body = [];
  leaderboard.slice(0, limit).forEach((player, i) => {
    body.push(createTableRowSeason(i + 1, player, expandedLayout));
  });

  const tableString = markdownTable([header, ...body], { align });
  allContentLines.push(...tableString.split("\n"));

  return splitPosts(allContentLines);
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
