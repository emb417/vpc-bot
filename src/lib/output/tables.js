import Table from "easy-table";
import { truncate, formatNumber, transformDate } from "../../utils/formatting.js";

/**
 * Create a table row for high score.
 */
export const createTableRowHighScore = (rank, table, score, expandedLayout) => {
  table.cell("Rank", rank, Table.leftPadder(" "));
  table.cell(
    "User",
    truncate(score?.user?.username, 11),
    Table.rightPadder(" ")
  );
  table.cell("Score", score?.score, (val, width) => {
    const str = formatNumber(val);
    return width ? Table.padLeft(str, width) : str;
  });
  table.cell("v", score?.versionNumber, Table.rightPadder(" "));

  if (expandedLayout) {
    table.cell(
      "Posted",
      transformDate(score?.createdAt, "MM/DD/YYYY...", "MM/DD/YYYY"),
      Table.rightPadder(" ")
    );
  }

  table.newRow();
};

/**
 * Create a table row for playoff matchup.
 */
export const createTableRowPlayoffMatchup = (table, game) => {
  table.cell("Seed", game.away?.seed, Table.leftPadder(" "));
  table.cell("User", game.away?.username, Table.rightPadder(" "));
  table.cell("Score", game.away?.score, (val, width) => {
    const str = formatNumber(val);
    return width ? Table.padLeft(str, width) : str;
  });
  table.newRow();

  table.cell("Seed", game.home?.seed, Table.leftPadder(" "));
  table.cell("User", game.home?.username, Table.rightPadder(" "));
  table.cell("Score", game.home?.score, (val, width) => {
    const str = formatNumber(val);
    return width ? Table.padLeft(str, width) : str;
  });
  table.newRow();
  table.newRow();
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
        const t = new Table();
        table.scores
          .sort((a, b) => b.score - a.score)
          .slice(0, scoresToShow)
          .forEach((score, i) => {
            createTableRowHighScore(i + 1, t, score, false);
          });
        strText += "`" + t.toString() + "`" + "\n \n ";
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
  const tableArray = [];
  let strText = "**Current Playoff Round Results:**\n";

  const t = new Table();
  games.forEach((game) => {
    createTableRowPlayoffMatchup(t, game);
  });

  strText += "`" + t.toString() + "`\n\n";
  tableArray.push(strText);

  return tableArray;
};

export default {
  createTableRowHighScore,
  createTableRowPlayoffMatchup,
  printHighScoreTables,
  printPlayoffRoundMatchups,
};
