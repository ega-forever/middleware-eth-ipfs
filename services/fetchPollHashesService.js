/**
 * Ping IPFS by specified time in config
 * @module services/scheduleService
 * @see module:config
 */

const bytes32toBase58 = require('../utils/bytes32toBase58');
module.exports = async (contracts) => {


  let VotingManagerInstance = await contracts.VotingManager.deployed();

  let pollsCount = (await VotingManagerInstance.getPollsCount()).toString();
  let activePolls = await VotingManagerInstance.getPollsPaginated(0, pollsCount);

  let hashes = (await VotingManagerInstance.getPollsDetails(activePolls))[1];

  return hashes.map(hash=> bytes32toBase58(hash));

};
