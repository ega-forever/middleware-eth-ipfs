/**
 * Ping IPFS by specified time in config
 * @module services/scheduleService
 * @see module:config
 */

const schedule = require('node-schedule'),
  pinModel = require('../models/pinModel'),
  ipfsAPI = require('ipfs-api'),
  _ = require('lodash'),
  bunyan = require('bunyan'),
  config = require('../config'),
  Promise = require('bluebird'),
  log = bunyan.createLogger({name: 'plugins.ipfs.scheduleService'});

module.exports = () => {

  const ipfsStack = config.nodes.map(node => ipfsAPI(node));
  let isPending = false;
  let rule = new schedule.RecurrenceRule();
  _.merge(rule, config.schedule.job);

  schedule.scheduleJob(rule, async () => {

    if (isPending)
      return log.info('still pinning...');

    log.info('pinning...');
    let records = await pinModel.find().sort({updated: 1});

    let hashes = await Promise.all(
      _.chain(records)
        .filter(r => r.hash)
        .map(async function (r) {
          return await Promise.mapSeries(ipfsStack, ipfs =>
            Promise.resolve(ipfs.pin.add(r.hash))
              .timeout(60000 * 20)
              .then(() => {
                log.info(`pinned: ${r.hash}`);
                return {status: 1, hash: r.hash};
              })
              .catch(err => {
                log.error(err);
                return err instanceof Promise.TimeoutError ?
                  {status: 0, hash: r.hash} :
                  {status: 2, hash: r.hash};
              }), {concurrency: 50});
        })
        .value()
    );

    let activeHashes = _.chain(hashes)
      .flattenDeep()
      .filter({status: 1})
      .map(item => item.hash)
      .uniq().compact().value();

    let inactiveHashes = _.chain(hashes)
      .flattenDeep()
      .filter({status: 0})
      .map(item => item.hash)
      .uniq().compact().value();

    await pinModel.update({
      hash: {
        $in: activeHashes
      }
    },
    {
      $currentDate: {updated: true},
      $set: {
        fail_tries: 0
      }
    }, {multi: true}
    );

    await pinModel.update({
      hash: {
        $in: inactiveHashes
      }
    },
    {
      $currentDate: {updated: true},
      $inc: {
        fail_tries: 1
      }
    },
    {multi: true}
    );

    await pinModel.remove({
      hash: {
        $in: inactiveHashes
      },
      fail_tries: {$gt: 10}
    });

    isPending = false;

  });

};
