import type { OpeningBalances, Transaction, Screen } from '../types';
import { parseDate } from '../lib/format';
import { bucketBalance, sumByType, totalBalance } from '../lib/balance';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { SectionTitle } from '../components/SectionTitle';
import { StatCard } from '../components/StatCard';
import { TxRow } from '../components/TxRow';
import { IDown, IUp } from '../components/icons';
import { useT } from '../i18n/LangProvider';
import { useBreakpoint } from '../lib/useBreakpoint';

type Props = {
  transactions: Transaction[];
  opening: OpeningBalances;
  setScreen: (s: Screen) => void;
};

export function Dashboard({ transactions, opening, setScreen }: Props) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const { t, fmtMoney, fmtMoneyAbs, fmtMonth } = useT();
  const now = new Date();
  const cm = now.getMonth();
  const cy = now.getFullYear();
  const currentYm = `${cy}-${String(cm + 1).padStart(2, '0')}`;

  const monthly = transactions.filter((t) => {
    const d = parseDate(t.date);
    return d.getMonth() === cm && d.getFullYear() === cy;
  });
  const yearly = transactions.filter((t) => parseDate(t.date).getFullYear() === cy);

  const mI = sumByType(monthly, 'income');
  const mE = sumByType(monthly, 'expense');
  const mN = mI - mE;
  const yI = sumByType(yearly, 'income');
  const yE = sumByType(yearly, 'expense');
  const total = totalBalance(transactions, opening);
  const bankBal = bucketBalance(transactions, 'bank', opening);
  const cashBal = bucketBalance(transactions, 'cash', opening);

  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  const catTotals: Record<string, number> = {};
  yearly
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount;
    });
  const catEntries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxCat = catEntries[0]?.[1] ?? 1;

  return (
    <div>
      <div
        style={{
          background: 'var(--teal)',
          color: '#fff',
          borderRadius: 20,
          padding: isMobile ? '22px 20px' : '32px 32px',
          marginBottom: isMobile ? 18 : 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -40,
            left: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'oklch(100% 0 0 / 0.05)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            bottom: -60,
            right: -20,
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'oklch(100% 0 0 / 0.04)',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>{t('dashboard.balance')}</p>
            <p
              style={{
                fontSize: isMobile ? 38 : 52,
                fontWeight: 700,
                letterSpacing: -1,
              }}
            >
              {fmtMoney(total)}
            </p>
            <div
              style={{
                display: 'flex',
                gap: 24,
                marginTop: 12,
                opacity: 0.85,
                fontSize: 15,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <span style={{ opacity: 0.75 }}>{t('dashboard.bankBalance')}:</span>{' '}
                <strong>{fmtMoney(bankBal)}</strong>
              </span>
              <span>
                <span style={{ opacity: 0.75 }}>{t('dashboard.cashBalance')}:</span>{' '}
                <strong>{fmtMoney(cashBal)}</strong>
              </span>
            </div>
            <p style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>{fmtMonth(currentYm)}</p>
          </div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>
                {t('dashboard.monthIncome')}
              </p>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{fmtMoneyAbs(mI)}</p>
            </div>
            <div style={{ width: 1, height: 44, background: 'oklch(100% 0 0 / 0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>
                {t('dashboard.monthExpense')}
              </p>
              <p style={{ fontSize: 22, fontWeight: 700 }}>{fmtMoneyAbs(mE)}</p>
            </div>
            <div style={{ width: 1, height: 44, background: 'oklch(100% 0 0 / 0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 4 }}>
                {t('dashboard.monthNet')}
              </p>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: mN >= 0 ? '#a8ffce' : '#ffb3a8',
                }}
              >
                {fmtMoney(mN)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? 10 : 14,
          marginBottom: isMobile ? 18 : 24,
        }}
      >
        <StatCard
          label={t('dashboard.monthIncome')}
          value={fmtMoneyAbs(mI)}
          color="var(--green)"
          bg="var(--green-light)"
          icon={<IUp s={18} />}
        />
        <StatCard
          label={t('dashboard.monthExpense')}
          value={fmtMoneyAbs(mE)}
          color="var(--red)"
          bg="var(--red-light)"
          icon={<IDown s={18} />}
        />
        <StatCard
          label={t('dashboard.yearIncome')}
          value={fmtMoneyAbs(yI)}
          color="var(--green)"
          bg="var(--green-light)"
          icon={<IUp s={18} />}
        />
        <StatCard
          label={t('dashboard.yearExpense')}
          value={fmtMoneyAbs(yE)}
          color="var(--red)"
          bg="var(--red-light)"
          icon={<IDown s={18} />}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 340px',
          gap: isMobile ? 14 : 20,
        }}
      >
        <Card>
          <SectionTitle
            action={
              <button
                onClick={() => setScreen('transactions')}
                style={{
                  background: 'var(--teal-light)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--teal)',
                  cursor: 'pointer',
                }}
              >
                {t('dashboard.viewAll')}
              </button>
            }
          >
            {t('dashboard.recent')}
          </SectionTitle>
          {recent.length === 0 ? (
            <EmptyState msg={t('dashboard.emptyTx')} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recent.map((t) => (
                <TxRow key={t.id} t={t} />
              ))}
            </div>
          )}
        </Card>

        <Card style={{ alignSelf: 'start' }}>
          <SectionTitle>{t('dashboard.byCategory')}</SectionTitle>
          {catEntries.length === 0 ? (
            <EmptyState msg={t('dashboard.emptyData')} />
          ) : (
            catEntries.map(([cat, val]) => (
              <div key={cat} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontSize: 14, color: 'var(--red)', fontWeight: 700 }}>
                    {fmtMoneyAbs(val)}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--red-light)', borderRadius: 99 }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 99,
                      background: 'var(--red)',
                      width: (val / maxCat) * 100 + '%',
                      transition: 'width 0.6s ease',
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
