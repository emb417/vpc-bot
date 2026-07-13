import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import { formatLongDate } from "../../utils/formatting.js";

/**
 * Calculate duration between two YYYY-MM-DD dates.
 * Returns a string like "1 Day", "5 Days", "2 Weeks", etc.
 * This calculation is inclusive of both start and end dates.
 */
const calculateDuration = (startDate, endDate) => {
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
 * Build a condensed one-line summary for a tournament table with
 * table / ROM / B2S links (only the ones that exist).
 */
const formatTableLine = (t) => {
  const title = t.tableUrl ? `[${t.table}](${t.tableUrl})` : t.table;
  const links = [];
  if (t.romUrl && t.romUrl !== "N/A") links.push(`[ROM](${t.romUrl})`);
  if (t.b2sUrl && t.b2sUrl !== "N/A") links.push(`[B2S](${t.b2sUrl})`);
  const suffix = links.length ? ` · ${links.join(" · ")}` : "";
  return `\`${t.tableIndex}.\` ${title}${suffix}`;
};

/**
 * Pack the table lines into one or more embed fields, each kept under
 * Discord's 1024-character field-value limit. Continuation fields use a
 * zero-width name so only the first shows the "Tables (N)" header.
 *
 * @param {Array} tables
 * @param {string} duration - e.g., "2 Days" or "3 Weeks"
 */
const buildTableFields = (tables, duration) => {
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
    name: index === 0 ? `${tables.length} Tables - ${duration}` : "​",
    value,
    inline: false,
  }));
};

/**
 * Build the standard tournament embed (used by /create-tournament and
 * /show-tournament so both render identically). Pass a `title` to override
 * the default heading.
 *
 * @param {Object} tournament - tournament doc with name/startDate/endDate/tables/notes
 * @param {Object} [opts]
 * @param {string} [opts.title] - embed title override
 */
export const buildTournamentEmbed = (tournament, { title } = {}) => {
  const duration = calculateDuration(tournament.startDate, tournament.endDate);
  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle(title ?? `🏆 ${tournament.name}`)
    .addFields(
      {
        name: "Start",
        value: formatLongDate(tournament.startDate),
        inline: true,
      },
      {
        name: "End",
        value: formatLongDate(tournament.endDate),
        inline: true,
      },
      ...buildTableFields(tournament.tables ?? [], duration),
      ...(tournament.notes
        ? [
            {
              name: "Notes",
              value: tournament.notes.slice(0, 1024),
              inline: false,
            },
          ]
        : []),
    )
    .setFooter({
      text: "Post scores with /post-tournament-score. Good luck!",
    });

  const id = tournament._id?.toString();
  const baseUrl = process.env.TOURNAMENTS_URL?.replace(/\/$/, "");
  if (baseUrl && id) {
    embed.setURL(`${baseUrl}/${id}`);
  }

  return embed;
};

export default { buildTournamentEmbed };
