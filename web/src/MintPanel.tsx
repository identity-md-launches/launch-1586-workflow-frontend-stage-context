import { useAccount } from 'wagmi';
import { useDeployment } from './deployment-context';
import { formatAmount } from './format';
import { useReady } from './NetworkBanner';
import { useCollectionState, useImdBalance } from './reads';
import { erc20Abi } from './config';
import { Card, Fact, Notice, TxStatus } from './ui';
import { phaseLabel, useTx } from './useTx';

/** The main action: approve exactly the mint price in IMD, then mint. */
export function MintPanel() {
  const dep = useDeployment();
  const { isConnected } = useAccount();
  const { ready, reason } = useReady();
  const s = useCollectionState();
  const bal = useImdBalance();
  const approve = useTx(() => bal.refetch());
  const mint = useTx(() => bal.refetch());

  const price = s.mintPrice;
  const minted = s.totalMinted;
  const max = s.maxSupply;
  const remaining = minted !== undefined && max !== undefined ? max - minted : undefined;
  const soldOut = remaining !== undefined && remaining <= 0n;
  const open = s.publicMintOpen === true;
  const needsApproval = price !== undefined && bal.allowance !== undefined && bal.allowance < price;
  const enough = price !== undefined && bal.balance !== undefined && bal.balance >= price;
  const canAct = ready && open && !soldOut && price !== undefined;

  const collection = dep.contracts.Swarmlers.address;
  const imd = s.imd;

  return (
    <Card id="mint" title="Mint a Swarmler" lead="Pay exactly 0.25 IMD per Swarmler.">
      <dl className="facts">
        <Fact label="Minted" value={minted !== undefined && max !== undefined ? `${minted.toString()} of ${max.toString()}` : '…'} big />
        <Fact label="Price" value={price !== undefined ? `${formatAmount(price)} IMD` : '…'} big />
        {isConnected ? <Fact label="Your IMD" value={bal.balance !== undefined ? `${formatAmount(bal.balance)} IMD` : '…'} /> : null}
        {isConnected ? <Fact label="Approved to collection" value={bal.allowance !== undefined ? `${formatAmount(bal.allowance)} IMD` : '…'} /> : null}
      </dl>

      <div className="actions">
        {needsApproval ? (
          <button
            type="button"
            className="primary"
            disabled={!canAct || approve.state.busy || !imd}
            onClick={() => imd && price !== undefined && approve.send({ address: imd, abi: erc20Abi, functionName: 'approve', args: [collection, price] })}
          >
            {phaseLabel(approve.state.phase, 'Approve 0.25 IMD')}
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            disabled={!canAct || mint.state.busy || (isConnected && (needsApproval || !enough))}
            onClick={() => mint.send({ address: collection, abi: dep.contracts.Swarmlers.abi, functionName: 'mint' })}
          >
            {phaseLabel(mint.state.phase, 'Mint for 0.25 IMD')}
          </button>
        )}
      </div>
      {!isConnected ? <p className="small muted">Connect a wallet to mint.</p> : !ready && reason ? <p className="small muted">{reason}</p> : null}
      {s.error ? <Notice kind="error">Unable to read the collection from the network RPC. Reload or try again later.</Notice> : null}
      {s.publicMintOpen === false ? (
        <Notice kind="warn">
          Public minting is not open yet. The owner opens it after configuring the reporter and reward duration.
        </Notice>
      ) : null}
      {soldOut ? <Notice kind="plain">Every Swarmler has been minted. Buy one from a holder instead.</Notice> : null}

      {ready && open && !enough && bal.balance !== undefined ? (
        <p className="small muted">You need at least 0.25 IMD in this wallet to mint.</p>
      ) : null}
      {ready && needsApproval ? (
        <p className="small muted">Step 1 of 2: approve exactly the mint price to the collection contract. Step 2 mints.</p>
      ) : null}
      <TxStatus state={approve.state} done="Approval confirmed. You can mint now." />
      <TxStatus state={mint.state} done="Minted. Your new Swarmler appears under Your Swarmlers." />
    </Card>
  );
}
