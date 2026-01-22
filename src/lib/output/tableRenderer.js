import { AsciiTable3, AlignmentEnum } from "ascii-table3";

/**
 * Shared ASCII table renderer for ALL tables in the bot.
 */
export const renderTable = (headings, rows, options = {}) => {
  const table = new AsciiTable3().setHeading(...headings).setStyle("compact");
  table.setCellMargin(0);

  if (options.align) {
    for (const [col, align] of options.align) {
      table.setAlign(col, align);
    }
  }

  if (options.widths) {
    table.setWidths(options.widths);
  }

  table.addRowMatrix(rows);

  return `\`\`\`\n${table.toString()}\n\`\`\``;
};

export { AlignmentEnum };
