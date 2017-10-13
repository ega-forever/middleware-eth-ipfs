require('dotenv/config');

const config = require('../config'),
  expect = require('chai').expect,
  generateRandomString = require('./helpers/generateRandomString'),
  ipfsAPI = require('ipfs-api'),
  pinModel = require('../models/pinModel'),
  _ = require('lodash'),
  Promise = require('bluebird'),
  moment = require('moment'),
  parser = require('cron-parser'),
  mongoose = require('mongoose'),
  ctx = {};

describe('core/ipfs', function () {

  before(async () => {
    mongoose.Promise = Promise;
    mongoose.connect(config.mongo.uri, {useMongoClient: true});
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

    const ipfs_stack = config.nodes.map(node => ipfsAPI(node));

    let results = await Promise.all(ipfs_stack.map(async function (ipfs) {
      return await Promise.mapSeries(objs, rec =>
        ipfs.object.put(rec),
        {concurrency: 20}
      )
    }));

    ctx.hashes = _.chain(results)
      .flattenDeep()
      .map(r => r.toJSON().multihash)
      .uniq()
      .value()

  });

  it('add hashes to mongo', async () => {
    await Promise.delay(10000);

    let data = await Promise.mapSeries(ctx.hashes, h =>
      (new pinModel({
        hash: h
      })).save()
    );

    let size = _.chain(data).map(data => data._id).compact().size().value();
    expect(size).to.equal(ctx.hashes.length);

  });

  it('validate hashes in mongo', async () => {
    ctx.pins = await pinModel.find({
      hash: {$in: ctx.hashes}
    });

    expect(ctx.pins.length).to.equal(ctx.hashes.length);

  });

  it('validate ping result of daemon', async () => {
    await Promise.delay(default_delay);

    let result = await pinModel.find({
      hash: {$in: ctx.hashes}
    });

    let size = _.chain(result)
      .reject(r =>
        _.isEqual(r.created, r.updated)
      )
      .size()
      .value();

    expect(size).to.equal(ctx.hashes.length);

  }).timeout(default_delay * 2);

});
