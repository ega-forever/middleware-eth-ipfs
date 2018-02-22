/**
 * Ping IPFS by specified time in config
 * @module services/scheduleService
 * @see module:config
 */

const schedule = require('node-schedule'),
  ipfsAPI = require('ipfs-api'),
  _ = require('lodash'),
  bunyan = require('bunyan'),
  pinModel = require('../models/pinModel'),
  config = require('../config'),
  bytes32toBase58 = require('../utils/bytes32toBase58'),
  base58toBytes32 = require('../utils/base58toBytes32'),
  Promise = require('bluebird'),
  log = bunyan.createLogger({name: 'plugins.ipfs.scheduleService'});

module.exports = async (event) => {

  const ipfsStack = config.nodes.map(node => ipfsAPI(node));
  let isPending = false;
  let rule = new schedule.RecurrenceRule();
  _.merge(rule, config.schedule.job);

  schedule.scheduleJob(rule, async () => {

    if (isPending)
      return log.info(`still pinning for ${event.eventName}...`);

    log.info('pinning...');
    isPending = true;

    let badPins = await pinModel.find({
      created: {
        $lt: new Date(Date.now() - 30 * 24 * 3600000)
      }
    });

    badPins = badPins.map(pin => pin.bytes32);

    let records = await event.model.aggregate([
      {
        $group: {
          _id: 'a',
          newHashes: {$addToSet: `$${event.newHashField}`},
          oldHashes: {$addToSet: `$${event.oldHashField || 'null'}`}
        }
      },
      {
        $project: {
          filtered: {
            $setDifference: ['$newHashes', '$oldHashes']
          }
        }
      },
      {
        $project: {
          filtered: {
            $setDifference: ['$filtered', badPins]
          }

        }
      }
    ]);

    records = _.chain(records).get('0.filtered').map(hash => bytes32toBase58(hash)).value();
    let hashes = await Promise.map(records, async function (hash) {

      try {
        const result = await Promise.all(ipfsStack.map(async ipfs => {
          return await Promise.resolve(ipfs.pin.add(hash))
            .timeout(60000).catch(() => null);
        }));

        if (!_.compact(result).length)
          return {status: 0, hash: hash};

        log.info(`pinned: ${hash}`);

        return {status: 1, hash: hash};

      } catch (err) {
        if (err instanceof Promise.TimeoutError)
          return {status: 0, hash: hash};

        log.error(err);
        return {status: 2, hash: hash};
      }

    }, {concurrency: 20});

    let inactiveHashes = _.chain(hashes)
      .flattenDeep()
      .filter(item => [0, 2].includes(item.status))
      .map(item => item.hash)
      .uniq()
      .compact()
      .value();

    if (inactiveHashes) {
      log.info('inactive hashes count: ', inactiveHashes.length);
      log.info('inactive hashes: ', inactiveHashes);
    }

    await pinModel.remove({
      hash: {
        $nin: inactiveHashes
      }
    });

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

    for (let hash of inactiveHashes)
      await pinModel.findOneAndUpdate({hash: hash}, {
        $set: {
          hash: hash,
          bytes32: base58toBytes32(hash)
        },
        $setOnInsert: {
          created: Date.now()
        }
      }, {upsert: true});

    isPending = false;

  });

};
