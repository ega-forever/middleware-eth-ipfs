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
  contracts = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
    dirname: config.smartContracts.path,
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/,
  }),
  eventModels = eventsModelsBuilder(contracts),
  ctx = {};

describe('core/ipfs', function () {

  before(async () => {
    mongoose.Promise = Promise;
    mongoose.connect(config.mongo.data.uri, {useMongoClient: true});

    ctx.events = _.chain(eventModels)
      .toPairs()
      .transform((result, pair) => {
        let confEvent = _.find(config.smartContracts.events, ev => ev.eventName.toLowerCase() === pair[0].toLowerCase());
        if (confEvent)
          result.push(_.merge({
            model: pair[1],
          }, confEvent));
      }, [])
      .value();

  });

  after(() => {
    return mongoose.disconnect();
  });

  const default_delay = moment(
    new Date(parser.parseExpression(config.schedule.job).next().toString())
  ).add(300, 'seconds').diff(new Date());

  it('add 100 new records to ipfs', async () => {

    let objs = _.chain(new Array(100))
      .map(() => ({
          Data: new Buffer(generateRandomString()),
          Links: []
        })
      )
      .value();

    const ipfs = ipfsAPI(config.nodes[0]);

    let results = await Promise.mapSeries(objs, rec =>
        ipfs.object.put(rec),
      {concurrency: 20}
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
      (new ctx.events[0].model({
        [ctx.events[0].newHashField]: base58tobytes32(hash),
        controlIndexHash: base58tobytes32(hash)
      })).save()
    );

    let size = _.chain(data).map(data => data._id).compact().size().value();
    expect(size).to.equal(ctx.hashes.length);

  });

  it('validate hashes in mongo', async () => {
    ctx.pins = await ctx.events[0].model.find({
      [ctx.events[0].newHashField]: {$in: ctx.hashes}
    });

    expect(ctx.hashes.length).to.equal(ctx.hashes.length);

  });


  it('validate ping result of daemon', async () => {
    await Promise.delay(default_delay);
    const ipfs = ipfsAPI(config.nodes[1]);
    await Promise.mapSeries(ctx.hashes, async hash => ipfs.object.stat(hash));
  }).timeout(default_delay * 2);


});
