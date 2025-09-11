require('dotenv').config()
const path = require('path');
const date = require('date-and-time');
const outputHelper = require('../helpers/outputHelper');
const mongoHelper = require('../helpers/mongoHelper');
const Logger = require('../helpers/loggingHelper');
const { ArgHelper } = require('../helpers/argHelper');
const { PermissionHelper } = require('../helpers/permissionHelper');
const { VPCDataService } = require('../services/vpcDataService')
const { VPSDataService } = require('../services/vpsDataService');

module.exports = {
  commandName: path.basename(__filename).split('.')[0],
  slash: true,
  testOnly: true,
  guildOnly: true,
  hidden: true,
  description: 'Create new week by VPS Id.',
  roles: [process.env.BOT_CONTEST_ADMIN_ROLE_NAME],
  channels: process.env.CONTEST_CHANNELS,
  minArgs: 2,
  expectedArgs: '<vpsid> <romrequired> <mode> <startdateoverride> <enddateoverride> <b2sidoverride> <notes>',
  callback: async ({ args, user, client, channel, interaction, instance, message}) => {
    const logger = (new Logger(user)).logger;
    let retVal;
    let ephemeral = false;
    const argHelper = new ArgHelper();
    const permissionHelper = new PermissionHelper();
    const vpcDataService = new VPCDataService();
    const vpsDataService = new VPSDataService();

    await interaction.deferReply();

    // Check if the User has a valid Role
    retVal = await permissionHelper.hasRole(client, interaction, module.exports.roles, module.exports.commandName);
    if (retVal) {interaction.editReply({content: retVal, ephemeral: true}); return;}

    // Check if the Channel is valid
    retVal = await permissionHelper.isValidChannel(module.exports.channels, interaction, module.exports.commandName);
    if (retVal) {interaction.editReply({content: retVal, ephemeral: true}); return;}

    try{
      const vpsid = argHelper.getArg(interaction.options.data, 'string', 'vpsid');
      const romrequired = argHelper.getArg(interaction.options.data, 'bool', 'romrequired') ?? true;  
      const mode = argHelper.getArg(interaction.options.data, 'string', 'mode') ?? 'default';  
      const startdateoverride = argHelper.getArg(interaction.options.data, 'string', 'startdateoverride');
      const enddateoverride = argHelper.getArg(interaction.options.data, 'string', 'enddateoverride');
      const b2sidoverride = argHelper.getArg(interaction.options.data, 'string', 'b2sidoverride');
      const notes = argHelper.getArg(interaction.options.data, 'string', 'notes');
      let errors = [];
      let weekNumber;
      let periodStart;
      let periodEnd;
      let table;
      let authorName;
      let versionNumber;
      let tableUrl;
      let romUrl;
      let romName;
      let currentSeasonWeekNumber;

      const vpsGame = await vpsDataService.getVpsGame(vpsid);

      if (vpsGame.table) {
        const currentSeason = await mongoHelper.findCurrentSeason(channel.name);
        const currentWeek = await vpcDataService.getCurrentWeek(channel.name);
              
        weekNumber = parseInt(currentWeek.weekNumber) + 1;
        currentSeasonWeekNumber = currentWeek.currentSeasonWeekNumber ? (parseInt(currentWeek.currentSeasonWeekNumber) + 1) : null;
        periodStart = startdateoverride ?? date.format(date.addDays(date.parse(currentWeek.periodStart, 'YYYY-MM-DD'), 7), 'YYYY-MM-DD');
        periodEnd = enddateoverride ?? date.format(date.addDays(date.parse(currentWeek.periodEnd, 'YYYY-MM-DD'), 7), 'YYYY-MM-DD');
        table = `${vpsGame?.name} (${vpsGame?.manufacturer} ${vpsGame?.year})`;
        authorName = vpsGame.table?.authors?.join(', ') ?? '';
        versionNumber = vpsGame?.table?.version ?? '';
        tableUrl = vpsGame.table?.urls[0]?.url ?? '';
        b2sUrl = b2sidoverride ? vpsGame?.b2sFiles.find(b => b.id === b2sidoverride)?.urls[0]?.url : (vpsGame.b2sFiles && vpsGame.b2sFiles.length > 0 && vpsGame.b2sFiles[0].urls.length > 0 && vpsGame?.b2sFiles[0]?.urls[0]?.url != '' ? vpsGame?.b2sFiles[0]?.urls[0]?.url : '');
        if (romrequired && !vpsGame?.romFiles?.[0]?.urls?.[0]?.url) {
          errors.push("Missing romUrl. Please provide at least one romUrl, or remove romFiles, or set romrequired to false.");
        } else if (romrequired && !vpsGame?.romFiles?.[0]?.version) {
          errors.push("Missing romName. Please provide a romName, or remove romFiles, or set romrequired to false.");
        } else {
          romUrl = vpsGame?.romFiles?.[0]?.urls?.[0]?.url ?? "";
          romName = vpsGame?.romFiles?.[0]?.version ?? "";
        }

        if(errors.length === 0 || !romrequired) {
          var newWeek = {
            'channelName': channel.name,
            'weekNumber': weekNumber,
            'periodStart': periodStart,
            'periodEnd': periodEnd,
            'table': table,
            'authorName': authorName,
            'versionNumber': versionNumber,
            'vpsId': vpsid,
            'mode': mode,
            'tableUrl': tableUrl,
            'romUrl': romUrl === '' ? 'N/A' : romUrl ?? '',
            'romName': romName === '' ? 'N/A' : romName ?? '',
            'b2sUrl': b2sUrl,
            'season': currentSeason?.seasonNumber ? parseInt(currentSeason?.seasonNumber) : null,
            'currentSeasonWeekNumber': currentSeasonWeekNumber,
            'notes': notes,
            'scores': [],
            'teams': [],
            'isArchived': false
          }

          await mongoHelper.updateOne({ channelName: channel.name, isArchived: false }, { $set: { isArchived: true } }, null, 'weeks');
          await mongoHelper.insertOne(newWeek, 'weeks');

          //only updating the weekly message for competition-corner
          if (channel.name === process.env.COMPETITION_CHANNEL_NAME) {
            await outputHelper.editWeeklyCompetitionCornerMessage(newWeek.scores, client, newWeek, newWeek.teams);

            if(currentSeason) {
              const weeksInSeason = await mongoHelper.find({
                channelName: channel.name,
                isArchived: true,
                periodStart: { $gte: currentSeason.seasonStart },
                periodEnd: { $lte: currentSeason.seasonEnd }
              }, 'weeks');

              await outputHelper.editSeasonCompetitionCornerMessage(currentSeason, weeksInSeason, client)
            }

            retVal = `New week created and the ${channel.name} pinned message was updated successfully.`;
          } else {
            retVal = `New week created for the ${channel.name} channel.`;
          }
    
          if (channel.name === process.env.COMPETITION_CHANNEL_NAME) {
            client.emit('advancePlayoffRound', instance, interaction, currentWeek);
            client.emit('postBraggingRights', instance, process.env.BRAGGING_RIGHTS_CHANNEL_ID, currentWeek);
            client.emit('createHighScoreTable', instance, newWeek.vpsId, interaction, channel)
          }  

          interaction.editReply({content: retVal, ephemeral: ephemeral});
        } else {
          interaction.editReply({content: `***Error creating new week. New week HAS NOT been created***: \n\n${errors.join('\n')}`, ephemeral: ephemeral});
        }
      } else {
        interaction.editReply({content: `No VPS Tables were found.  Please double check your VPS ID.`, ephemeral: ephemeral});
      }
    } catch(e) {
      logger.error(e);
      interaction.editReply({content: e.message, ephemeral: true});
    }
  },
}
 