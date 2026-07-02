import { useState } from 'react';
import type { Attachment, Bucket, Categories, RecurringInput, Transaction } from '../types';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { TxRow } from '../components/TxRow';
import { AddTxModal, type NewTx } from '../components/AddTxModal';
import { AttachmentsModal } from '../components/AttachmentsModal';
import { IPlus, ISearch } from '../components/icons';
import { inputStyle } from '../components/styles';
import { sumByType } from '../lib/balance';
import { useT } from '../i18n/LangProvider';
import { useBreakpoint } from '../lib/useBreakpoint';
import type { MessageKey } from '../i18n/messages';

type Filter = 'all' | 'income' | 'expense' | 'transfer';
type BucketFilter = 'all' | Bucket;

type Props = {
  transactions: Transaction[];
  categories: Categories;
  onAdd: (tx: NewTx) => void;
  onEdit: (id: string, tx: NewTx) => void;
  onDelete: (id: string) => void;
  onAddRecurring: (input: RecurringInput) => void;
  onAddAttachment: (txId: string, attachment: Attachment) => void;
  onRemoveAttachment: (txId: string, attachmentId: string) => void;
};

export function Transactions({
  transactions,
  categories,
  onAdd,
  onEdit,
  onDelete,
  onAddRecurring,
  onAddAttachment,
  onRemoveAttachment,
}: Props) {
  const { t, fmtMoney, fmtMoneyAbs } = useT();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all');
  const [search, setSearch] = useState('');
  const [attachmentsTxId, setAttachmentsTxId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const attachmentsTx = attachmentsTxId
    ? transactions.find((tx) => tx.id === attachmentsTxId) ?? null
    : null;
  const editingTx = editingTxId
    ? transactions.find((tx) => tx.id === editingTxId) ?? null
    : null;

  const filtered = transactions
    .filter((t) => filter === 'all' || t.type === filter)
    .filter(
      (t) =>
        bucketFilter === 'all' ||
        t.bucket === bucketFilter ||
        t.toBucket === bucketFilter,
    )
    .filter((t) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        !!t.description?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        !!t.invoiceNumber?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const incomeTotal = sumByType(filtered, 'income');
  const expenseTotal = sumByType(filtered, 'expense');
  const net = incomeTotal - expenseTotal;

  return (
    <div>
      <PageHeader
        title={t('tx.title')}
        subtitle={t('tx.subtitle')}
        action={
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--teal)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px oklch(42% 0.11 195 / 0.3)',
            }}
          >
            <IPlus s={20} /> {t('tx.add')}
          </button>
        }
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div
          style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                ['all', 'tx.filterAll'],
                ['income', 'tx.filterIncome'],
                ['expense', 'tx.filterExpense'],
                ['transfer', 'tx.filterTransfer'],
              ] as const satisfies ReadonlyArray<readonly [Filter, MessageKey]>
            ).map(([v, key]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 20,
                  border: '2px solid',
                  borderColor: filter === v ? 'var(--teal)' : 'var(--border)',
                  background: filter === v ? 'var(--teal-light)' : '#fff',
                  color: filter === v ? 'var(--teal)' : 'var(--text-muted)',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {t(key)}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                top: '50%',
                insetInlineStart: 14,
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              <ISearch s={18} />
            </span>
            <input
              aria-label={t('tx.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tx.searchPlaceholder')}
              style={{
                ...inputStyle,
                marginBottom: 0,
                paddingInlineStart: 42,
                paddingTop: 10,
                paddingBottom: 10,
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(
            [
              ['all', 'tx.filterAllBuckets'],
              ['bank', 'tx.filterBank'],
              ['cash', 'tx.filterCash'],
            ] as const satisfies ReadonlyArray<readonly [BucketFilter, MessageKey]>
          ).map(([v, key]) => (
            <button
              key={v}
              onClick={() => setBucketFilter(v)}
              style={{
                padding: '7px 14px',
                borderRadius: 16,
                border: '1.5px solid',
                borderColor: bucketFilter === v ? 'var(--teal)' : 'var(--border)',
                background: bucketFilter === v ? 'var(--teal-light)' : '#fff',
                color: bucketFilter === v ? 'var(--teal)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: isMobile ? 8 : 14,
          marginBottom: isMobile ? 16 : 20,
        }}
      >
        <TotalCard
          label={t('tx.totals.income')}
          value={fmtMoneyAbs(incomeTotal)}
          color="var(--green)"
          bg="var(--green-light)"
          compact={isMobile}
        />
        <TotalCard
          label={t('tx.totals.expense')}
          value={fmtMoneyAbs(expenseTotal)}
          color="var(--red)"
          bg="var(--red-light)"
          compact={isMobile}
        />
        <TotalCard
          label={t('tx.totals.net')}
          value={fmtMoney(net)}
          color={net >= 0 ? 'var(--teal)' : 'var(--red)'}
          bg="var(--teal-light)"
          compact={isMobile}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState msg={t('tx.empty')} />
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((t) => (
            <TxRow
              key={t.id}
              t={t}
              onDelete={onDelete}
              onEdit={setEditingTxId}
              onOpenAttachments={setAttachmentsTxId}
            />
          ))}
        </div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                {(
                  [
                    'tx.col.date',
                    'tx.col.type',
                    'tx.col.bucket',
                    'tx.col.category',
                    'tx.col.description',
                    'tx.col.amount',
                    null,
                  ] as const satisfies ReadonlyArray<MessageKey | null>
                ).map((key, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '14px 16px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textAlign: 'start',
                    }}
                  >
                    {key ? t(key) : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <TxRow
                  key={t.id}
                  t={t}
                  onDelete={onDelete}
                  onEdit={setEditingTxId}
                  onOpenAttachments={setAttachmentsTxId}
                  tableMode
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showModal && (
        <AddTxModal
          categories={categories}
          transactions={transactions}
          onSubmit={onAdd}
          onAddRecurring={onAddRecurring}
          onClose={() => setShowModal(false)}
        />
      )}

      {editingTx && (
        <AddTxModal
          categories={categories}
          transactions={transactions}
          initialTx={editingTx}
          onSubmit={(tx) => onEdit(editingTx.id, tx)}
          onClose={() => setEditingTxId(null)}
        />
      )}

      {attachmentsTx && (
        <AttachmentsModal
          tx={attachmentsTx}
          onAdd={(a) => onAddAttachment(attachmentsTx.id, a)}
          onRemove={(id) => onRemoveAttachment(attachmentsTx.id, id)}
          onClose={() => setAttachmentsTxId(null)}
        />
      )}
    </div>
  );
}

function TotalCard({
  label,
  value,
  color,
  bg,
  compact,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
  compact: boolean;
}) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: 14,
        padding: compact ? '10px 10px' : '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          fontWeight: 600,
          minWidth: 0,
          overflowWrap: 'anywhere',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: compact ? 16 : 20,
          fontWeight: 700,
          color,
          minWidth: 0,
          overflowWrap: 'anywhere',
          direction: 'ltr',
          textAlign: 'start',
        }}
      >
        {value}
      </span>
    </div>
  );
}
