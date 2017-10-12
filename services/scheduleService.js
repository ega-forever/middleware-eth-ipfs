const schedule = require('node-schedule'),
  pinModel = require('../models/pinModel'),
  ipfsAPI = require('ipfs-api'),
  _ = require('lodash'),
  bunyan = require('bunyan'),
  config = require('../config'),
  Promise = require('bluebird'),
  log = bunyan.createLogger({name: 'plugins.ipfs.scheduleService'});

/**
 * @module scheduleService
 * @description ping ipfs by specified time in config
 * @see {@link ../config.json}
 */

module.exports = async () => {

  const ipfsStack = config.nodes.map(node => ipfsAPI(node));

  let isPending = false;
  let rule = new schedule.RecurrenceRule();
  _.merge(rule, config.schedule.job);

  schedule.scheduleJob(rule, async () => {

    if (isPending)
      return log.info('still pinning...');

    isPending = true;

    log.info('pinning...');
    let records = await pinModel.find().sort({updated: 1});

    let hashes = await Promise.all(
      _.chain(records)
        .filter(r => r.hash)
        .map(async function (r) {
          return await Promise.mapSeries(ipfsStack, ipfs =>
            Promise.resolve(ipfs.pin.add(r.hash))
              .timeout(20000)
              .then(()=>r.hash)
              .catch(e => log.error(e)), {concurrency: 50});
        })
        .value()
    );

    await pinModel.update(
      {hash: {$in: _.chain(hashes).flattenDeep().uniq().value()}},
      {$currentDate: {updated: true}},
      {multi: true}
    );

    isPending = false;

  });

};
