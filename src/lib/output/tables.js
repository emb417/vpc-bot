import { EmbedBuilder } from "discord.js";
import { truncate, formatNumber, transformDate } from "../../utils/formatting.js";

/**
 * Create a table row for high score.
 */
export const createTableRowHighScore = (rank, table, score, expandedLayout) => {
  let value = `**Rank:** ${rank}\n`;
  value += `**User:** ${truncate(score?.user?.username, 11)}\n`;
  value += `**Score:** ${formatNumber(score?.score)}\n`;
  value += `**v:** ${score?.versionNumber}\n`;

  if (expandedLayout) {
    value += `**Posted:** ${transformDate(score?.createdAt, "MM/DD/YYYY...", "MM/DD/YYYY")}\n`;
  }

  return value;
};

/**
 * Create a table row for playoff matchup.
 */
export const createTableRowPlayoffMatchup = (table, game) => {
  let awayValue = `**Seed:** ${game.away?.seed}\n`;
  awayValue += `**User:** ${game.away?.username}\n`;
  awayValue += `**Score:** ${formatNumber(game.away?.score)}\n`;

  let homeValue = `**Seed:** ${game.home?.seed}\n`;
  homeValue += `**User:** ${game.home?.username}\n`;
  homeValue += `**Score:** ${formatNumber(game.home?.score)}\n`;

  return { awayValue, homeValue };
};

/**
 * Print high score tables.
 */
export const printHighScoreTables = (
  searchTerm,
  tables,
  scoresToShow,
  tablesPerMessage
) => {
  let strText = "";
  const tableArray = [];
  let showAll = false;
  let x = 1;

  if (searchTerm) {
    if (tables.length === 0) {
      strText = "**NO TABLES FOUND**";
    }
  } else {
    strText = "**Showing all tables...**\n\n";
    showAll = true;
  }

  tables.forEach((table) => {
    const authorsArray = table?.authorName?.split(", ");
    const firstAuthor = authorsArray?.shift();

    strText +=
      (table?.tableUrl
        ? `[**${table.tableName}**](${table.tableUrl ?? ""})`
        : `**${table.tableName}**`) +
      ` (${table.authorName ? `${firstAuthor}... ` : ""}${
        table.versionNumber ?? ""
      })\n`;

    if (!showAll) {
      if (table.scores && table.scores.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle(table.tableName)
          .setColor("#0099ff");

        table.scores
          .sort((a, b) => b.score - a.score)
          .slice(0, scoresToShow)
          .forEach((score, i) => {
            const rowValue = createTableRowHighScore(i + 1, table, score, false);
            embed.addFields({ name: `#${i + 1}`, value: rowValue });
          });

        strText += embed.toJSON().description + "\n \n ";
      } else {
        strText += "**NO HIGH SCORES POSTED**\n\n";
      }
    }

    if (x === tablesPerMessage) {
      tableArray.push(strText);
      strText = "";
      x = 0;
    }
    x++;
  });

  tableArray.push(strText);
  return tableArray;
};

/**
 * Print playoff round matchups.
 */
export const printPlayoffRoundMatchups = (games) => {
  const embed = new EmbedBuilder()
    .setTitle("Current Playoff Round Results")
    .setColor("#0099ff");

  games.forEach((game) => {
    const { awayValue, homeValue } = createTableRowPlayoffMatchup(embed, game);
    embed.addFields({ name: "Away", value: awayValue });
    embed.addFields({ name: "Home", value: homeValue });
    embed.addFields({ name: "\u200B", value: "\u200B" }); // Empty field for spacing
  });

  return [embed];
};

export default {
  createTableRowHighScore,
  createTableRowPlayoffMatchup,
  printHighScoreTables,
  printPlayoffRoundMatchups,
};
