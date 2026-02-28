import { Listener } from "@sapphire/framework";
import { showCompetitionRules } from "../../commands/competition/show-competition-rules.js";

export class ShowCompetitionRulesButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_competition_rules") return;

    await showCompetitionRules(interaction);
  }
}
