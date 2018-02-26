/**
 * Ping IPFS by specified time in config
 * @module services/scheduleService
 * @see module:config
 */

const _ = require('lodash'),
  bunyan = require('bunyan'),
  pinModel = require('../models/pinModel'),
  config = require('../config'),
  bytes32toBase58 = require('../utils/bytes32toBase58'),
  base58toBytes32 = require('../utils/base58toBytes32'),
  Promise = require('bluebird'),
  pinOrRestoreHashService = require('./pinOrRestoreHashService'),
  log = bunyan.createLogger({name: 'plugins.ipfs.scheduleService'});

module.exports = async (events) => {

  const setHashEventModel = events.SetHash;

  let badPins = await pinModel.find({
    created: {
      $lt: new Date(Date.now() - 30 * 24 * 3600000)
    },
    fail_tries: {$gte: 100}
  });

  badPins = badPins.map(pin => pin.bytes32);

  let records = await setHashEventModel.aggregate([
    {
      $group: {
        _id: 'a',
        newHashes: {$addToSet: '$newHash'},
        oldHashes: {$addToSet: '$oldHash'}
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

  return _.chain(records)
    .get('0.filtered')
    .map(hash => bytes32toBase58(hash))
    .value();

};
