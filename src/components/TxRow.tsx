import type { CSSProperties } from 'react';
import type { Bucket, Transaction } from '../types';
import { IDown, IPaperclip, IPencil, ITrans, ITrash, IUp } from './icons';
import { useT } from '../i18n/LangProvider';
import { useBreakpoint } from '../lib/useBreakpoint';
import { attachmentsSupported } from '../lib/attachments';
import type { MessageKey } from '../i18n/messages';

const bucketKey = (b: Bucket): MessageKey => (b === 'bank' ? 'bucket.bank' : 'bucket.cash');

const tdS: CSSProperties = {
  padding: '14px 16px',
  fontSize: 14,
  verticalAlign: 'middle',
  color: 'var(--text)',
};

type Props = {
  t: Transaction;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onOpenAttachments?: (id: string) => void;
  tableMode?: boolean;
};

export function TxRow({ t, onDelete, onEdit, onOpenAttachments, tableMode }: Props) {
  const { t: tr, fmtMoneyAbs, fmtDate } = useT();
  const bp = useBreakpoint();
  const compact = bp === 'mobile' && !tableMode;
  const isTransfer = t.type === 'transfer';
  const inc = t.type === 'income';
  const dayStr = fmtDate(t.date);
  const sign = isTransfer ? '' : inc ? '+' : '-';
  const typeLabel = isTransfer
    ? tr('tx.typeTransfer')
    : tr(inc ? 'tx.typeIncome' : 'tx.typeExpense');
  const bucketLabel = tr(bucketKey(t.bucket));
  const bucketCellText = isTransfer && t.toBucket
    ? `${tr(bucketKey(t.bucket))} → ${tr(bucketKey(t.toBucket))}`
    : bucketLabel;
  const amountColor = isTransfer ? 'var(--teal)' : inc ? 'var(--green)' : 'var(--red)';
  const badgeBg = isTransfer ? 'var(--teal-light)' : inc ? 'var(--green-light)' : 'var(--red-light)';
  const badgeColor = amountColor;
  const TypeIcon = isTransfer ? ITrans : inc ? IUp : IDown;
  const deleteAria = tr('tx.deleteAria');
  const editAria = tr('tx.editAria');
  const attCount = t.attachments.length;
  const showPaperclip = onOpenAttachments && (attCount > 0 || attachmentsSupported());
  const paperclipAria =
    attCount > 0 ? `${tr('tx.attachments.aria')} (${attCount})` : tr('tx.attachments.aria');
  const paperclip = showPaperclip ? (
    <button
      aria-label={paperclipAria}
      onClick={() => onOpenAttachments(t.id)}
      style={{
        background: attCount > 0 ? 'var(--teal-light)' : 'transparent',
        border: attCount > 0 ? 'none' : '1px solid var(--border)',
        borderRadius: 8,
        minWidth: 34,
        height: 34,
        padding: '0 8px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        cursor: 'pointer',
        color: attCount > 0 ? 'var(--teal)' : 'var(--text-muted)',
        fontWeight: 700,
        fontSize: 13,
        fontFamily: 'inherit',
      }}
    >
      <IPaperclip s={16} />
      {attCount > 0 && <span>{attCount}</span>}
    </button>
  ) : null;
  const editButton = onEdit ? (
    <button
      aria-label={editAria}
      onClick={() => onEdit(t.id)}
      style={{
        background: 'var(--teal-light)',
        border: 'none',
        borderRadius: 8,
        width: 34,
        height: 34,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--teal)',
      }}
    >
      <IPencil s={16} />
    </button>
  ) : null;

  if (tableMode) {
    return (
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={tdS}>{dayStr}</td>
        <td style={tdS}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              background: badgeBg,
              color: badgeColor,
            }}
          >
            <TypeIcon s={14} /> {typeLabel}
          </span>
        </td>
        <td style={{ ...tdS, direction: 'ltr', textAlign: 'start' }}>{bucketCellText}</td>
        <td style={tdS}>{isTransfer ? '—' : t.category}</td>
        <td style={tdS}>{t.description || '—'}</td>
        <td
          style={{
            ...tdS,
            fontWeight: 700,
            color: amountColor,
            direction: 'ltr',
            textAlign: 'right',
          }}
        >
          {sign}
          {fmtMoneyAbs(t.amount)}
        </td>
        <td style={{ ...tdS, textAlign: 'center', whiteSpace: 'nowrap' }}>
          {paperclip}
          {editButton && (
            <span style={{ marginInlineStart: paperclip ? 6 : 0 }}>{editButton}</span>
          )}
          {onDelete && (
            <button
              aria-label={deleteAria}
              onClick={() => onDelete(t.id)}
              style={{
                background: 'var(--red-light)',
                border: 'none',
                borderRadius: 8,
                width: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--red)',
                marginInlineStart: paperclip || editButton ? 6 : 0,
              }}
            >
              <ITrash s={16} />
            </button>
          )}
        </td>
      </tr>
    );
  }

  const trashButton = onDelete ? (
    <button
      aria-label={deleteAria}
      onClick={() => onDelete(t.id)}
      style={{
        background: 'var(--red-light)',
        border: 'none',
        borderRadius: 8,
        width: compact ? 34 : 36,
        height: compact ? 34 : 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--red)',
        flexShrink: 0,
      }}
    >
      <ITrash s={compact ? 16 : 20} />
    </button>
  ) : null;

  if (compact) {
    return (
      <div
        style={{
          background: '#fff',
          border: '1.5px solid var(--border)',
          borderRadius: 14,
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            flexShrink: 0,
            background: badgeBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: amountColor,
            marginTop: 2,
          }}
        >
          <TypeIcon s={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.3,
              overflowWrap: 'anywhere',
            }}
          >
            {t.description || (isTransfer ? typeLabel : t.category)}
          </p>
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--text-muted)',
              lineHeight: 1.3,
              overflowWrap: 'anywhere',
            }}
          >
            {bucketCellText} · {isTransfer ? typeLabel : t.category} · {dayStr}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 17,
                fontWeight: 700,
                color: amountColor,
                direction: 'ltr',
                overflowWrap: 'anywhere',
              }}
            >
              {sign}
              {fmtMoneyAbs(t.amount)}
            </span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {paperclip}
              {editButton}
              {trashButton}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff',
        border: '1.5px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          flexShrink: 0,
          background: badgeBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: amountColor,
        }}
      >
        <TypeIcon s={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {t.description || (isTransfer ? typeLabel : t.category)}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {bucketCellText} · {isTransfer ? typeLabel : t.category} · {dayStr}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: amountColor,
            direction: 'ltr',
          }}
        >
          {sign}
          {fmtMoneyAbs(t.amount)}
        </span>
        {paperclip}
        {editButton}
        {trashButton}
      </div>
    </div>
  );
}
