import { useState } from 'react';
import type { Bucket, Categories, RecurringInput, RecurringRule } from '../types';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { RecurringRuleModal } from '../components/RecurringRuleModal';
import { IDown, IPencil, IPlus, ITrans, ITrash, IUp } from '../components/icons';
import { todayIso } from '../lib/format';
import { nextOccurrence } from '../lib/recurrence';
import { useT } from '../i18n/LangProvider';
import { useBreakpoint } from '../lib/useBreakpoint';
import type { MessageKey } from '../i18n/messages';

const bucketKey = (b: Bucket): MessageKey => (b === 'bank' ? 'bucket.bank' : 'bucket.cash');

type Props = {
  rules: RecurringRule[];
  categories: Categories;
  onAdd: (input: RecurringInput) => void;
  onEdit: (id: string, input: RecurringInput) => void;
  onDelete: (id: string) => void;
};

export function RecurringScreen({ rules, categories, onAdd, onEdit, onDelete }: Props) {
  const { t, tp, fmtMoneyAbs, fmtDate } = useT();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = editingId ? rules.find((r) => r.id === editingId) ?? null : null;

  const sorted = [...rules].sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  return (
    <div>
      <PageHeader
        title={t('recurring.title')}
        subtitle={t('recurring.subtitle')}
        action={
          <button
            onClick={() => setShowAdd(true)}
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
            <IPlus s={20} /> {t('recurring.add')}
          </button>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState msg={t('recurring.empty')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((r) => {
            const isTransfer = r.type === 'transfer';
            const inc = r.type === 'income';
            const accent = isTransfer ? 'var(--teal)' : inc ? 'var(--green)' : 'var(--red)';
            const accentLight = isTransfer
              ? 'var(--teal-light)'
              : inc
                ? 'var(--green-light)'
                : 'var(--red-light)';
            const TypeIcon = isTransfer ? ITrans : inc ? IUp : IDown;
            const title = r.description || (isTransfer ? t('tx.typeTransfer') : r.category);
            const sub = isTransfer && r.toBucket
              ? `${t(bucketKey(r.bucket))} → ${t(bucketKey(r.toBucket))}`
              : `${t(bucketKey(r.bucket))} · ${isTransfer ? t('tx.typeTransfer') : r.category}`;
            const next = nextOccurrence(r.dayOfMonth, todayIso());
            return (
              <Card key={r.id} style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      flexShrink: 0,
                      background: accentLight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: accent,
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
                      {title}
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub}</p>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                      {tp('recurring.everyMonth', { day: String(r.dayOfMonth) })} ·{' '}
                      {tp('recurring.next', { date: fmtDate(next) })}
                    </p>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: isMobile ? 'column' : 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: accent,
                        direction: 'ltr',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtMoneyAbs(r.amount)}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        aria-label={t('recurring.editAria')}
                        onClick={() => setEditingId(r.id)}
                        style={{
                          background: 'var(--teal-light)',
                          border: 'none',
                          borderRadius: 8,
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--teal)',
                        }}
                      >
                        <IPencil s={16} />
                      </button>
                      <button
                        aria-label={t('recurring.deleteAria')}
                        onClick={() => onDelete(r.id)}
                        style={{
                          background: 'var(--red-light)',
                          border: 'none',
                          borderRadius: 8,
                          width: 36,
                          height: 36,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: 'var(--red)',
                        }}
                      >
                        <ITrash s={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {showAdd && (
        <RecurringRuleModal
          categories={categories}
          onSubmit={onAdd}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editing && (
        <RecurringRuleModal
          categories={categories}
          initial={editing}
          onSubmit={(input) => onEdit(editing.id, input)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
