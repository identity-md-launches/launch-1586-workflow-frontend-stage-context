import { useEffect, useState } from 'react';
import { useAccount, useConfig, useReadContracts } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';
import { formatUnits, type Address } from 'viem';
import { DEFAULT_SLIPPAGE_BPS, erc20Abi, PERMIT2_EXPIRATION_SECONDS, permit2Abi, quoterAbi, stateViewAbi, SWAP_DEADLINE_SECONDS, universalRouterAbi } from './config';
import { useDeployment } from './deployment-context';
import { describeError } from './errors';
import { formatAmount, parseAmount } from './format';
import { useReady } from './NetworkBanner';
import { applySlippage, buildExecuteArgs, inputCurrency, isNative, poolId } from './swap';
import { AddressLink, Card, Fact, Notice, TxStatus } from './ui';
import { phaseLabel, useTx } from './useTx';

type Side = 'buy' | 'sell';

/** Trade SWARMLER against its paired currency in the launch's Uniswap v4 pool. */
export function SwapPanel() {
  const dep = useDeployment();
  const config = useConfig();
  const { address } = useAccount();
  const { ready, reason } = useReady();
  const net = dep.network;
  const key = dep.poolKey;
  const token = dep.contracts.LaunchToken.address;
  const [side, setSide] = useState<Side>('buy');
  const [amountText, setAmountText] = useState('');
  const [slippageText, setSlippageText] = useState((DEFAULT_SLIPPAGE_BPS / 100).toString());
  const [quote, setQuote] = useState<{ amountIn: bigint; amountOut: bigint } | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const u = net?.uniswapV4;
  const tokenIsCurrency0 = key ? key.currency0.toLowerCase() === token.toLowerCase() : false;
  const paired: Address | undefined = key ? (tokenIsCurrency0 ? key.currency1 : key.currency0) : undefined;
  const pairedNative = paired ? isNative(paired) : false;
  const pairedMeta = paired && net
    ? [net.pairToken, ...(net.otherPairTokens ?? [])].find((t) => t && t.address.toLowerCase() === paired.toLowerCase())
    : undefined;
  const pairedSymbol = pairedNative ? net?.nativeCurrency.symbol ?? 'ETH' : pairedMeta?.symbol ?? 'paired token';
  const pairedDecimals = pairedNative ? 18 : pairedMeta?.decimals ?? 18;
  // Buying SWARMLER spends the paired currency: zeroForOne is true when the input is currency0.
  const zeroForOne = key ? (side === 'buy' ? !tokenIsCurrency0 : tokenIsCurrency0) : true;
  const inAddr = key ? inputCurrency({ poolKey: key, zeroForOne }) : undefined;
  const inDecimals = side === 'buy' ? pairedDecimals : 18;
  const outDecimals = side === 'buy' ? 18 : pairedDecimals;
  const inSymbol = side === 'buy' ? pairedSymbol : 'SWARMLER';
  const outSymbol = side === 'buy' ? 'SWARMLER' : pairedSymbol;
  const amountIn = parseAmount(amountText, inDecimals);
  const slippageBps = Math.round((Number(slippageText) || 0) * 100);
  const inputIsNative = inAddr ? isNative(inAddr) : false;

  const reads = useReadContracts({
    contracts: [
      { address: inAddr!, abi: erc20Abi, functionName: 'balanceOf', args: [address!] },
      { address: inAddr!, abi: erc20Abi, functionName: 'allowance', args: [address!, u?.permit2!] },
      { address: u?.permit2!, abi: permit2Abi, functionName: 'allowance', args: [address!, inAddr!, u?.universalRouter!] },
      { address: u?.stateView!, abi: stateViewAbi, functionName: 'getSlot0', args: [key ? poolId(key) : '0x'] },
      { address: u?.stateView!, abi: stateViewAbi, functionName: 'getLiquidity', args: [key ? poolId(key) : '0x'] },
    ],
    query: { enabled: Boolean(address && inAddr && u && key && !inputIsNative), refetchInterval: 12_000 },
  });
  const r = reads.data;
  const balance = r?.[0]?.status === 'success' ? (r[0].result as bigint) : undefined;
  const erc20Allowance = r?.[1]?.status === 'success' ? (r[1].result as bigint) : undefined;
  const p2 = r?.[2]?.status === 'success' ? (r[2].result as readonly [bigint, number, number]) : undefined;
  const slot0 = r?.[3]?.status === 'success' ? (r[3].result as readonly [bigint, number, number, number]) : undefined;
  const liquidity = r?.[4]?.status === 'success' ? (r[4].result as bigint) : undefined;
  const nowSec = Math.floor(Date.now() / 1000);
  const permit2Ok = p2 !== undefined && amountIn !== null && p2[0] >= amountIn && p2[1] > nowSec;
  const erc20Ok = erc20Allowance !== undefined && amountIn !== null && erc20Allowance >= amountIn;

  // Quote through the quoter with simulateContract (never a transaction).
  useEffect(() => {
    if (!key || !u || amountIn === null) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    let cancelled = false;
    setQuoting(true);
    const client = getPublicClient(config, { chainId: config.chains[0].id });
    client
      ?.simulateContract({
        address: u.quoter,
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: '0x' }],
      })
      .then((res) => {
        if (cancelled) return;
        setQuote({ amountIn, amountOut: res.result[0] });
        setQuoteError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(describeError(e));
      })
      .finally(() => !cancelled && setQuoting(false));
    return () => {
      cancelled = true;
    };
  }, [amountIn, config, key, u, zeroForOne]);

  const approveToken = useTx(() => reads.refetch());
  const approvePermit2 = useTx(() => reads.refetch());
  const swap = useTx(() => {
    reads.refetch();
    setAmountText('');
  });

  if (!key || !u || !net) {
    return (
      <Card id="swap" title="Trade SWARMLER" lead="The ERC-20 launch token, distinct from the NFTs.">
        <Notice kind="warn">Swaps are disabled: this chain's Uniswap addresses or the launch pool key were not supplied with the deployment, so the site cannot route a trade safely.</Notice>
      </Card>
    );
  }

  const minOut = quote ? applySlippage(quote.amountOut, slippageBps) : null;
  const price = quote && quote.amountIn > 0n
    ? Number(formatUnits(quote.amountOut, outDecimals)) / Number(formatUnits(quote.amountIn, inDecimals))
    : null;
  const canSwap = ready && amountIn !== null && minOut !== null && !quoteError && (inputIsNative || (erc20Ok && permit2Ok)) && (balance === undefined || balance >= amountIn);

  const doSwap = () => {
    if (amountIn === null || minOut === null) return;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + SWAP_DEADLINE_SECONDS);
    const args = buildExecuteArgs({ poolKey: key, zeroForOne, amountIn, amountOutMinimum: minOut, extendedParams: u.extendedSwapParams === true }, deadline);
    swap.send({ address: u.universalRouter, abi: universalRouterAbi, functionName: 'execute', args: [args.commands, args.inputs, args.deadline], value: inputIsNative ? amountIn : 0n });
  };

  return (
    <Card id="swap" title="Trade SWARMLER" lead={`Swap ${pairedSymbol} and SWARMLER, the ERC-20 launch token (not the NFT), in the launch's Uniswap v4 pool.`}>
      <dl className="facts">
        <Fact label="Pool" value={`Swarmler token paired with ${pairedSymbol}, fee ${(key.fee / 10_000).toFixed(2)}%`} />
        <Fact label="Liquidity" value={liquidity === undefined ? (address ? '…' : 'connect to read') : liquidity === 0n ? 'none' : 'available'} />
        <Fact label="Hook" value={isNative(key.hooks) ? 'none' : <AddressLink address={key.hooks} />} />
        <Fact label="Pool tick" value={slot0 ? slot0[1].toString() : address ? '…' : 'connect to read'} />
      </dl>

      <div className="row" role="group" aria-label="Direction">
        <button type="button" aria-pressed={side === 'buy'} className={side === 'buy' ? 'primary' : undefined} onClick={() => { setSide('buy'); setAmountText(''); }}>
          Buy SWARMLER
        </button>
        <button type="button" aria-pressed={side === 'sell'} className={side === 'sell' ? 'primary' : undefined} onClick={() => { setSide('sell'); setAmountText(''); }}>
          Sell SWARMLER
        </button>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="swap-amount">You pay ({inSymbol})</label>
          <input id="swap-amount" type="text" inputMode="decimal" autoComplete="off" placeholder="0.0" value={amountText} onChange={(e) => setAmountText(e.target.value)} aria-invalid={amountText.trim() !== '' && amountIn === null ? true : undefined} aria-describedby="swap-balance" />
          <span id="swap-balance" className="hint">Balance: {balance !== undefined ? `${formatAmount(balance, inDecimals)} ${inSymbol}` : address ? '…' : 'connect to see'}</span>
        </div>
        <div className="field">
          <label htmlFor="swap-slippage">Max slippage (%)</label>
          <input id="swap-slippage" type="text" inputMode="decimal" autoComplete="off" value={slippageText} onChange={(e) => setSlippageText(e.target.value)} aria-describedby="slippage-hint" />
          <span id="slippage-hint" className="hint">The swap reverts if you would receive less than the quote minus this.</span>
        </div>
      </div>

      <div className="status" role="status" aria-live="polite">
        {quoting ? <span>Fetching a quote…</span> : null}
        {!quoting && quote ? (
          <>
            <span>You receive about <strong>{formatAmount(quote.amountOut, outDecimals)} {outSymbol}</strong>, at least {minOut !== null ? formatAmount(minOut, outDecimals) : '…'} {outSymbol} after slippage.</span>
            {price !== null ? <span className="small">1 {inSymbol} ≈ {price.toLocaleString(undefined, { maximumSignificantDigits: 6 })} {outSymbol}. USD value is not shown: the site reads no price feed.</span> : null}
          </>
        ) : null}
        {!quoting && quoteError ? <span className="muted">No quote: {quoteError}</span> : null}
        {!quoting && !quote && !quoteError ? <span className="muted">Enter an amount to get a quote.</span> : null}
      </div>

      <div className="actions">
        {!inputIsNative && amountIn !== null && !erc20Ok ? (
          <button type="button" className="primary" disabled={!ready || approveToken.state.busy} onClick={() => inAddr && approveToken.send({ address: inAddr, abi: erc20Abi, functionName: 'approve', args: [u.permit2, amountIn] })}>
            {phaseLabel(approveToken.state.phase, `Step 1: approve ${inSymbol} to Permit2`)}
          </button>
        ) : !inputIsNative && amountIn !== null && !permit2Ok ? (
          <button type="button" className="primary" disabled={!ready || approvePermit2.state.busy} onClick={() => inAddr && approvePermit2.send({ address: u.permit2, abi: permit2Abi, functionName: 'approve', args: [inAddr, u.universalRouter, amountIn, BigInt(nowSec + PERMIT2_EXPIRATION_SECONDS)] })}>
            {phaseLabel(approvePermit2.state.phase, 'Step 2: allow the router via Permit2')}
          </button>
        ) : (
          <button type="button" className="primary" disabled={!canSwap || swap.state.busy} onClick={doSwap}>
            {phaseLabel(swap.state.phase, side === 'buy' ? 'Buy SWARMLER' : 'Sell SWARMLER')}
          </button>
        )}
      </div>
      {!ready && reason ? <p className="small muted">{reason.replace('to continue', 'to trade')}</p> : null}
      {ready && balance !== undefined && amountIn !== null && balance < amountIn ? <p className="small muted">Not enough {inSymbol} for this amount.</p> : null}
      <p className="small muted">
        Swaps go through the Universal Router at <AddressLink address={u.universalRouter} /> and are simulated before the wallet is asked to sign.
      </p>
      <TxStatus state={approveToken.state} done="Token approved to Permit2." />
      <TxStatus state={approvePermit2.state} done="Router allowed through Permit2." />
      <TxStatus state={swap.state} done="Swap confirmed." />
    </Card>
  );
}
