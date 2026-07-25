import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import { formatLongDate } from "../../utils/formatting.js";

/**
 * Calculate duration between two YYYY-MM-DD dates.
 * Returns a string like "1 Day", "5 Days", "2 Weeks", etc.
 * This calculation is inclusive of both start and end dates.
 */
export const calculateDuration = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Add 1 to make the range inclusive
  const days = diffDays + 1;

  if (days >= 7 && days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} ${weeks === 1 ? "Week" : "Weeks"}`;
  }
  return `${days} ${days === 1 ? "Day" : "Days"}`;
};

/**
 * Condensed one-line summary for a tournament table.
 */
export const formatTableLine = (t) => {
  return `\`${t.tableIndex}.\` ${t.table}`;
};

/**
 * Pack the table lines into one or more embed fields, each kept under
 * Discord's 1024-character field-value limit. Continuation fields use a
 * zero-width name so only the first shows the "Tables (N)" header.
 *
 * @param {Array} tables
 */
const buildTableFields = (tables) => {
  const lines = tables.map(formatTableLine);
  const fields = [];
  let current = [];
  let length = 0;

  for (const line of lines) {
    if (length + line.length + 1 > 1024 && current.length) {
      fields.push(current.join("\n"));
      current = [];
      length = 0;
    }
    current.push(line);
    length += line.length + 1;
  }
  if (current.length) fields.push(current.join("\n"));

  return fields.map((value, index) => ({
    name: index === 0 ? `${tables.length} Tables` : "​",
    value,
    inline: false,
  }));
};

/**
 * Build an embed for a list of tournaments, using the unified format.
 *
 * @param {Array} tournaments - Array of tournament objects
 * @param {string} title - Embed title
 */
export const buildTournamentListEmbed = (tournaments, title) => {
  const embed = new EmbedBuilder().setColor("Green").setTitle(title);

  const fields = [];
  const baseUrl = process.env.TOURNAMENTS_URL?.replace(/\/$/, "");

  for (const t of tournaments) {
    const url = baseUrl ? `${baseUrl}/${t._id}` : null;
    const title = url ? `[${t.name}](${url})` : t.name;
    const channelDisplay = t.channelId
      ? `<#${t.channelId}>`
      : t.channelName
        ? `#${t.channelName}`
        : "Unknown Channel";

    const tableList =
      t.tables && t.tables.length > 0
        ? t.tables.map(formatTableLine).join("\n")
        : "No tables";

    const duration = calculateDuration(t.startDate, t.endDate);
    const summary = `${t.tables?.length ?? 0} Tables - ${duration}`;

    fields.push({
      name: `${formatLongDate(t.startDate)} - ${formatLongDate(t.endDate)}`.slice(
        0,
        256,
      ),
      value:
        `${title} in ${channelDisplay}\n${summary}\n${tableList}`.slice(
          0,
          1024,
        ) || "None",
    });
  }

  embed.addFields(fields);
  embed.setFooter({
    text: "📌 Use /post-tournament-score in the tournament's channel. Good luck!",
  });
  return embed;
};

export default { buildTournamentListEmbed };
