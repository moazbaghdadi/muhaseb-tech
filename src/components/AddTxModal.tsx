import { useMemo, useState, type ReactNode } from 'react';
import type {
  Attachment,
  Bucket,
  Categories,
  RecurringInput,
  Transaction,
  TxType,
} from '../types';
import { todayIso } from '../lib/format';
import { IClose, IDown, IPlus, IRepeat, ITrans, IUp } from './icons';
import { inputStyle as inputSt } from './styles';
import { useT } from '../i18n/LangProvider';
import { useBreakpoint } from '../lib/useBreakpoint';
import { AttachmentsList } from './AttachmentsList';
import type { MessageKey } from '../i18n/messages';

function FLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
      {children}
    </p>
  );
}

export type NewTx = {
  type: TxType;
  category: string;
  description: string;
  amount: number;
  date: string;
  attachments: Attachment[];
  bucket: Bucket;
  toBucket?: Bucket;
};

type Props = {
  categories: Categories;
  onSubmit: (tx: NewTx) => void;
  onClose: () => void;
  initialTx?: Transaction;
  transactions?: Transaction[];
  // When provided (add mode only), the "repeat every month" toggle is shown and
  // a checked submit creates a recurring rule instead of a one-off transaction.
  onAddRecurring?: (input: RecurringInput) => void;
};

const BUCKETS: ReadonlyArray<readonly [Bucket, MessageKey]> = [
  ['bank', 'bucket.bank'],
  ['cash', 'bucket.cash'],
];

function flip(b: Bucket): Bucket {
  return b === 'bank' ? 'cash' : 'bank';
}

