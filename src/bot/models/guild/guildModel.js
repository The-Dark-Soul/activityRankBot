const shardDb = require('../../../models/shardDb/shardDb.js');
const managerDb = require('../../../models/managerDb/managerDb.js');
const mysql = require('promise-mysql');
const fct = require('../../../util/fct.js');

const promises = {};
exports.cache = {};
exports.storage = {};

const hostField = process.env.NODE_ENV == 'production' ? 'hostIntern' : 'hostExtern';
const cachedFields = [
    'prefix', 'tokens', 'showNicknames',
    'textMessageCooldownSeconds', 'voteCooldownSeconds', 'xpPerTextMessage', 'xpPerVoiceMinute',
    'voteTag','voteEmote','bonusTag','bonusEmote','entriesPerPage',
    'xpPerVote', 'xpPerBonus', 'bonusPerTextMessage', 'bonusPerVoiceMinute',
    'bonusPerVote', 'bonusUntilDate', 'levelFactor','reactionVote',
    'allowMutedXp', 'allowSoloXp', 'allowInvisibleXp', 'allowDeafenedXp',
    'notifyLevelupDm','notifyLevelupWithRole', 'notifyLevelupCurrentChannel',
    'takeAwayAssignedRolesOnLevelDown','roleAssignMessage', 'roleDeassignMessage',
    'commandOnlyChannel',
    'autopost_serverJoin','autopost_levelup','levelupMessage','serverJoinMessage',
    'addDate'];

exports.cache.load = (guild) => {
  if(!guild.appData) {
    if(promises[guild.id]) { return promises[guild.id]; }

    promises[guild.id] = new Promise(async (resolve,reject) => {
      try {
        await buildCache(guild);
        delete promises[guild.id];
        resolve();
      } catch (e) { delete promises[guild.id]; reject(e); }
    });

    return promises[guild.id];
  }

  return new Promise(async resolve => { resolve(); });
};

exports.storage.set = (guild,field,value) => {
  return new Promise(async function (resolve, reject) {
    try {
      await shardDb.query(guild.appData.dbHost,`UPDATE guild SET ${field} = ${mysql.escape(value)} WHERE guildId = ${guild.id}`);

      if (cachedFields.indexOf(field) > -1)
        guild.appData[field] = value;

      return resolve();
    } catch (e) { reject(e); }
  });
};

exports.storage.increment = (guild,field,value) => {
  return new Promise(async function (resolve, reject) {
    try {
      await shardDb.query(guild.appData.dbHost,`UPDATE guild SET ${field} = ${field} + ${mysql.escape(value)} WHERE guildId = ${guild.id}`);

      if (cachedFields.indexOf(field) > -1)
        guild.appData[field] += value * 1;

      return resolve();
    } catch (e) { reject(e); }
  });
};

exports.storage.get = (guild) => {
  return new Promise(async function (resolve, reject) {
    try {
      const res = await shardDb.query(guild.appData.dbHost,`SELECT * FROM guild WHERE guildId = ${guild.id}`);
      if (res.length == 0)
        return resolve(null);
      else
        return resolve(res[0]);
    } catch (e) { reject(e); }
  });
};

const buildCache = (guild) => {
  return new Promise(async function (resolve, reject) {
    try {
      let dbHost = await getDbHost(guild.id);
      let cache = await shardDb.query(dbHost,`SELECT ${cachedFields.join(',')} FROM guild WHERE guildId = ${guild.id}`);

      if (cache.length == 0) {
        await shardDb.query(dbHost,`INSERT INTO guild (guildId,joinedAtDate,addDate) VALUES (${guild.id},${Math.floor(guild.me.joinedAt / 1000)},${Math.floor(Date.now() / 1000)})`);
        cache = await shardDb.query(dbHost,`SELECT ${cachedFields.join(',')} FROM guild WHERE guildId = ${guild.id}`);
      }

      cache = cache[0];

      cache.addDate = cache.addDate * 1;
      cache.dbHost = dbHost;
      guild.appData = cache;

      resolve();
    } catch (e) { reject(e); }
  });
};

const getDbHost = (guildId) => {
  return new Promise(async function (resolve, reject) {
    try {

      let res = await managerDb.query(`SELECT ${hostField} AS host FROM guildRoute LEFT JOIN dbShard ON guildRoute.dbShardId = dbShard.id WHERE guildId = ${guildId}`);

      if (res.length < 1) {
         await managerDb.query(`INSERT INTO guildRoute (guildId) VALUES (${guildId})`);
         res = await managerDb.query(`SELECT ${hostField} AS host FROM guildRoute LEFT JOIN dbShard ON guildRoute.dbShardId = dbShard.id WHERE guildId = ${guildId}`);
      }

      resolve(res[0].host);
    } catch (e) { reject(e); }
  });
}
