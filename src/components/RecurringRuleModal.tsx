import { useState, type ReactNode } from 'react';
import type { Bucket, Categories, RecurringInput, RecurringRule, TxType } from '../types';
import { todayIso } from '../lib/format';
import { nextOccurrence } from '../lib/recurrence';
import { IClose, IDown, IPlus, ITrans, IUp } from './icons';
import { inputStyle as inputSt } from './styles';
import { useT } from '../i18n/LangProvider';
import { useBreakpoint } from '../lib/useBreakpoint';
import type { MessageKey } from '../i18n/messages';

function FLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-muted)' }}>
      {children}
    </p>
  );
}

const BUCKETS: ReadonlyArray<readonly [Bucket, MessageKey]> = [
  ['bank', 'bucket.bank'],
  ['cash', 'bucket.cash'],
];

function flip(b: Bucket): Bucket {
  return b === 'bank' ? 'cash' : 'bank';
}

type Props = {
  categories: Categories;
  onSubmit: (input: RecurringInput) => void;
  onClose: () => void;
  initial?: RecurringRule;
};

export function RecurringRuleModal({ categories, onSubmit, onClose, initial }: Props) {
  const { t, tp } = useT();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const isEdit = !!initial;
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [bucket, setBucket] = useState<Bucket>(initial?.bucket ?? 'bank');
  const [toBucket, setToBucket] = useState<Bucket>(initial?.toBucket ?? 'cash');
  const [cat, setCat] = useState(initial?.category ?? '');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [day, setDay] = useState(String(initial?.dayOfMonth ?? Number(todayIso().slice(8, 10))));
  const [error, setError] = useState('');

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
    const dayNum = Math.trunc(Number(day));
    if (!day || Number.isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
      return setError(t('modal.error.dayOfMonth'));
    }
    // Editing keeps the original start; a new rule starts at the next due date.
    const startDate = initial ? initial.startDate : nextOccurrence(dayNum, todayIso());
    onSubmit({
      type,
      category: isTransfer ? '' : cat,
      description: desc,
      amount: num,
      bucket,
      ...(isTransfer ? { toBucket } : {}),
      dayOfMonth: dayNum,
      startDate,
    });
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
      aria-labelledby="recrule-title"
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
          <h2 id="recrule-title" style={{ fontSize: 22, fontWeight: 700 }}>
            {t(isEdit ? 'recurring.modal.editTitle' : 'recurring.modal.title')}
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
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}
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
            <BucketSelect value={bucket} onChange={pickFromBucket} accent={accent} accentLight={accentLight} t={t} />
            <FLabel>{t('modal.field.toBucket')}</FLabel>
            <BucketSelect value={toBucket} onChange={pickToBucket} accent={accent} accentLight={accentLight} t={t} />
          </>
        ) : (
          <>
            <FLabel>{t('modal.field.bucket')}</FLabel>
            <BucketSelect value={bucket} onChange={setBucket} accent={accent} accentLight={accentLight} t={t} />

            <FLabel>{t('modal.field.category')}</FLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {cats.length === 0 && (
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('modal.noCategories')}</p>
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
        <input
          aria-label={t('modal.field.descriptionShort')}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('modal.field.descPlaceholder')}
          style={{ ...inputSt }}
        />

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
          style={{ ...inputSt, fontSize: 26, fontWeight: 700, textAlign: 'center', direction: 'ltr' }}
        />

        <FLabel>{t('modal.field.dayOfMonth')}</FLabel>
        <input
          aria-label={t('modal.field.dayOfMonth')}
          value={day}
          onChange={(e) => setDay(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          style={{ ...inputSt, direction: 'ltr', textAlign: 'center' }}
        />
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -12, marginBottom: 20 }}>
          {tp('recurring.everyMonth', { day: String(Math.trunc(Number(day)) || 1) })}
        </p>

        {error && (
          <p role="alert" style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
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
