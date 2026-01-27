import { EmbedBuilder } from "discord.js";
import { truncate, formatNumber } from "../../utils/formatting.js";
import { renderTable, AlignmentEnum } from "./tableRenderer.js";

/**
 * ---------------------------------------------------------------------------
 *  HIGH SCORE ASCII TABLE PRINTER
 * ---------------------------------------------------------------------------
 */
export const printHighScoreTables = (
  searchTerm,
  tables,
  scoresToShow,
  tablesPerMessage,
) => {
  const embeds = [];
  let buffer = "";
  let count = 0;

  let showAll = false;

  // --- SEARCH TERM LOGIC ---
  if (searchTerm) {
    if (tables.length === 0) {
      return [
        new EmbedBuilder()
          .setTitle("High Score Search")
          .setColor("#ff0000")
          .setDescription("**NO TABLES FOUND**"),
      ];
    }
    showAll = false;
  } else {
    buffer += "**Showing all tables...**\n\n";
    showAll = true;
  }

  tables.forEach((table) => {
    const authorsArray = table?.authorName?.split(", ");
    const firstAuthor = authorsArray?.shift();
    const otherAuthors = authorsArray?.join(", ");

    // --- SHORT TITLE ---
    const shortTitle = truncate(table.tableName, 40);

    // --- TRUNCATED AUTHORS LINE ---
    const authorsRaw = [firstAuthor, otherAuthors].filter(Boolean).join(", ");
    const authorsLine = truncate(authorsRaw, 40);

    // --- VERSION ON ITS OWN LINE ---
    const vpsIdVersionLine = table.versionNumber
      ? `v${table.versionNumber} - vpsId: ${table.vpsId}`
      : "";

    let tableBlock = "";

    // --- ONLY SHOW ASCII TABLES WHEN NOT SHOWING ALL ---
    if (!showAll) {
      if (table.scores?.length > 0) {
        const rows = table.scores
          .sort((a, b) => b.score - a.score)
          .slice(0, scoresToShow)
          .map((score, i) => [
            (i + 1).toString(),
            truncate(score?.user?.username || score?.username, 11),
            formatNumber(score?.score),
          ]);

        tableBlock = renderTable(["#", "User", "Score"], rows, {
          align: [
            [1, AlignmentEnum.RIGHT],
            [2, AlignmentEnum.LEFT],
            [3, AlignmentEnum.RIGHT],
          ],
          widths: [3, 11, 15],
        });
      } else {
        tableBlock = "**NO HIGH SCORES POSTED**";
      }
    }

    // --- BUILD SECTION FOR THIS TABLE ---
    buffer += `**${shortTitle}**\n`;
    if (authorsLine) buffer += `${authorsLine}\n`;
    if (vpsIdVersionLine) buffer += `${vpsIdVersionLine}\n`;
    if (tableBlock) buffer += `${tableBlock}\n\n`;

    count++;

    // --- PAGINATION ---
    if (count === tablesPerMessage) {
      embeds.push(
        new EmbedBuilder()
          .setTitle("🏆  High Scores")
          .setColor("#0099ff")
          .setDescription(buffer),
      );
      buffer = "";
      count = 0;
    }
  });

  // --- FINAL BUFFER ---
  if (buffer.trim().length > 0) {
    embeds.push(
      new EmbedBuilder()
        .setTitle("🏆  High Scores")
        .setColor("#0099ff")
        .setDescription(buffer),
    );
  }

  return embeds;
};

/**
 * ---------------------------------------------------------------------------
 *  PLAYOFF MATCHUP ROW BUILDER
 * ---------------------------------------------------------------------------
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
 * ---------------------------------------------------------------------------
 *  PLAYOFF MATCHUP EMBED PRINTER
 * ---------------------------------------------------------------------------
 */
export const printPlayoffRoundMatchups = (games) => {
  const embed = new EmbedBuilder()
    .setTitle("Current Playoff Round Results")
    .setColor("#0099ff");

  games.forEach((game) => {
    const { awayValue, homeValue } = createTableRowPlayoffMatchup(null, game);
    embed.addFields({ name: "Away", value: awayValue });
    embed.addFields({ name: "Home", value: homeValue });
    embed.addFields({ name: "\u200B", value: "\u200B" });
  });

  return [embed];
};

export default {
  createTableRowPlayoffMatchup,
  printHighScoreTables,
  printPlayoffRoundMatchups,
};
