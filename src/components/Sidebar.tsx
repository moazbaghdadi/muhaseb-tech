import type { Screen } from '../types';
import { MOBILE_HIDDEN_SCREENS, NAV_ITEMS } from './nav-items';
import { useT } from '../i18n/LangProvider';
import { useBreakpoint } from '../lib/useBreakpoint';
import logoMark from '../assets/logo-mark.png';

type Props = {
  screen: Screen;
  setScreen: (s: Screen) => void;
};

export function Sidebar({ screen, setScreen }: Props) {
  const bp = useBreakpoint();
  if (bp === 'mobile') return <BottomNav screen={screen} setScreen={setScreen} />;
  return <SideColumn screen={screen} setScreen={setScreen} />;
}

function SideColumn({ screen, setScreen }: Props) {
  const { t } = useT();

  return (
    <aside
      style={{
        width: 'var(--sidebar-w-lg)',
        background: 'var(--teal-dark)',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 24px',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '28px 20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid oklch(100% 0 0 / 0.1)',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            flexShrink: 0,
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={logoMark}
            alt=""
            width={32}
            height={32}
            style={{ display: 'block', objectFit: 'contain' }}
          />
        </div>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>
          {t('app.name')}
        </span>
      </div>

      <nav
        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 10px' }}
      >
        {NAV_ITEMS.map(({ id, labelKey, Icon }) => {
          const active = screen === id;
          const label = t(labelKey);
          return (
            <button
              key={id}
              onClick={() => setScreen(id)}
              title={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                justifyContent: 'flex-start',
                borderRadius: 12,
                border: 'none',
                background: active ? 'oklch(100% 0 0 / 0.15)' : 'transparent',
                color: active ? '#fff' : 'oklch(100% 0 0 / 0.55)',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: active ? 700 : 500,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                position: 'relative',
              }}
            >
              {active && (
                <span
                  style={{
                    position: 'absolute',
                    insetInlineEnd: 0,
                    top: '20%',
                    bottom: '20%',
                    width: 3,
                    borderRadius: '4px 0 0 4px',
                    background: '#fff',
                  }}
                />
              )}
              <Icon s={22} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function BottomNav({ screen, setScreen }: Props) {
  const { t } = useT();
  const visible = NAV_ITEMS.filter((i) => !MOBILE_HIDDEN_SCREENS.includes(i.id));
  return (
    <nav
      aria-label={t('app.name')}
      style={{
        position: 'fixed',
        bottom: 0,
        insetInlineStart: 0,
        insetInlineEnd: 0,
        background: 'var(--teal-dark)',
        display: 'flex',
        zIndex: 50,
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)',
        boxShadow: '0 -4px 16px oklch(0% 0 0 / 0.18)',
      }}
    >
      {visible.map(({ id, labelKey, Icon }) => {
        const active = screen === id;
        const label = t(labelKey);
        return (
          <button
            key={id}
            onClick={() => setScreen(id)}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 56,
              padding: '10px 4px',
              border: 'none',
              background: 'transparent',
              color: active ? '#fff' : 'oklch(100% 0 0 / 0.55)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              position: 'relative',
            }}
          >
            {active && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  insetInlineStart: '20%',
                  insetInlineEnd: '20%',
                  height: 3,
                  borderRadius: '0 0 4px 4px',
                  background: '#fff',
                }}
              />
            )}
            <Icon s={22} />
            <span
              style={{
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
