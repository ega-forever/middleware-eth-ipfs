/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

require('dotenv/config');
process.env.LOG_LEVEL = 'error';

const config = require('../config'),
  //fuzzTests = require('./fuzz'),
  //performanceTests = require('./performance'),
  featuresTests = require('./features'),
  //blockTests = require('./blocks'),
  fs = require('fs-extra'),
  path = require('path'),
  Promise = require('bluebird'),
  ipfsAPI = require('ipfs-api'),
  IPFS = require('ipfs/src/http'),
  _ = require('lodash'),
  mongoose = require('mongoose'),
  ctx = {};

mongoose.Promise = Promise;
mongoose.connect(config.mongo.data.uri, {useMongoClient: true});

describe('plugins/ipfs', function () {

  before(async () => {

    const dbTmpPath = path.join(__dirname, 'tmp');

    if (!fs.existsSync(dbTmpPath))
      fs.mkdirSync(dbTmpPath);

    ctx.nodes = await Promise.map(config.nodes, async (node, index) => {

      const ipfsDbPath = path.join(dbTmpPath, `ipfs_${index}`);
      await fs.remove(ipfsDbPath);

      let instance = new IPFS(ipfsDbPath, {
        Addresses: {
          API: `/ip4/127.0.0.1/tcp/${node.port}`,
          Swarm: [],
          Gateway: `/ip4/127.0.0.1/tcp/909${index}`
        }
      });

      return await new Promise(res => {
        instance.start(true, () => res(instance.node));
      });
    });

    await Promise.delay(5000);

    ctx.clients = config.nodes.map(node => ipfsAPI(node));

  });

  after(async () => {
    mongoose.disconnect();
  });


  //describe('block', () => blockTests(ctx));

  //describe('performance', () => performanceTests(ctx));

  //describe('fuzz', () => fuzzTests(ctx));

  describe('features', () => featuresTests(ctx));

});
