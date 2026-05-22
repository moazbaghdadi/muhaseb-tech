import { useState } from 'react';
import { useT } from '../i18n/LangProvider';
import { LANGS, type Lang, type MessageKey } from '../i18n/messages';
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '../lib/currency';
import { inputStyle as inputSt } from './styles';
import { useBreakpoint } from '../lib/useBreakpoint';
import wordmark from '../assets/wordmark.png';

type Props = {
  onComplete: (input: {
    currency: CurrencyCode;
    bankOpening: number;
    cashOpening: number;
  }) => void;
};

export function FirstRunModal({ onComplete }: Props) {
  const { t, lang, setLang } = useT();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const [currency, setCurrency] = useState<CurrencyCode | null>(null);
  const [bank, setBank] = useState('');
  const [cash, setCash] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!currency) return;
    const bankOpening = Number(bank.replace(',', '.')) || 0;
    const cashOpening = Number(cash.replace(',', '.')) || 0;
    onComplete({
      currency,
      bankOpening: bankOpening > 0 ? bankOpening : 0,
      cashOpening: cashOpening > 0 ? cashOpening : 0,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-run-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'oklch(0% 0 0 / 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: '#fff',
          borderRadius: 18,
          padding: 24,
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px oklch(0% 0 0 / 0.2)',
        }}
      >
        <div
          role="group"
          aria-label={t('lang.label')}
          style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginBottom: 14 }}
        >
          {LANGS.map((l: Lang) => {
            const active = lang === l;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={active}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1.5px solid',
                  borderColor: active ? 'var(--teal)' : 'var(--border)',
                  background: active ? 'var(--teal)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text)',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                {t(`lang.${l}` as MessageKey)}
              </button>
            );
          })}
        </div>

        <img
          src={wordmark}
          alt=""
          aria-hidden
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 280,
            height: 'auto',
            margin: '0 auto 16px',
          }}
        />
        <h2
          id="first-run-title"
          style={{ fontSize: 22, fontWeight: 700, margin: 0, textAlign: 'center' }}
        >
          {t('firstRun.title')}
        </h2>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-muted)',
            marginTop: 8,
            marginBottom: 22,
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          {t('firstRun.intro')}
        </p>

        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 10,
            color: 'var(--text-muted)',
          }}
        >
          {t('firstRun.field.currency')}
        </p>
        <div
          role="radiogroup"
          aria-label={t('firstRun.field.currency')}
          style={{ display: 'grid', gap: 8, marginBottom: 22 }}
        >
          {CURRENCY_CODES.map((code) => {
            const def = CURRENCIES[code];
            const active = currency === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCurrency(code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1.5px solid',
                  borderColor: active ? 'var(--teal)' : 'var(--border)',
                  background: active ? 'var(--teal-light)' : 'var(--surface)',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  fontSize: 15,
                  textAlign: 'start',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span
                  style={{
                    minWidth: 32,
                    fontSize: 18,
                    fontWeight: 700,
                    color: active ? 'var(--teal)' : 'var(--text)',
                  }}
                >
                  {def.symbol}
                </span>
                <span style={{ flex: 1, fontWeight: active ? 700 : 500 }}>
                  {t(`currency.label.${code}` as MessageKey)}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{code}</span>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <label style={{ display: 'block' }}>
            <span
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                color: 'var(--text-muted)',
              }}
            >
              {t('firstRun.field.bank')}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0"
              style={{ ...inputSt, marginBottom: 0 }}
            />
          </label>
          <label style={{ display: 'block' }}>
            <span
              style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 8,
                color: 'var(--text-muted)',
              }}
            >
              {t('firstRun.field.cash')}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0"
              style={{ ...inputSt, marginBottom: 0 }}
            />
          </label>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, marginBottom: 22 }}>
          {t('firstRun.help.balances')}
        </p>

        <button
          type="submit"
          disabled={!currency}
          style={{
            width: '100%',
            minHeight: 52,
            padding: '14px 20px',
            borderRadius: 12,
            border: 'none',
            background: currency ? 'var(--teal)' : 'var(--border)',
            fontFamily: 'inherit',
            fontSize: 16,
            fontWeight: 700,
            color: '#fff',
            cursor: currency ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          {t('firstRun.cta')}
        </button>
      </form>
    </div>
  );
}
