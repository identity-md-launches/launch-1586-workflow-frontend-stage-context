import { useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { isHex, type Address, type Hex } from 'viem';
import { erc20Abi } from './config';
import { useDeployment } from './deployment-context';
import { formatAmount, parseAmount } from './format';
import { useReady } from './NetworkBanner';
import { useTokenAllowance } from './reads';
import { AddressLink, Card, Fact, Notice, TxStatus } from './ui';
import { phaseLabel, useTx } from './useTx';

const ZERO = /^0x0{40}$/i;

/** The optional fee hook: deployment status, fee forwarding and fee-token sales. */
export function HookPanel() {
  const dep = useDeployment();
  const { address } = useAccount();
  const { ready, reason } = useReady();
  const d = dep.contracts.SwarmlerHookDeployer;
  const base = useReadContracts({
    contracts: [
      { ...d, functionName: 'hook' },
      { ...d, functionName: 'poolManager' },
      { ...d, functionName: 'owner' },
      { ...d, functionName: 'hookCreationCodeHash' },
    ],
    query: { refetchInterval: 30_000 },
  });
  const hook = base.data?.[0]?.status === 'success' ? (base.data[0].result as Address) : undefined;
  const poolManager = base.data?.[1]?.status === 'success' ? (base.data[1].result as Address) : undefined;
  const deployerOwner = base.data?.[2]?.status === 'success' ? (base.data[2].result as Address) : undefined;
  const codeHash = base.data?.[3]?.status === 'success' ? (base.data[3].result as Hex) : undefined;
  const deployed = hook !== undefined && !ZERO.test(hook);
  const isOwner = Boolean(address && deployerOwner && address.toLowerCase() === deployerOwner.toLowerCase());

  const child = useReadContracts({
    contracts: [
      { address: hook!, abi: dep.feeHookAbi, functionName: 'feeTokenPrice' },
      { address: hook!, abi: dep.feeHookAbi, functionName: 'totalImdForwarded' },
      { address: hook!, abi: dep.feeHookAbi, functionName: 'owner' },
      { address: hook!, abi: dep.feeHookAbi, functionName: 'imd' },
      { address: dep.contracts.LaunchToken.address, abi: erc20Abi, functionName: 'balanceOf', args: [hook!] },
    ],
    query: { enabled: deployed, refetchInterval: 15_000 },
  });
  const c = child.data;
  const feePrice = c?.[0]?.status === 'success' ? (c[0].result as bigint) : undefined;
  const forwarded = c?.[1]?.status === 'success' ? (c[1].result as bigint) : undefined;
  const hookOwner = c?.[2]?.status === 'success' ? (c[2].result as Address) : undefined;
  const imd = c?.[3]?.status === 'success' ? (c[3].result as Address) : undefined;
  const tokenInventory = c?.[4]?.status === 'success' ? (c[4].result as bigint) : undefined;
  const imdHeld = useTokenAllowance(imd, hook);
  const isHookOwner = Boolean(address && hookOwner && address.toLowerCase() === hookOwner.toLowerCase());

  const forward = useTx();
  const [buyText, setBuyText] = useState('');
  const buyAmount = parseAmount(buyText);
  const quote = useReadContracts({
    contracts: [{ address: hook!, abi: dep.feeHookAbi, functionName: 'quoteFeeTokens', args: [buyAmount ?? 0n] }],
    query: { enabled: deployed && buyAmount !== null },
  });
  const cost = quote.data?.[0]?.status === 'success' ? (quote.data[0].result as bigint) : undefined;
  const imdForBuy = useTokenAllowance(imd, hook);
  const needsApproval = cost !== undefined && imdForBuy.allowance !== undefined && imdForBuy.allowance < cost;
  const approve = useTx(() => imdForBuy.refetch());
  const buy = useTx(() => imdForBuy.refetch());

  const [priceText, setPriceText] = useState('');
  const newPrice = parseAmount(priceText);
  const setPrice = useTx();
  const [code, setCode] = useState('');
  const [salt, setSalt] = useState('');
  const deploy = useTx();
  const codeOk = isHex(code.trim()) && code.trim().length > 2;
  const saltOk = /^0x[0-9a-fA-F]{64}$/.test(salt.trim());

  return (
    <Card id="hook" title="Fee hook pool" lead="An optional second pool whose realized LP fees are forwarded to the reward pool. It is separate from the launch pool above.">
      <dl className="facts">
        <Fact label="Status" value={hook === undefined ? '…' : deployed ? 'deployed' : 'not deployed yet'} />
        <Fact label="Hook" value={deployed && hook ? <AddressLink address={hook} /> : 'none'} />
        <Fact label="PoolManager" value={poolManager ? <AddressLink address={poolManager} /> : '…'} />
        {deployed ? <Fact label="IMD forwarded" value={forwarded !== undefined ? `${formatAmount(forwarded)} IMD` : '…'} /> : null}
        {deployed ? <Fact label="IMD held" value={imdHeld.balance !== undefined ? `${formatAmount(imdHeld.balance)} IMD` : '…'} /> : null}
        {deployed ? <Fact label="SWARMLER held" value={tokenInventory !== undefined ? formatAmount(tokenInventory) : '…'} /> : null}
        {deployed ? <Fact label="Ask price" value={feePrice === undefined ? '…' : feePrice === 0n ? 'not set' : `${formatAmount(feePrice)} IMD per SWARMLER`} /> : null}
      </dl>
      {!deployed ? (
        <Notice kind="plain">The owner has not deployed the fee hook. No trading fees reach the reward pool through a hook until that happens.</Notice>
      ) : (
        <>
          <div className="actions">
            <button type="button" disabled={!ready || forward.state.busy || imdHeld.balance === 0n} onClick={() => hook && forward.send({ address: hook, abi: dep.feeHookAbi, functionName: 'forwardFees' })}>
              {phaseLabel(forward.state.phase, 'Forward IMD fees to rewards')}
            </button>
          </div>
          <TxStatus state={forward.state} done="Fees forwarded to the reward pool." />

          <h3>Buy SWARMLER fee inventory for IMD</h3>
          <div className="field">
            <label htmlFor="buy-fee-tokens">SWARMLER amount</label>
            <input id="buy-fee-tokens" type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 10" value={buyText} onChange={(e) => setBuyText(e.target.value)} aria-describedby="buy-hint" />
            <span id="buy-hint" className="hint">
              {feePrice === 0n ? 'The owner has not set an ask price, so sales are closed.' : cost !== undefined ? `Cost: ${formatAmount(cost)} IMD (rounded up). Paid IMD is forwarded to rewards.` : 'Cost is quoted by the hook.'}
            </span>
          </div>
          <div className="actions">
            {needsApproval ? (
              <button type="button" className="primary" disabled={!ready || approve.state.busy || !imd} onClick={() => imd && hook && cost !== undefined && approve.send({ address: imd, abi: erc20Abi, functionName: 'approve', args: [hook, cost] })}>
                {phaseLabel(approve.state.phase, 'Approve IMD')}
              </button>
            ) : (
              <button type="button" className="primary" disabled={!ready || buyAmount === null || cost === undefined || buy.state.busy || feePrice === 0n} onClick={() => hook && buyAmount !== null && cost !== undefined && buy.send({ address: hook, abi: dep.feeHookAbi, functionName: 'buyFeeTokens', args: [buyAmount, cost] })}>
                {phaseLabel(buy.state.phase, 'Buy fee tokens')}
              </button>
            )}
          </div>
          <TxStatus state={approve.state} done="Approval confirmed." />
          <TxStatus state={buy.state} done="Purchased. SWARMLER sent to your wallet." />

          {isHookOwner ? (
            <>
              <h3>Owner: set ask price</h3>
              <div className="field">
                <label htmlFor="fee-price">IMD per SWARMLER</label>
                <input id="fee-price" type="text" inputMode="decimal" autoComplete="off" placeholder="e.g. 0.5" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
              </div>
              <div className="actions">
                <button type="button" disabled={!ready || newPrice === null || setPrice.state.busy} onClick={() => hook && newPrice !== null && setPrice.send({ address: hook, abi: dep.feeHookAbi, functionName: 'setFeeTokenPrice', args: [newPrice] })}>
                  {phaseLabel(setPrice.state.phase, 'Set price')}
                </button>
              </div>
              <TxStatus state={setPrice.state} done="Ask price updated." />
            </>
          ) : null}
        </>
      )}

      {isOwner && !deployed ? (
        <>
          <h3>Owner: deploy the hook</h3>
          <p className="small muted">
            Paste the exact SwarmlerFeeHook creation bytecode from the pinned build (its hash must equal <span className="mono">{codeHash ?? '…'}</span>) and a mined salt whose address passes the permission check.
          </p>
          <div className="field">
            <label htmlFor="hook-code">Creation bytecode (hex)</label>
            <textarea id="hook-code" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} aria-invalid={code.trim() !== '' && !codeOk ? true : undefined} />
          </div>
          <div className="field">
            <label htmlFor="hook-salt">Salt (bytes32)</label>
            <input id="hook-salt" type="text" autoComplete="off" value={salt} onChange={(e) => setSalt(e.target.value)} className="mono" aria-invalid={salt.trim() !== '' && !saltOk ? true : undefined} />
          </div>
          <div className="actions">
            <button type="button" className="primary" disabled={!ready || !codeOk || !saltOk || deploy.state.busy} onClick={() => deploy.send({ ...d, functionName: 'deploy', args: [code.trim() as Hex, salt.trim() as Hex] })}>
              {phaseLabel(deploy.state.phase, 'Deploy hook')}
            </button>
          </div>
          <TxStatus state={deploy.state} done="Hook deployed. Initialise its pool and add liquidity next." />
        </>
      ) : null}
      {!ready && reason && deployed ? <p className="small muted">{reason.replace('to continue', 'to use the hook')}</p> : null}
    </Card>
  );
}
