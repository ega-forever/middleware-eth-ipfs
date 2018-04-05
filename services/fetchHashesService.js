/**
 * Ping IPFS by specified time in config
 * @module services/scheduleService
 * @see module:config
 */

const _ = require('lodash'),
  pinModel = require('../models/pinModel'),
  bytes32toBase58 = require('../utils/bytes32toBase58');

module.exports = async (eventModel, newHashName, oldHashName) => {

  let badPins = await pinModel.find({
    created: {
      $lt: new Date(Date.now() - 30 * 24 * 3600000)
    },
    fail_tries: {$gte: 100}
  });

  badPins = badPins.map(pin => pin.bytes32);

  let records = await eventModel.aggregate([
    {
      $group: {
        _id: 'a',
        newHashes: {$addToSet: `$${newHashName}`},
        oldHashes: {$addToSet: `$${oldHashName}`}
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
