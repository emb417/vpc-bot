import { EmbedBuilder } from "discord.js";
import { truncate, formatNumber } from "../../utils/formatting.js";
import { calculateSeasonPoints } from "../scores/points.js";
import { renderTable, AlignmentEnum } from "./tableRenderer.js";

/**
 * Create a table row for weekly leaderboard.
 * Returns an array of strings representing the cells.
 */
export const createTableRow = (rank, score, expandedLayout, showScores) => {
  const rankStr = rank.toString();

  // Truncate name to 11 chars to ensure the score doesn't push the table
  // past the 36-char mobile limit
  const nameStr = truncate(score?.username?.replace(/`/g, ""), 11);

  const row = [rankStr, nameStr];

  if (showScores) {
    row.push(formatNumber(score?.score));
  }

  if (expandedLayout) {
    row.push(formatNumber(score?.diff || 0));
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
    formatNumber(team?.totalScore),
  ];
};

/**
 * Create a table row for team member.
 * Returns an array of strings representing the cells.
 */
const createTeamMemberRow = (rank, score, expandedLayout) => {
  const row = [
    rank.toString(),
    truncate(score?.username?.replace(/`/g, ""), 11),
    formatNumber(score?.score),
  ];

  if (expandedLayout) {
    const diff = score?.diff || 0;
    const str = formatNumber(diff);
    const formatted = (diff > 0 ? "+" : "") + str;
    row.push(formatted);
    row.push(score?.posted || "");
  }

  return row;
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
 * Print Weekly Leaderboard
 */
export const printWeeklyLeaderboard = (
  scores,
  numOfScoresToShow,
  expandedLayout,
  showScores,
) => {
  if (!scores || scores.length === 0) {
    return [
      new EmbedBuilder()
        .setTitle("🏆  Weekly Leaderboard")
        .setDescription("NO SCORES POSTED")
        .setColor("#ff0000")
        .addFields({
          name: "🌟  VPC Competition Corner",
          value: `<${process.env.COMPETITIONS_URL}>`,
        })
        .addFields({
          name: "📌  How to Post",
          value:
            "Use `/post-score` or\nAttach an image and use `!score 12345678`",
        }),
    ];
  }

  const limit = numOfScoresToShow || scores.length;
  const headers = ["#", "User"];
  if (showScores) headers.push("Score");
  if (expandedLayout) {
    headers.push("+/-");
    headers.push("Posted");
  }

  const rows = scores
    .slice(0, limit)
    .map((s, i) => createTableRow(i + 1, s, expandedLayout, showScores));

  const embed = new EmbedBuilder()
    .setTitle("🏆  Weekly Leaderboard")
    .setColor("#0099ff")
    .setDescription(
      renderTable(headers, rows, {
        align: [
          [1, AlignmentEnum.RIGHT],
          [2, AlignmentEnum.LEFT],
          [3, AlignmentEnum.RIGHT],
        ],
        widths: [3, 11, 15],
      }),
    )
    .addFields({
      name: "🌟  VPC Competition Corner",
      value: `<${process.env.COMPETITIONS_URL}>`,
    })
    .addFields({
      name: "📌  How to Post",
      value: "Use `/post-score` or\nAttach an image and use `!score 12345678`",
    });

  return [embed];
};

/**
 * Print Team Summary
 */
export const printTeamSummary = (teams, scores) => {
  calculateTeamTotals(teams, scores);
  teams.sort((a, b) => b.totalScore - a.totalScore);

  const headers = ["#", "Team", "Total"];
  const rows = teams.map((team, i) => createTableRowTeam(i + 1, team));

  const embed = new EmbedBuilder()
    .setTitle("👥  Team Summary")
    .setColor("#0099ff")
    .setDescription(
      renderTable(headers, rows, {
        align: [
          [1, AlignmentEnum.RIGHT],
          [2, AlignmentEnum.LEFT],
          [3, AlignmentEnum.RIGHT],
        ],
        widths: [3, 14, 10],
      }),
    );
  return [embed];
};

