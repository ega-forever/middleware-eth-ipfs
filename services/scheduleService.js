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

module.exports = (network) => {

  const ipfsStack = config.nodes.map(node => ipfsAPI(node));

  schedule.scheduleJob(config.schedule.job, async () => {
    let records = await pinModel.find({
      network: network,
      updated: {$lt: new Date(new Date() - config.schedule.checkTime * 1000)}
    });

    let hashes = await Promise.all(
      _.chain(records)
        .filter(r => r.hash)
        .map(r =>
          Promise.all(
            ipfsStack.map(ipfs =>
              Promise.delay(1000)
                .then(() => ipfs.pin.add(r.hash))
                .timeout(30000)
                .catch(err => {
                  log.error(err);
                })
            )
          )
        )
        .value()
    );

    await pinModel.update(
      {hash: {$in: _.chain(hashes).flattenDeep().uniq().value()}},
      {$currentDate: {updated: true}},
      {multi: true}
    );
  });

};
