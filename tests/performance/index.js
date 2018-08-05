/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

const _ = require('lodash'),
  config = require('../../config'),
  Promise = require('bluebird'),
  uniqid = require('uniqid'),
  smartContractsEventsFactory = require('../../factories/smartContractsEventsFactory'),
  txLogModel = require('../../models/txLogModel'),
  pinModel = require('../../models/pinModel'),
  base58toBytes32 = require('../../utils/encode/base58toBytes32'),
  fetchHashesService = require('../../services/fetchHashesService'),
  pinOrRestoreHashService = require('../../services/pinOrRestoreHashService'),
  expect = require('chai').expect;

module.exports = (ctx) => {

  before(async () => {
    await txLogModel.remove({});
    await pinModel.remove({});
  });


  it('generate fake events', async () => {

    let generated = [];

    for (let event of config.events) {
      let definition = _.find(smartContractsEventsFactory.events, definition => {
        let name = definition.name.toLowerCase();
        return !!_.find(config.events, ev => ev.eventName === name);
      });

      for (let i = 0; i < 1000; i++) {

        const builtArgs = ['0x0'];
        const sortedInputs = _.orderBy(definition.inputs, 'indexed', 'desc');
        const newHashInputIndex = _.findIndex(sortedInputs, {name: event.newHashField});

        for (let inputIndex = 0; inputIndex < sortedInputs.length; inputIndex++) {
          let val = '0x0';

          if (sortedInputs[inputIndex].name === event.newHashField) {

            let ipfsData = {
              Data: new Buffer(Math.random().toString(36).substr(2)),
              Links: []
            };

            let pushResult = await ctx.clients[0].object.put(ipfsData);
            val = base58toBytes32(pushResult.toJSON().multihash);
          }

          if (sortedInputs[inputIndex].name === event.oldHashField && _.random(0, 1) && generated.length > 0) {
            val = generated[_.random(0, generated.length - 1)].args[newHashInputIndex + 1];
          }

          builtArgs.push(val)
        }

        const dataIndexStart = _.findIndex(definition.inputs, {indexed: false});
        generated.push({
          _id: uniqid(),
          address: smartContractsEventsFactory.address,
          args: builtArgs,
          blockNumber: generated.length,
          dataIndexStart: dataIndexStart,
          index: generated.length,
          removed: false,
          signature: definition.signature,
          txIndex: generated.length
        })
      }
    }

    for (let item of generated)
      await txLogModel.create(item);
  });


  it('validate fetchHashesService function', async () => {

    let start = Date.now();

    await Promise.mapSeries(config.events, async event => {
      let definition = _.find(smartContractsEventsFactory.events, ev => ev.name.toLowerCase() === event.eventName);
      if (!definition)
        return [];

      return await fetchHashesService(event.eventName, event.newHashField, event.oldHashField);
    });
    expect(Date.now() - start).to.be.below(10000 * config.events.length * config.nodes.length);
  });


  it('validate pinOrRestoreHashService function', async () => {
    let start = Date.now();
    await pinOrRestoreHashService(ctx.clients);
    expect(Date.now() - start).to.be.below(5000 * 6000 * config.events.length);
  });


};
