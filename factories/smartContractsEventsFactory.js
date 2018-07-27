const _ = require('lodash'),
  contract = require('truffle-contract'),
  requireAll = require('require-all'),
  config = require('../config'),
  path = require('path'),
  fs = require('fs');

let contractsRaw = {};
let contractsPath = path.join(__dirname, '../node_modules', 'chronobank-smart-contracts/build/contracts');

if (fs.existsSync(contractsPath))
  contractsRaw = requireAll({ //scan dir for all smartContracts, excluding emitters (except ChronoBankPlatformEmitter) and interfaces
    dirname: contractsPath,
    filter: /(^((ChronoBankPlatformEmitter)|(?!(Emitter|Interface)).)*)\.json$/
  });

const multiEventHistoryAddress = _.get(contractsRaw, `${config.smartContracts.eventContract}.networks.${config.smartContracts.networkId}.address`);

let truffleContractEvents = _.chain(contractsRaw)
  .toPairs()
  .map(pair => contract(pair[1]).events)
  .transform((result, ev) => _.merge(result, ev), {})
  .toPairs()
  .map(pair => {
    let event = pair[1];
    event.signature = pair[0];
    return event;
  })
  .value();


let rawContractEvents = _.chain(contractsRaw)
  .map(contract =>
    _.chain(contract.networks)
      .values()
      .map(network => network.events)
      .flattenDeep()
      .values()
      .transform((result, item) => _.merge(result, item), {})
      .toPairs()
      .map(pair => {
        pair[1].signature = pair[0];
        return pair[1];
      })
      .value()
  )
  .flattenDeep()
  .value();


module.exports = {
  events: _.chain(truffleContractEvents)
    .union(rawContractEvents)
    .uniqBy('signature')
    .value(),
  address: multiEventHistoryAddress
};
