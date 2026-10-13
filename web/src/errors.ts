/** Translate wallet, RPC and contract errors into one plain sentence that says what to do. */
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

const CUSTOM_ERRORS: Record<string, string> = {
  MintClosed: 'Public minting is not open yet. Wait for the owner to open it.',
  SoldOut: 'Every Swarmler has been minted.',
  NotEligible: 'This wallet and identity are not eligible for a free claim right now. Check the eligibility result above.',
  AlreadyClaimed: 'This wallet or identity has already used its free claim.',
  NotHolder: 'Only the current holder of this Swarmler can do that.',
  InexactPayment: 'The IMD received did not match the mint price. Approve exactly 0.25 IMD and try again.',
  NoRewards: 'Nothing to claim for this Swarmler yet.',
  InvalidBatch: 'Use 1 to 100 distinct Swarmler IDs that you hold and that all have rewards.',
  RewardsNotConfigured: 'Rewards are not configured yet. The owner must set the reward duration first.',
  ReporterNotConfigured: 'The activity reporter is not configured yet, so eligibility cannot be verified.',
  InvalidConfiguration: 'The value is outside what the contract accepts.',
  ZeroAmount: 'Enter an amount above zero.',
  OwnableUnauthorizedAccount: 'Only the contract owner can do that.',
  ERC20InsufficientAllowance: 'Approve the amount first, then retry.',
  ERC20InsufficientBalance: 'Not enough balance for this amount.',
  ERC721NonexistentToken: 'That Swarmler ID does not exist.',
  NotIdentityHolder: 'This wallet does not hold that Identity MD.',
  UnauthorizedReporter: 'Only the configured reporter can record activity.',
  InvalidReport: 'The report is invalid: check the timestamp is in the past and not before an earlier record.',
  AlreadyDeployed: 'The fee hook has already been deployed.',
  WrongCreationCode: 'The creation code does not match the pinned hook build.',
  PoolManagerNotDeployed: 'The PoolManager has no code on this chain, so the hook cannot be deployed.',
  DeploymentFailed: 'The CREATE2 deployment failed. Check the salt and retry.',
  PriceNotConfigured: 'The fee-token price is not set yet.',
  SlippageExceeded: 'The price moved past your limit. Raise the limit or try again.',
  WrongPool: 'This hook only serves its own pool.',
  SafeERC20FailedOperation: 'The token transfer failed. Check balance and approval.',
  V4TooLittleReceived: 'The swap would return less than your minimum. Raise slippage or try a smaller amount.',
  DeadlinePassed: 'The swap deadline passed. Try again.',
};

export function describeError(error: unknown): string {
  if (!error) return 'Something failed. Try again.';
  if (error instanceof BaseError) {
    if (error.walk((e) => e instanceof UserRejectedRequestError)) return 'Request cancelled in the wallet.';
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (revert) {
      const name = revert.data?.errorName ?? revert.signature;
      if (name && CUSTOM_ERRORS[name]) return CUSTOM_ERRORS[name];
      if (revert.reason) return revert.reason;
      if (name) return `The contract rejected this call (${name}).`;
    }
    const short = error.shortMessage || error.message;
    for (const [name, text] of Object.entries(CUSTOM_ERRORS)) {
      if (short.includes(name + '(')) return text;
    }
    if (/insufficient funds/i.test(short)) return 'Not enough ETH in the wallet to pay for gas.';
    if (/chain mismatch|does not match the target chain/i.test(short)) return 'Switch the wallet to the configured network and retry.';
    if (/Request Failed|HTTP request failed|fetch failed/i.test(short)) return 'Unable to reach the network RPC. Check your connection and retry.';
    return short;
  }
  const e = error as { code?: number; message?: string };
  if (e.code === 4001) return 'Request cancelled in the wallet.';
  if (typeof e.message === 'string' && e.message) return e.message.split('\n')[0].slice(0, 240);
  return 'Something failed. Try again.';
}
