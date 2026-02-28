import { Listener } from "@sapphire/framework";
import { showHighScoreRules } from "../../commands/highscores/show-high-score-rules.js";

export class ShowHighScoreRulesButtonListener extends Listener {
  constructor(context, options) {
    super(context, {
      ...options,
      event: "interactionCreate",
    });
  }

  async run(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "show_high_score_rules") return;

    await showHighScoreRules(interaction);
  }
}
