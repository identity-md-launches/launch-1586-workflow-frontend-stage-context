import { useState } from 'react';
import { erc20Abi } from './config';
import { useDeployment } from './deployment-context';
import { formatAmount, formatDuration, parseAmount } from './format';
import { useReady } from './NetworkBanner';
import { useCollectionState, useImdBalance, useRewardState } from './reads';
import { Card, Fact, Notice, TxStatus } from './ui';
import { phaseLabel, useTx } from './useTx';

/** Reward pool status plus the permissionless maintenance calls. */
export function RewardsPanel() {
  const dep = useDeployment();
  const { ready, reason } = useReady();
  const s = useCollectionState();
  const r = useRewardState();
  const bal = useImdBalance();
  const c = dep.contracts.Swarmlers;
  const [amountText, setAmountText] = useState('');
  const amount = parseAmount(amountText);
  const approve = useTx(() => bal.refetch());
  const deposit = useTx(() => bal.refetch());
  const sync = useTx();
  const withdraw = useTx();
  const checkpoint = useTx();
  const needsApproval = amount !== null && bal.allowance !== undefined && bal.allowance < amount;

  return (
    <Card id="rewards" title="Reward pool" lead="90% of mint proceeds and deposits fund holder rewards; 10% is credited to the creator. Capacity is capped at 2,500 IMD for the collection's lifetime.">
      <dl className="facts">
        <Fact label="Funded reserve" value={r.previewReserve !== undefined ? `${formatAmount(r.previewReserve)} IMD` : '…'} big />
        <Fact label="Remaining capacity" value={r.remainingCapacity !== undefined ? `${formatAmount(r.remainingCapacity, 18, 2)} IMD` : '…'} big />
        <Fact label="Allocated to holders" value={r.totalAllocated !== undefined ? `${formatAmount(r.totalAllocated)} IMD` : '…'} />
        <Fact label="Paid out" value={r.totalClaimed !== undefined ? `${formatAmount(r.totalClaimed)} IMD` : '…'} />
        <Fact label="Total proceeds" value={r.totalProceeds !== undefined ? `${formatAmount(r.totalProceeds)} IMD` : '…'} />
        <Fact label="Creator credit" value={r.creatorCredit !== undefined ? `${formatAmount(r.creatorCredit)} IMD` : '…'} />
        <Fact label="Reward duration" value={s.rewardDuration === undefined ? '…' : s.rewardDuration === 0n ? 'not set' : formatDuration(s.rewardDuration)} />
        <Fact label="Cap per Swarmler" value={s.lifetimeCap !== undefined ? `${formatAmount(s.lifetimeCap)} IMD` : '…'} />
      </dl>
      <Notice kind="plain">
        Trading fees from the launch pool go to its fixed beneficiaries, not to this reward pool, unless the payer claims them and deposits here. A separate fee hook pool, once deployed, forwards its IMD fees here.
      </Notice>

      <h3>Deposit IMD into rewards</h3>
      <div className="field">
        <label htmlFor="deposit-amount">Amount in IMD</label>
        <input id="deposit-amount" type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 100" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-invalid={amountText.trim() !== '' && amount === null ? true : undefined} aria-describedby="deposit-hint" />
        <span id="deposit-hint" className="hint">Anyone can fund rewards. The deposit is split 90% rewards, 10% creator. Your balance: {bal.balance !== undefined ? `${formatAmount(bal.balance)} IMD` : 'connect to see'}.</span>
      </div>
      <div className="actions">
        {needsApproval ? (
          <button type="button" className="primary" disabled={!ready || approve.state.busy || !s.imd} onClick={() => s.imd && amount !== null && approve.send({ address: s.imd, abi: erc20Abi, functionName: 'approve', args: [c.address, amount] })}>
            {phaseLabel(approve.state.phase, 'Approve IMD')}
          </button>
        ) : (
          <button type="button" className="primary" disabled={!ready || amount === null || deposit.state.busy || (bal.balance !== undefined && amount !== null && bal.balance < amount)} onClick={() => amount !== null && deposit.send({ ...c, functionName: 'depositProceeds', args: [amount] })}>
            {phaseLabel(deposit.state.phase, 'Deposit')}
          </button>
        )}
      </div>
      {!ready && reason ? <p className="small muted">{reason.replace('to continue', 'to deposit')}</p> : null}
      <TxStatus state={approve.state} done="Approval confirmed. You can deposit now." />
      <TxStatus state={deposit.state} done="Deposit recorded and split." />

      <h3>Maintenance (anyone can run)</h3>
      <div className="actions">
        <button type="button" disabled={!ready || checkpoint.state.busy} onClick={() => checkpoint.send({ ...c, functionName: 'checkpoint' })}>
          {phaseLabel(checkpoint.state.phase, 'Checkpoint rewards')}
        </button>
        <button type="button" disabled={!ready || sync.state.busy} onClick={() => sync.send({ ...c, functionName: 'syncProceeds' })}>
          {phaseLabel(sync.state.phase, 'Sync unsolicited IMD')}
        </button>
        <button type="button" disabled={!ready || withdraw.state.busy || r.creatorCredit === 0n} onClick={() => withdraw.send({ ...c, functionName: 'withdrawCreator' })}>
          {phaseLabel(withdraw.state.phase, 'Pay creator credit')}
        </button>
      </div>
      <p className="small muted">Checkpoint materialises elapsed accrual and retires capped cohorts. Sync recognises IMD sent directly to the contract. Creator credit always goes to the fixed creator wallet.</p>
      <TxStatus state={checkpoint.state} done="Checkpoint recorded." />
      <TxStatus state={sync.state} done="Unsolicited IMD recognised." />
      <TxStatus state={withdraw.state} done="Creator credit paid." />
    </Card>
  );
}
