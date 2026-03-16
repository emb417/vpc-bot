import {
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export function buildRaffleModal(customId, title, tableRequired) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addLabelComponents(
      new LabelBuilder().setLabel("VPS ID or Table URL").setTextInputComponent(
        new TextInputBuilder()
          .setCustomId("tableInput")
          .setStyle(TextInputStyle.Short)
          .setRequired(tableRequired)
          .setPlaceholder(
            tableRequired
              ? "e.g. a1!B2@c_1 or https://..."
              : "Leave blank to keep current table",
          ),
      ),
      new LabelBuilder()
        .setLabel("Notes (optional)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId("notes")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setPlaceholder("Anything you want to add about your entry"),
        ),
    );
}
