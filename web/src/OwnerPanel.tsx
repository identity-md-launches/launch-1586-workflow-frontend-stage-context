import { useState } from 'react';
import { useAccount } from 'wagmi';
import { getAddress, isAddress } from 'viem';
import { useDeployment } from './deployment-context';
import { formatDuration } from './format';
import { useReady } from './NetworkBanner';
import { useCollectionState } from './reads';
import { Card, Notice, TxStatus } from './ui';
import { phaseLabel, useTx } from './useTx';

/**
 * Shown only to the connected owner (or pending owner) of the collection or the activity registry.
 * One control per post-launch setting.
 */
export function OwnerPanel() {
  const dep = useDeployment();
  const { address } = useAccount();
  const { ready } = useReady();
  const s = useCollectionState();
  const me = address?.toLowerCase();
  const ownsCollection = Boolean(me && s.owner && s.owner.toLowerCase() === me);
  const ownsActivity = Boolean(me && s.activityOwner && s.activityOwner.toLowerCase() === me);
  const pendingCollection = Boolean(me && s.pendingOwner && s.pendingOwner.toLowerCase() === me);
  const pendingActivity = Boolean(me && s.activityPendingOwner && s.activityPendingOwner.toLowerCase() === me);

  const [reporterText, setReporterText] = useState('');
  const [daysText, setDaysText] = useState('');
  const setReporter = useTx();
  const setDuration = useTx();
  const openMint = useTx();
  const acceptC = useTx();
  const acceptA = useTx();

  if (!ownsCollection && !ownsActivity && !pendingCollection && !pendingActivity) return null;

  const reporterOk = isAddress(reporterText.trim(), { strict: false });
  const days = /^\d+$/.test(daysText.trim()) ? Number(daysText.trim()) : null;
  const daysOk = days !== null && days >= 1 && days <= 3650;

  return (
    <Card id="owner" title="Owner setup" lead="These settings are still unset after launch. Each is a single owner transaction.">
      {pendingCollection ? (
        <div className="actions">
          <button type="button" className="primary" disabled={!ready || acceptC.state.busy} onClick={() => acceptC.send({ ...dep.contracts.Swarmlers, functionName: 'acceptOwnership' })}>
            {phaseLabel(acceptC.state.phase, 'Accept collection ownership')}
          </button>
          <TxStatus state={acceptC.state} done="You now own the collection." />
        </div>
      ) : null}
      {pendingActivity ? (
        <div className="actions">
          <button type="button" className="primary" disabled={!ready || acceptA.state.busy} onClick={() => acceptA.send({ ...dep.contracts.SwarmlerActivity, functionName: 'acceptOwnership' })}>
            {phaseLabel(acceptA.state.phase, 'Accept registry ownership')}
          </button>
          <TxStatus state={acceptA.state} done="You now own the activity registry." />
        </div>
      ) : null}

      {ownsActivity ? (
        <>
          <h3>1. Activity reporter</h3>
          <p className="small muted">Currently {s.reporterSet ? <span className="mono">{s.reporter}</span> : 'unset'}. Supply the real verified-activity service's address; it alone can record activity.</p>
          <div className="field">
            <label htmlFor="reporter">Reporter address</label>
            <input id="reporter" type="text" autoComplete="off" className="mono" placeholder="0x…" value={reporterText} onChange={(e) => setReporterText(e.target.value)} aria-invalid={reporterText.trim() !== '' && !reporterOk ? true : undefined} />
          </div>
          <div className="actions">
            <button type="button" className="primary" disabled={!ready || !reporterOk || setReporter.state.busy} onClick={() => setReporter.send({ ...dep.contracts.SwarmlerActivity, functionName: 'setReporter', args: [getAddress(reporterText.trim())] })}>
              {phaseLabel(setReporter.state.phase, 'Set reporter')}
            </button>
          </div>
          <TxStatus state={setReporter.state} done="Reporter configured." />
        </>
      ) : null}

      {ownsCollection ? (
        <>
          <h3>2. Reward duration (once)</h3>
          <p className="small muted">Currently {s.rewardDuration === undefined ? '…' : s.rewardDuration === 0n ? 'unset' : formatDuration(s.rewardDuration)}. The time a funded Swarmler needs to reach its 1 IMD cap. 1 to 3,650 days; it cannot be changed later.</p>
          <div className="field">
            <label htmlFor="duration-days">Duration in days</label>
            <input id="duration-days" type="text" inputMode="numeric" autoComplete="off" placeholder="e.g. 365" value={daysText} onChange={(e) => setDaysText(e.target.value)} aria-invalid={daysText.trim() !== '' && !daysOk ? true : undefined} />
          </div>
          <div className="actions">
            <button type="button" className="primary" disabled={!ready || !daysOk || setDuration.state.busy || (s.rewardDuration !== undefined && s.rewardDuration !== 0n)} onClick={() => days !== null && setDuration.send({ ...dep.contracts.Swarmlers, functionName: 'setRewardDuration', args: [BigInt(days) * 86_400n] })}>
              {phaseLabel(setDuration.state.phase, 'Set reward duration')}
            </button>
          </div>
          <TxStatus state={setDuration.state} done="Reward duration set." />

          <h3>3. Open public minting (once)</h3>
          {s.publicMintOpen ? <Notice kind="ok">Public minting is open.</Notice> : (
            <>
              {!s.reporterSet || s.rewardDuration === 0n ? <Notice kind="warn">Requires the reporter and the reward duration to be set first.</Notice> : null}
              <div className="actions">
                <button type="button" className="primary" disabled={!ready || !s.reporterSet || s.rewardDuration === 0n || openMint.state.busy} onClick={() => openMint.send({ ...dep.contracts.Swarmlers, functionName: 'openPublicMint' })}>
                  {phaseLabel(openMint.state.phase, 'Open public mint')}
                </button>
              </div>
              <TxStatus state={openMint.state} done="Public minting is open." />
            </>
          )}
        </>
      ) : null}
    </Card>
  );
}
