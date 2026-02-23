import { Listener } from "@sapphire/framework";
import { showRaffleBoard } from "../../commands/utility/show-raffle-board.js";

export class ShowRaffleBoardListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_raffle_board") return;

    await showRaffleBoard(interaction);
  }
}
