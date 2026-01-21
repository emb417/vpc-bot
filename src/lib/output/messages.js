import "dotenv/config";
import { printCombinedLeaderboard, printSeasonLeaderboard } from "./leaderboard.js";

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
  mode
) => {
  let bp = "\n\n";

  bp += "**WEEKLY LEADERBOARD**\n\n";
  bp += `**Week:** ${weekNumber ?? "N/A"}\n`;
  bp += `**Current Season Week:** ${currentSeasonWeekNumber ?? "N/A"}\n`;
  bp += `**Dates:** ${periodStart} - ${periodEnd}\n`;
  bp += "\n";
  bp += `**VPS Id:** ${vpsId ?? "N/A"}\n`;
  bp += `**Table Name:** ${tableName ?? "N/A"}\n`;
  bp += `**Author Name:** ${authorName ?? "N/A"}\n`;
  bp += `**Version:** ${versionNumber ?? "N/A"}\n`;
  bp += mode !== "default" ? `**Mode:** ${mode ?? "N/A"}\n` : "";
  bp += `**Table Url:** ${tableUrl ?? "N/A"}\n`;
  bp += `**Rom Url:** ${romUrl ?? "N/A"}\n`;
  bp += `**Rom Name:** ${romName ?? "N/A"}\n`;
  bp += `**B2S Url:** ${b2sUrl ?? "N/A"}\n`;
  bp += `**Notes:** ${notes ?? "N/A"}\n\n`;
  bp += printCombinedLeaderboard(scores, 20, teams, false, false)[0];
  bp += "\n";
  bp += "\n";
  bp +=
    '** * Only the Top 20 scores will displayed due to Discord character limitations.  Please use the "/show-leaderboard" command for full results.**\n';
  bp += "\n";
  bp += "**All Current & Historical Results:**\n";
  bp += "https://www.iscored.info/?mode=public&user=ED209 \n";

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
  bp += printSeasonLeaderboard(weeks, 40, false)[0];
  bp += "\n";
  bp += "\n";
  bp +=
    '** * Only the Top 40 positions will displayed due to Discord character limitations.  Please use the "/show-season-leaderboard" command for full results.**\n';

  return bp;
};

/**
 * Edit the weekly competition corner message.
 */
export const editWeeklyCompetitionCornerMessage = async (
  scores,
  client,
  week,
  teams
) => {
  const channel = await client.channels.fetch(
    process.env.COMPETITION_CHANNEL_ID
  );
  const message = await channel.messages.fetch(
    process.env.COMPETITION_WEEKLY_POST_ID
  );

  await message.edit(
    generateWeeklyBoilerPlateText(
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
      week.mode
    )
  );
  await message.suppressEmbeds(true);
};

/**
 * Edit the season competition corner message.
 */
export const editSeasonCompetitionCornerMessage = async (season, weeks, client) => {
  const channel = await client.channels.fetch(
    process.env.COMPETITION_CHANNEL_ID
  );
  const message = await channel.messages.fetch(
    process.env.COMPETITION_SEASON_POST_ID
  );

  await message.edit(generateSeasonBoilerPlateText(season, weeks));
  await message.suppressEmbeds(true);
};

export default {
  generateWeeklyBoilerPlateText,
  generateSeasonBoilerPlateText,
  editWeeklyCompetitionCornerMessage,
  editSeasonCompetitionCornerMessage,
};
