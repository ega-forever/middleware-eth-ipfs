/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const _ = require('lodash'),
  bunyan = require('bunyan'),
  pinModel = require('../models/pinModel'),
  Promise = require('bluebird'),
  config = require('../config'),
  log = bunyan.createLogger({name: 'plugins.ipfs.pinOrRestoreHashService', level: config.logs.level}),
  PREFETCH_LIMIT = 100,
  TIMEOUT_DELAY = 5000;

/**
 * @function
 * @description the function for pinning the saved hashes (ethPins collection) on predefined IPFS instances
 * @param ipfsStack - prepared IPFS instances
 * @return {Promise<void>}
 */
module.exports = async (ipfsStack) => {

  const query = {
    $or: [
      {fail_tries: {$lte: 100}},
      {fail_tries: null}
    ]
  };

  let recordsCount = await pinModel.count(query);

  await Promise.mapSeries(_.range(0, recordsCount, PREFETCH_LIMIT), async startIndex => {


    const pins = await pinModel.find(query).skip(startIndex).limit(PREFETCH_LIMIT);

    await Promise.map(pins, async (pin) => {

      pin.fail_tries = 0;

      let data = await Promise.all(ipfsStack.map(async (ipfs, index) => {
        let payload = await Promise.resolve(ipfs.object.data(pin.hash)).timeout(TIMEOUT_DELAY).catch(() => null);
        return payload ? {payload, index} : null;
      }));

      data = _.compact(data);

      if (!data.length && !pin.payload) {
        pin.fail_tries = (pin.fail_tries || 0) + 1;
        log.error(`can't pin ${pin.hash} record`);
      }

      if (!pin.payload)
        pin.payload = data[0].payload;

      const outdatedIPFSNodes = [];

      for (let i = 0; i < ipfsStack.length; i++)
        if (!_.find(data, {index: i}))
          outdatedIPFSNodes.push(ipfsStack[i]);

      await Promise.map(outdatedIPFSNodes, async ipfs =>
        await Promise.resolve(ipfs.object.put({Data: pin.payload, Links: []})).timeout(TIMEOUT_DELAY).catch((e) => console.log(e))
      );


      log.info(`pinned ${pin.hash} record`);

      await pin.save();
    }, {concurrency: 4});

  });

};