/**
 * Print Team Leaderboard
 */
export const printTeamLeaderboard = (scores, teams, expandedLayout) => {
  const embeds = [];

  for (const team of teams) {
    const memberScores = team.members.map((member) => {
      const found = scores.find((x) => x.username === member.trim());
      return found || { username: member, score: 0, diff: 0, posted: "" };
    });

    memberScores.sort((a, b) => b.score - a.score);

    const headers = ["#", "User", "Score"];
    if (expandedLayout) headers.push("+/-", "Posted");

    const rows = memberScores.map((s, i) =>
      createTeamMemberRow(i + 1, s, expandedLayout),
    );

    const totalScore = memberScores.reduce(
      (acc, curr) => acc + (curr.score || 0),
      0,
    );

    const embed = new EmbedBuilder()
      .setTitle(`👥  Team: ${team.name}`)
      .setColor("#0099ff")
      .setDescription(
        renderTable(headers, rows, {
          align: [
            [1, AlignmentEnum.RIGHT],
            [2, AlignmentEnum.LEFT],
            [3, AlignmentEnum.RIGHT],
          ],
          widths: expandedLayout ? [3, 11, 10, 8, 16] : [3, 11, 12],
        }),
      )
      .setFooter({
        text: `Team Total: ${formatNumber(totalScore)}`,
      });

    embeds.push(embed);
  }

  return embeds;
};

/**
 * Print Season Leaderboard
 */
export const printSeasonLeaderboard = (
  weeks,
  numOfScoresToShow,
  expandedLayout,
) => {
  if (!weeks || weeks.length === 0) {
    return [
      new EmbedBuilder()
        .setTitle("🌟  Season Leaderboard")
        .setDescription("NO SEASON DATA")
        .setColor("#ff0000"),
    ];
  }

  const leaderboard = calculateSeasonPoints(weeks);
  const limit = numOfScoresToShow || leaderboard.length;

  const headers = ["#", "User", "Pts"];
  if (expandedLayout) headers.push("Score");

  const rows = leaderboard
    .slice(0, limit)
    .map((p, i) => createTableRowSeason(i + 1, p, expandedLayout));

  const embed = new EmbedBuilder()
    .setTitle("🌟  Season Leaderboard")
    .setColor("#0099ff")
    .setDescription(
      renderTable(headers, rows, {
        align: [
          [1, AlignmentEnum.RIGHT],
          [2, AlignmentEnum.LEFT],
          [3, AlignmentEnum.RIGHT],
        ],
        widths: expandedLayout ? [3, 15, 8, 10] : [3, 15, 8],
      }),
    )
    .addFields({
      name: "📊  VPC Season Corner",
      value: `<${process.env.SEASON_URL}>`,
    })
    .addFields({
      name: "📌  How to Post",
      value: "Use `/post-score` or\nAttach an image and use `!score 12345678`",
    });

  return [embed];
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
    return [
      new EmbedBuilder()
        .setTitle("🏆  Weekly Leaderboard")
        .setDescription("NO SCORES CURRENTLY POSTED")
        .setColor("#ff0000")
        .addFields({
          name: "🌟  VPC Competition Corner",
          value: `<${process.env.COMPETITIONS_URL}>`,
        })
        .addFields({
          name: "📌  How to Post",
          value:
            "Use `/post-score` or\nAttach an image and use `!score 12345678`",
        }),
    ];
  }

  if (teams && teams.length > 0) {
    allEmbeds.push(...printTeamSummary(teams, scores));

    if (showTeamDetails) {
      allEmbeds.push(...printTeamLeaderboard(scores, teams, expandedLayout));
    }
  }

  allEmbeds.push(
    ...printWeeklyLeaderboard(scores, numOfScoresToShow, expandedLayout, true),
  );

  return allEmbeds;
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
};
