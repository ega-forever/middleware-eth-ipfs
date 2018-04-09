/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Egor Zuev <zyev.egor@gmail.com>
 */

/**
 * Chronobank/eth-ipfs configuration
 * @module config
 * @returns {Object} Configuration
 */

const _ = require('lodash'),
  path = require('path'),
  url = require('url');
require('dotenv').config();

const config = {
  mongo: {
    data: {
      uri: process.env.MONGO_DATA_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/data',
      collectionPrefix: process.env.MONGO_DATA_COLLECTION_PREFIX || process.env.MONGO_COLLECTION_PREFIX || 'eth'
    }
  },
  schedule: {
    job: process.env.SCHEDULE_JOB || '30 * * * * *'
  },
  web3: {
    network: process.env.NETWORK || 'development',
    uri: `${/^win/.test(process.platform) ? '\\\\.\\pipe\\' : ''}${process.env.WEB3_URI || `/tmp/${(process.env.NETWORK || 'development')}/geth.ipc`}`
  },
  nodes: process.env.IPFS_NODES ? _.chain(process.env.IPFS_NODES)
    .split(',')
    .map(i => {
      i = url.parse(i.trim());
      return {host: i.hostname, port: i.port, protocol: i.protocol.replace(':', '')};
    })
    .value() :
    [{'host': 'localhost', 'port': '5001', 'protocol': 'http'}],
  smartContracts: {
    path: process.env.SMART_CONTRACTS_PATH || path.join(__dirname, '../node_modules/chronobank-smart-contracts/build/contracts'),
    events: {
      ttl: parseInt(process.env.SMART_CONTRACTS_EVENTS_TTL) || false
    }
  },
  events: process.env.SM_EVENTS ? _.chain(process.env.SM_EVENTS)
    .split(',')
    .map(i => {
      i = i.split(':');
      return {
        eventName: i[0].toLowerCase(),
        newHashField: i[1],
        oldHashField: i[2]
      };
    })
    .value() : []


};

module.exports = config;
