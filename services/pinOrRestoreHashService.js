const _ = require('lodash'),
  bunyan = require('bunyan'),
  pinModel = require('../models/pinModel'),
  config = require('../config'),
  base58toBytes32 = require('../utils/base58toBytes32'),
  Promise = require('bluebird'),
  log = bunyan.createLogger({name: 'plugins.ipfs.scheduleService'});

module.exports = async (records, ipfsStack) => {

  const pins = await pinModel.find({hash: {$in: records}});

  let hashes = await Promise.map(records, async function (hash) {

    let pin = _.find(pins, {hash: hash});

    try {

      if (!pin) {
        pin = new pinModel({
          hash: hash,
          bytes32: base58toBytes32(hash)
        });
        await pin.save();
      }

      if (!_.get(pin, 'payload')) {
        pin.payload = await Promise.any(ipfsStack.map(async ipfs => {
          return await Promise.resolve(ipfs.object.data(hash))
            .timeout(10000);
        }));
        await pin.save();
      }

      const result = await Promise.all(ipfsStack.map(async (ipfs, i) =>

        await Promise.resolve(ipfs.pin.add(pin.hash))
          .timeout(10000)
          .catch(() => ipfs.object.put({Data: pin.payload, Links: []}))
          .catch(() => {
            log.error(`can't ping ${hash} on ${config.nodes[i].host}:${config.nodes[i].port}`);
          })
      ));

      if (!_.compact(result).length)
        return {status: 0, hash: hash};

      log.info(`pinned: ${hash}`);

      return {status: 1, hash: hash};

    } catch (err) {
      if (!(err instanceof Promise.TimeoutError) && !(err instanceof Promise.AggregateError))
        log.error(err);

      return {status: 0, hash: hash};
    }

  }, {concurrency: 4});

  let inactiveHashes = _.chain(hashes)
    .flattenDeep()
    .filter(item => [0, 2].includes(item.status))
    .map(item => item.hash)
    .uniq()
    .compact()
    .value();

  let activeHashes = _.chain(hashes)
    .flattenDeep()
    .filter(item => item.status === 1)
    .map(item => item.hash)
    .uniq()
    .compact()
    .value();

  await pinModel.update({
      hash: {
        $in: activeHashes
      }
    },
    {
      $set: {
        fail_tries: 0
      }
    },
    {multi: true}
  );

  await pinModel.update({
      hash: {
        $in: inactiveHashes
      }
    },
    {
      $inc: {
        fail_tries: 1
      }

    },
    {multi: true}
  );

  return {
    activeHashes: activeHashes,
    inactiveHashes: inactiveHashes
  };

};
