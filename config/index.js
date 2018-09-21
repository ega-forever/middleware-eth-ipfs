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
  systemRabbit: {
    url: process.env.SYSTEM_RABBIT_URI || process.env.RABBIT_URI || 'amqp://localhost:5672',
    exchange: process.env.SYSTEM_RABBIT_EXCHANGE || 'internal',
    serviceName: process.env.SYSTEM_RABBIT_SERVICE_NAME || 'system' 
  },
  checkSystem: process.env.CHECK_SYSTEM || true,
  schedule: {
    job: process.env.SCHEDULE_JOB || '30 * * * * *'
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
    events: process.env.SM_EVENTS ? _.chain(process.env.SM_EVENTS)
      .split(',')
      .map(i => {
        i = i.split(':');
        return {
          eventName: i[0],
          newHashField: i[1],
          oldHashField: i[2]
        };
      })
      .value() : []
  }

};

module.exports = config;
