/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');

const config = require('../config'),
  expect = require('chai').expect,
  generateRandomString = require('./helpers/generateRandomString'),
  ipfsAPI = require('ipfs-api'),
  eventsModelsBuilder = require('../utils/eventsModelsBuilder'),
  _ = require('lodash'),
  requireAll = require('require-all'),
  Promise = require('bluebird'),
  moment = require('moment'),
  parser = require('cron-parser'),
  base58tobytes32 = require('../utils/base58toBytes32'),
  mongoose = require('mongoose'),
  contract = require('truffle-contract'),
  contracts = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
    dirname: config.smartContracts.path,
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
    resolve: Contract => contract(Contract)
  }),
  eventModels = eventsModelsBuilder(contracts),
  ctx = {};

describe('plugins/ipfs', function () {

  before(async () => {
    mongoose.Promise = Promise;
    mongoose.connect(config.mongo.data.uri, {useMongoClient: true});
  });

  after(() => {
    return mongoose.disconnect();
  });

  const default_delay = moment(
    new Date(parser.parseExpression(config.schedule.job).next().toString())
  ).add(120, 'seconds').diff(new Date());

  it('add 10 new records to ipfs', async () => {

    let objs = _.chain(new Array(10))
      .map(() => ({
          Data: new Buffer(generateRandomString()),
          Links: []
        })
      )
      .value();

    const ipfs = ipfsAPI(config.nodes[0]);

    let results = await Promise.mapSeries(objs, rec =>
        ipfs.object.put(rec),
      {concurrency: 5}
    );

    ctx.hashes = _.chain(results)
      .flattenDeep()
      .map(r => r.toJSON().multihash)
      .uniq()
      .value();

  });

  it('add hashes to mongo', async () => {
    await Promise.delay(10000);
    let data = await Promise.mapSeries(ctx.hashes, hash =>
      (new eventModels.sethash({
        newHash: base58tobytes32(hash),
        controlIndexHash: base58tobytes32(hash)
      })).save()
    );

    let size = _.chain(data).map(data => data._id).compact().size().value();
    expect(size).to.equal(ctx.hashes.length);

  });


  it('validate hashes in mongo', async () => {
    ctx.pins = await eventModels.sethash.find({
      newHash: {$in: ctx.hashes}
    });

    expect(ctx.hashes.length).to.equal(ctx.hashes.length);
  });

  it('validate ping result of daemon', async () => {
    await Promise.delay(default_delay);
    const ipfs = ipfsAPI(config.nodes[1]);
    await Promise.mapSeries(ctx.hashes, async hash => ipfs.object.stat(hash));
  }).timeout(default_delay * 2);


});
