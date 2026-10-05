'use client';

import { useCallback, useState } from 'react';
import { Link2, Pencil, Copy, ExternalLink, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/hooks/useToast';
import { installmentsApi } from '@/lib/api/payments';
import { copyText } from '@/lib/utils/download';
import { formatCurrency } from '@/lib/utils/format';
import { dueLabel, installmentState, parseDue, withSeconds } from '@/lib/utils/installments';
import { isInstallmentPaid } from '@/types/payment';
import type { InstallmentDTO } from '@/types';

interface Props {
  installment: InstallmentDTO;
  index: number;
  onChanged: () => void;
}

const TONE = {
  paid: { tone: 'success' as const, label: 'Paid' },
  overdue: { tone: 'danger' as const, label: 'Overdue' },
  'due-today': { tone: 'warning' as const, label: 'Due today' },
  upcoming: { tone: 'neutral' as const, label: 'Pending' },
};

/** `yyyy-MM-ddTHH:mm` for datetime-local, from whichever date field exists. */
function toInput(i: InstallmentDTO): string {
  const d = parseDue(i);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function InstallmentRow({ installment: ins, index, onChanged }: Props) {
  const { showToast } = useToast();
  const paid = isInstallmentPaid(ins);
  const state = installmentState(ins);

  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(ins.finalAmount ?? ''));
  const [due, setDue] = useState(toInput(ins));
  const [note, setNote] = useState(ins.adminNotes ?? '');
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const save = useCallback(async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { showToast('Enter a valid amount.', 'error'); return; }
    if (!due) { showToast('Set a due date.', 'error'); return; }
    setBusy(true);
    try {
      await installmentsApi.update(ins.id, {
        finalAmount: amt,
        dueDateTime: withSeconds(due),
        adminNotes: note,
      });
      showToast('Installment updated.', 'success');
      setEditing(false);
      onChanged();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }, [amount, due, note, ins.id, showToast, onChanged]);

  const makeLink = useCallback(async () => {
    setLinkBusy(true);
    try {
      const res = await installmentsApi.paymentLink(ins.id);
      // Backend has used three field names for this over time.
      const url = res?.paymentUrl ?? res?.url ?? res?.checkoutUrl;
      if (!url) throw new Error('No payment URL returned.');
      setLink(url);
      setCopied(false);
      showToast('Payment link generated.', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setLinkBusy(false);
    }
  }, [ins.id, showToast]);

  return (
    <div className={`in-row${paid ? ' paid' : ''}`}>
      <span className="in-n" aria-hidden>{ins.installmentNumber ?? index + 1}</span>

      <div className="in-row-main">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <span className="in-amt">{formatCurrency(ins.finalAmount ?? 0)}</span>
          <Badge tone={TONE[state].tone} dot>{TONE[state].label}</Badge>
          <span style={{ flex: 1 }} />
          {!paid && (
            <>
              <button type="button" className="act" onClick={makeLink} disabled={linkBusy}>
                <Link2 size={12} /> {linkBusy ? 'Generating…' : 'Pay link'}
              </button>
              <button type="button" className="act" onClick={() => setEditing((v) => !v)}
                      aria-expanded={editing}>
                <Pencil size={12} /> {editing ? 'Close' : 'Edit'}
              </button>
            </>
          )}
        </div>

        <div className="t-xs text-dim" style={{ marginTop: 3 }}>
          Due {dueLabel(ins)}
          {ins.adminNotes ? <> · <em>{ins.adminNotes}</em></> : null}
        </div>

        {link && (
          <div className="in-link">
            <span className="in-link-url" title={link}>{link}</span>
            <button type="button" className="act" onClick={async () => {
              const ok = await copyText(link);
              setCopied(ok);
              showToast(ok ? 'Link copied.' : 'Copy failed.', ok ? 'success' : 'error');
            }}>
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <a className="act" href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={11} /> Open
            </a>
          </div>
        )}

        {editing && !paid && (
          <div className="in-edit">
            <div className="in-edit-grid">
              <div className="fl">
                <label htmlFor={`amt-${ins.id}`}>Amount</label>
                <input id={`amt-${ins.id}`} type="number" min="0.01" step="0.01" className="fi"
                       value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} />
              </div>
              <div className="fl">
                <label htmlFor={`due-${ins.id}`}>Due date &amp; time</label>
                <input id={`due-${ins.id}`} type="datetime-local" className="fi"
                       value={due} onChange={(e) => setDue(e.target.value)} disabled={busy} />
              </div>
            </div>
            <div className="fl">
              <label htmlFor={`note-${ins.id}`}>Admin note</label>
              <input id={`note-${ins.id}`} className="fi" value={note}
                     onChange={(e) => setNote(e.target.value)} disabled={busy}
                     placeholder="e.g. Extended per student request" />
            </div>
            <div style={{ display: 'flex', gap: 'var(--s2)' }}>
              <Button variant="primary" size="sm" loading={busy} onClick={save} style={{ flex: 1 }}>
                Save changes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
