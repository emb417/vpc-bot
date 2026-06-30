import "dotenv/config";
import { EmbedBuilder } from "discord.js";
import { formatLongDate } from "../../utils/formatting.js";

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
    name: index === 0 ? `Tables (${tables.length})` : "​",
    value,
    inline: false,
  }));
};

/**
 * Build the standard tournament embed (used by /start-tournament and
 * /show-tournament so both render identically). Pass a `title` to override
 * the default heading.
 *
 * @param {Object} tournament - tournament doc with name/startDate/endDate/tables/notes
 * @param {Object} [opts]
 * @param {string} [opts.title] - embed title override
 */
export const buildTournamentEmbed = (tournament, { title } = {}) => {
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
      ...buildTableFields(tournament.tables ?? []),
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
