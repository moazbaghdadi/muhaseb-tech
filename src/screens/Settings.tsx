import { useEffect, useState } from 'react';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { inputStyle } from '../components/styles';
import { useT } from '../i18n/LangProvider';
import { LANGS, type Lang, type MessageKey } from '../i18n/messages';
import { CURRENCIES, CURRENCY_CODES, type CurrencyCode } from '../lib/currency';
import type { OpeningBalances } from '../types';

type Props = {
  currency: CurrencyCode;
  onSetCurrency: (code: CurrencyCode) => void;
  opening: OpeningBalances;
  onSetOpening: (bank: number, cash: number) => void;
};

const parseAmount = (s: string): number => Number(s.trim().replace(',', '.')) || 0;

export function SettingsScreen({ currency, onSetCurrency, opening, onSetOpening }: Props) {
  const { t, lang, setLang } = useT();

  // Inputs are seeded from the stored opening balances and re-synced whenever
  // those change (e.g. after saving, or an undo/redo elsewhere).
  const [bank, setBank] = useState(String(opening.bank));
  const [cash, setCash] = useState(String(opening.cash));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setBank(String(opening.bank));
    setCash(String(opening.cash));
  }, [opening.bank, opening.cash]);

  const parsedBank = parseAmount(bank);
  const parsedCash = parseAmount(cash);
  const dirty = parsedBank !== opening.bank || parsedCash !== opening.cash;

  function saveOpening() {
    onSetOpening(parsedBank, parsedCash);
    setSaved(true);
  }

  return (
    <div>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
      <Card>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 14,
          }}
        >
          {t('settings.section.language')}
        </h2>
        <div
          role="group"
          aria-label={t('settings.section.language')}
          style={{ display: 'grid', gap: 8 }}
        >
          {LANGS.map((l: Lang) => {
            const active = lang === l;
            return (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={active}
                style={{
                  minHeight: 52,
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: '1.5px solid',
                  borderColor: active ? 'var(--teal)' : 'var(--border)',
                  background: active ? 'var(--teal)' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--text)',
                  fontSize: 15,
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t(`lang.${l}` as MessageKey)}
              </button>
            );
          })}
        </div>
      </Card>
      <div style={{ height: 18 }} />
      <Card>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 14,
          }}
        >
          {t('settings.section.currency')}
        </h2>
        <div
          role="radiogroup"
          aria-label={t('settings.section.currency')}
          style={{ display: 'grid', gap: 8 }}
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
                onClick={() => onSetCurrency(code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  minHeight: 52,
                  padding: '10px 16px',
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
      </Card>
      <div style={{ height: 18 }} />
      <Card>
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          {t('settings.section.opening')}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          {t('settings.opening.help')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
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
              {t('settings.opening.bank')}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={bank}
              onChange={(e) => {
                setBank(e.target.value);
                setSaved(false);
              }}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0"
              style={{ ...inputStyle, marginBottom: 0 }}
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
              {t('settings.opening.cash')}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={cash}
              onChange={(e) => {
                setCash(e.target.value);
                setSaved(false);
              }}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0"
              style={{ ...inputStyle, marginBottom: 0 }}
            />
          </label>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 16,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={saveOpening}
            disabled={!dirty}
            style={{
              minHeight: 48,
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              background: dirty ? 'var(--teal)' : 'var(--border)',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              cursor: dirty ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {t('settings.opening.save')}
          </button>
          {saved && !dirty && (
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>
              {t('settings.opening.saved')}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