export function AddTxModal({
  categories,
  onSubmit,
  onClose,
  initialTx,
  transactions,
  onAddRecurring,
}: Props) {
  const { t, tp } = useT();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isEdit = !!initialTx;
  const canRecur = !isEdit && !!onAddRecurring;
  const [recurring, setRecurring] = useState(false);
  const [type, setType] = useState<TxType>(initialTx?.type ?? 'income');
  const [bucket, setBucket] = useState<Bucket>(initialTx?.bucket ?? 'bank');
  const [toBucket, setToBucket] = useState<Bucket>(initialTx?.toBucket ?? 'cash');
  const [cat, setCat] = useState(initialTx?.category ?? '');
  const [desc, setDesc] = useState(initialTx?.description ?? '');
  const [amount, setAmount] = useState(initialTx ? String(initialTx.amount) : '');
  const [date, setDate] = useState(initialTx?.date ?? todayIso());
  const [attachments, setAttachments] = useState<Attachment[]>(initialTx?.attachments ?? []);
  const [error, setError] = useState('');
  const [descFocused, setDescFocused] = useState(false);

  const pastDescriptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const sorted = [...(transactions ?? [])].sort((a, b) => b.date.localeCompare(a.date));
    for (const tx of sorted) {
      const d = tx.description?.trim();
      if (!d) continue;
      const key = d.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
    return out;
  }, [transactions]);

  const suggestions = useMemo(() => {
    const q = desc.trim().toLowerCase();
    if (!q) return [];
    return pastDescriptions
      .filter((d) => {
        const dl = d.toLowerCase();
        return dl.includes(q) && dl !== q;
      })
      .slice(0, 5);
  }, [desc, pastDescriptions]);

  const isTransfer = type === 'transfer';
  const cats = type === 'income' ? categories.income : type === 'expense' ? categories.expense : [];

  function pickFromBucket(next: Bucket) {
    setBucket(next);
    if (next === toBucket) setToBucket(flip(next));
  }
  function pickToBucket(next: Bucket) {
    setToBucket(next);
    if (next === bucket) setBucket(flip(next));
  }

  function handleSubmit() {
    if (!isTransfer && !cat) return setError(t('modal.error.pickCategory'));
    const num = Number(amount);
    if (!amount || Number.isNaN(num) || num <= 0) return setError(t('modal.error.amount'));
    if (canRecur && recurring && onAddRecurring) {
      onAddRecurring({
        type,
        category: isTransfer ? '' : cat,
        description: desc,
        amount: num,
        bucket,
        ...(isTransfer ? { toBucket } : {}),
        dayOfMonth: Number(date.slice(8, 10)),
        startDate: date,
      });
      onClose();
      return;
    }
    const tx: NewTx = {
      type,
      category: isTransfer ? '' : cat,
      description: desc,
      amount: num,
      date,
      attachments,
      bucket,
      ...(isTransfer ? { toBucket } : {}),
    };
    onSubmit(tx);
    onClose();
  }

  const accent =
    type === 'income' ? 'var(--green)' : type === 'expense' ? 'var(--red)' : 'var(--teal)';
  const accentLight =
    type === 'income'
      ? 'var(--green-light)'
      : type === 'expense'
        ? 'var(--red-light)'
        : 'var(--teal-light)';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="addtx-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'oklch(0% 0 0 / 0.45)',
        display: 'flex',
        alignItems: isMobile ? 'flex-end' : 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: isMobile ? '20px 20px 0 0' : 20,
          width: '100%',
          maxWidth: isMobile ? '100%' : 520,
          padding: isMobile
            ? '20px 18px calc(20px + env(safe-area-inset-bottom)) 18px'
            : '28px 24px 32px',
          maxHeight: isMobile ? '92vh' : '90vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px oklch(0% 0 0 / 0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <h2 id="addtx-title" style={{ fontSize: 22, fontWeight: 700 }}>
            {t(isEdit ? 'modal.tx.editTitle' : 'modal.tx.title')}
          </h2>
          <button
            aria-label={t('modal.close')}
            onClick={onClose}
            style={{
              background: 'var(--border)',
              border: 'none',
              borderRadius: 10,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <IClose />
          </button>
        </div>

        <FLabel>{t('modal.field.type')}</FLabel>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            marginBottom: 20,
          }}
        >
          {(
            [
              ['income', t('tx.typeIncome'), <IUp key="up" s={18} />, 'var(--green)', 'var(--green-light)'],
              ['expense', t('tx.typeExpense'), <IDown key="down" s={18} />, 'var(--red)', 'var(--red-light)'],
              ['transfer', t('tx.typeTransfer'), <ITrans key="trans" s={18} />, 'var(--teal)', 'var(--teal-light)'],
            ] as const
          ).map(([v, l, ico, c, lc]) => (
            <button
              key={v}
              onClick={() => {
                setType(v);
                setCat('');
                setError('');
              }}
              style={{
                padding: '14px 8px',
                borderRadius: 12,
                border: '2px solid',
                borderColor: type === v ? c : 'var(--border)',
                background: type === v ? lc : '#fff',
                color: type === v ? c : 'var(--text-muted)',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {ico} {l}
            </button>
          ))}
        </div>

        {isTransfer ? (
          <>
            <FLabel>{t('modal.field.fromBucket')}</FLabel>
            <BucketSelect
              value={bucket}
              onChange={pickFromBucket}
              accent={accent}
              accentLight={accentLight}
              t={t}
            />
            <FLabel>{t('modal.field.toBucket')}</FLabel>
            <BucketSelect
              value={toBucket}
              onChange={pickToBucket}
              accent={accent}
              accentLight={accentLight}
              t={t}
            />
          </>
        ) : (
          <>
            <FLabel>{t('modal.field.bucket')}</FLabel>
            <BucketSelect
              value={bucket}
              onChange={setBucket}
              accent={accent}
              accentLight={accentLight}
              t={t}
            />

            <FLabel>{t('modal.field.category')}</FLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {cats.length === 0 && (
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  {t('modal.noCategories')}
                </p>
              )}
              {cats.map((c) => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '2px solid',
                    borderColor: cat === c ? 'var(--teal)' : 'var(--border)',
                    background: cat === c ? 'var(--teal-light)' : '#fff',
                    color: cat === c ? 'var(--teal)' : 'var(--text)',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}

        <FLabel>{t('modal.field.description')}</FLabel>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input
            aria-label={t('modal.field.descriptionShort')}
            aria-autocomplete="list"
            aria-expanded={descFocused && suggestions.length > 0}
            role="combobox"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onFocus={() => setDescFocused(true)}
            onBlur={() => setDescFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && descFocused && suggestions.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                setDescFocused(false);
              }
            }}
            placeholder={t('modal.field.descPlaceholder')}
            style={{ ...inputSt, marginBottom: 0 }}
          />
          {descFocused && suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label={t('modal.field.descSuggestions')}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                insetInlineStart: 0,
                insetInlineEnd: 0,
                background: '#fff',
                border: '1.5px solid var(--border)',
                borderRadius: 12,
                boxShadow: '0 8px 24px oklch(0% 0 0 / 0.12)',
                zIndex: 10,
                margin: 0,
                padding: 4,
                listStyle: 'none',
                maxHeight: 240,
                overflowY: 'auto',
              }}
            >
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setDesc(s);
                      setDescFocused(false);
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--teal-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      textAlign: 'start',
                      fontSize: 15,
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FLabel>{t('modal.field.amount')}</FLabel>
        <input
          aria-label={t('modal.field.amountShort')}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          type="number"
          inputMode="decimal"
          min={0}
          placeholder="0.00"
          style={{
            ...inputSt,
            fontSize: 26,
            fontWeight: 700,
            textAlign: 'center',
            direction: 'ltr',
          }}
        />

        <FLabel>{t('modal.field.date')}</FLabel>
        <input
          aria-label={t('modal.field.date')}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          type="date"
          style={{ ...inputSt, direction: 'ltr', textAlign: 'start' }}
        />

        {canRecur && (
          <div style={{ marginBottom: 20 }}>
            <button
              type="button"
              role="checkbox"
              aria-checked={recurring}
              onClick={() => setRecurring((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '2px solid',
                borderColor: recurring ? 'var(--teal)' : 'var(--border)',
                background: recurring ? 'var(--teal-light)' : '#fff',
                cursor: 'pointer',
                textAlign: 'start',
              }}
            >
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  border: '2px solid',
                  borderColor: recurring ? 'var(--teal)' : 'var(--text-muted)',
                  background: recurring ? 'var(--teal)' : '#fff',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                {recurring ? '✓' : ''}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 16,
                  fontWeight: 700,
                  color: recurring ? 'var(--teal)' : 'var(--text)',
                }}
              >
                <IRepeat s={18} /> {t('modal.field.recurring')}
              </span>
            </button>
            {recurring && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                {tp('modal.recurring.hint', { day: String(Number(date.slice(8, 10))) })}
              </p>
            )}
          </div>
        )}

        {!recurring && (
          <>
            <FLabel>{t('modal.field.attachments')}</FLabel>
            <AttachmentsList
              attachments={attachments}
              onAdd={(a) => setAttachments((prev) => [...prev, a])}
              onRemove={(id) => setAttachments((prev) => prev.filter((a) => a.id !== id))}
            />
          </>
        )}

        {error && (
          <p
            role="alert"
            style={{
              color: 'var(--red)',
              fontSize: 14,
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: 14,
            border: 'none',
            background: accent,
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {isEdit ? null : <IPlus s={20} />} {t(isEdit ? 'modal.editSave' : 'modal.save')}
        </button>
      </div>
    </div>
  );
}

function BucketSelect({
  value,
  onChange,
  accent,
  accentLight,
  t,
}: {
  value: Bucket;
  onChange: (b: Bucket) => void;
  accent: string;
  accentLight: string;
  t: (k: MessageKey) => string;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 20,
      }}
    >
      {BUCKETS.map(([v, key]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: '12px',
            borderRadius: 12,
            border: '2px solid',
            borderColor: value === v ? accent : 'var(--border)',
            background: value === v ? accentLight : '#fff',
            color: value === v ? accent : 'var(--text-muted)',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}
