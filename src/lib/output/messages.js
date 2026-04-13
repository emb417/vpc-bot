import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import {
  printCombinedLeaderboard,
  printSeasonLeaderboard,
} from "./leaderboard.js";

/**
 * Generate weekly boilerplate text for the pinned competition message.
 */
export const generateWeeklyBoilerPlateText = (
  scores,
  teams,
  weekNumber,
  periodStart,
  periodEnd,
  vpsId,
  tableName,
  authorName,
  versionNumber,
  tableUrl,
  romUrl,
  romName,
  notes,
  currentSeasonWeekNumber,
  b2sUrl,
  mode,
) => {
  let bp = "";

  bp += `🎰 **Week ${weekNumber ?? "N/A"} - TABLE OF THE WEEK**\n`;
  if (currentSeasonWeekNumber) {
    bp += ` (Season Week ${currentSeasonWeekNumber})\n`;
  }
  bp += "\n";
  
  // Truncate authors to first author only
  const displayAuthor = (() => {
    if (!authorName || authorName === "N/A") return "N/A";
    const authors = authorName.split(",").map(a => a.trim());
    return authors.length > 1 ? `${authors[0]}, and others` : authors[0];
  })();
  
  // Table Info
  bp += `**Table:** ${tableUrl && tableUrl !== "N/A" ? `[${tableName}](${tableUrl})` : tableName ?? "N/A"}\n`;
  bp += `**Author:** ${displayAuthor}\n`;
  bp += `**Version:** ${versionNumber ?? "N/A"}\n`;
  bp += `**Period:** ${periodStart} – ${periodEnd}\n`;
  
  if (mode && mode !== "default") {
    bp += `**Mode:** ${mode}\n`;
  }

  // ROM Info
  const hasRom = romUrl && romUrl !== "N/A";
  const romLabel = romName && romName !== "N/A" ? `${romName} - Required` : "Required";
  bp += `**ROM:** ${hasRom ? `[${romLabel}](${romUrl})` : "N/A"}\n`;

  // B2S Info
  bp += `**B2S:** ${b2sUrl && b2sUrl.trim() !== "" && b2sUrl !== "N/A" ? `[Available](${b2sUrl})` : "N/A"}\n`;

  if (notes && notes.trim() !== "") {
    bp += `\n**📝 Notes:** ${notes}\n`;
  }

  bp += "\n";
  bp += "**📊 All Current & Historical Results:**\n";
  bp += `<${process.env.COMPETITIONS_URL}>\n\n`;
  bp += "**📌 How to Post:**\n";
  bp += "Use `/post-score` or attach an image and use `!score 12345678`";

  return bp;
};

/**
 * Generate season boilerplate text for the pinned competition message.
 */
export const generateSeasonBoilerPlateText = (season, weeks) => {
  let bp = "\n\n";

  bp += "**SEASON LEADERBOARD**\n\n";
  bp += "**Season #:** " + season.seasonNumber + "\n";
  bp += "**Name:** " + season.seasonName + "\n";
  bp += "**Dates:** " + season.seasonStart + " - " + season.seasonEnd + "\n";
  bp += "\n";
  bp +=
    '** * Please use "/show-season-leaderboard" command for leaderboard.**\n';

  return bp;
};

/**
 * Edit the weekly competition corner message.
 */
export const editWeeklyCompetitionCornerMessage = async (
  scores,
  client,
  week,
  teams,
) => {
  const channel = await client.channels.fetch(
    process.env.COMPETITION_CHANNEL_ID,
  );
  const message = await channel.messages.fetch(
    process.env.COMPETITION_WEEKLY_POST_ID,
  );

  const leaderboardEmbeds = printCombinedLeaderboard(
    scores,
    20,
    teams,
    false,
    false,
  );

  if (leaderboardEmbeds.length > 0) {
    const embed = leaderboardEmbeds[0];
    await message.edit({
      content: generateWeeklyBoilerPlateText(
        scores,
        teams,
        week.weekNumber,
        week.periodStart,
        week.periodEnd,
        week.vpsId,
        week.table,
        week.authorName,
        week.versionNumber,
        week.tableUrl,
        week.romUrl,
        week.romName,
        week.notes,
        week.currentSeasonWeekNumber,
        week.b2sUrl,
        week.mode,
      ),
      embeds: [embed],
    });
  } else {
    await message.edit({
      content: generateWeeklyBoilerPlateText(
        scores,
        teams,
        week.weekNumber,
        week.periodStart,
        week.periodEnd,
        week.vpsId,
        week.table,
        week.authorName,
        week.versionNumber,
        week.tableUrl,
        week.romUrl,
        week.romName,
        week.notes,
        week.currentSeasonWeekNumber,
        week.b2sUrl,
        week.mode,
      ),
    });
  }

  await message.suppressEmbeds(true);
};

/**
 * Edit the season competition corner message.
 */
export const editSeasonCompetitionCornerMessage = async (
  season,
  weeks,
  client,
) => {
  const channel = await client.channels.fetch(
    process.env.COMPETITION_CHANNEL_ID,
  );
  const message = await channel.messages.fetch(
    process.env.COMPETITION_SEASON_POST_ID,
  );

  const leaderboardEmbeds = printSeasonLeaderboard(weeks, 40, false);

  if (leaderboardEmbeds.length > 0) {
    const embed = leaderboardEmbeds[0];
    await message.edit({
      content: generateSeasonBoilerPlateText(season, weeks),
      embeds: [embed],
    });
  } else {
    await message.edit({
      content: generateSeasonBoilerPlateText(season, weeks),
    });
  }

  await message.suppressEmbeds(true);
};

export default {
  generateWeeklyBoilerPlateText,
  generateSeasonBoilerPlateText,
  editWeeklyCompetitionCornerMessage,
  editSeasonCompetitionCornerMessage,
};
