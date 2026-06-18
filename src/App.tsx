import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MOBILE_HIDDEN_SCREENS } from './components/nav-items';
import { UndoRedoBar } from './components/UndoRedoBar';
import { UpdateModal } from './components/UpdateModal';
import { FirstRunModal } from './components/FirstRunModal';
import { Dashboard } from './screens/Dashboard';
import { Transactions } from './screens/Transactions';
import { RecurringScreen } from './screens/Recurring';
import { CategoriesScreen } from './screens/Categories';
import { HistoryScreen } from './screens/History';
import { ImportExportScreen } from './screens/ImportExport';
import { SettingsScreen } from './screens/Settings';
import { useStore } from './lib/useStore';
import { useBreakpoint } from './lib/useBreakpoint';
import { useConfirm } from './components/ConfirmDialog';
import { checkForUpdate, type AvailableUpdate } from './lib/updater';
import { CurrencyProvider, useT } from './i18n/LangProvider';

export default function App() {
  const store = useStore();
  const { t, tp } = useT();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const confirm = useConfirm();
  const [pendingUpdate, setPendingUpdate] = useState<AvailableUpdate | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    // Updater plugin is desktop-only (Cargo target-gated + cfg(desktop) on
    // init); skip the check entirely on mobile to avoid the runtime warning.
    if (isMobile) return;
    let cancelled = false;
    checkForUpdate()
      .then((u) => {
        if (!cancelled && u) setPendingUpdate(u);
      })
      .catch((err) => console.warn('updater check failed', err));
    return () => {
      cancelled = true;
    };
  }, [isMobile]);

  // If the user is on a mobile-hidden screen (e.g. resized down from desktop
  // while on History), bounce to Dashboard so they don't see a dead state.
  useEffect(() => {
    if (isMobile && MOBILE_HIDDEN_SCREENS.includes(store.screen)) {
      store.setScreen('dashboard');
    }
  }, [isMobile, store.screen, store]);

  const effectiveScreen =
    isMobile && MOBILE_HIDDEN_SCREENS.includes(store.screen) ? 'dashboard' : store.screen;

  if (!store.ready) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontSize: 18,
          color: 'var(--text-muted)',
        }}
      >
        {t('app.loading')}
      </div>
    );
  }

  async function confirmDelete(id: string) {
    if (!(await confirm(t('confirm.deleteTx')))) return;
    store.deleteTx(id);
  }

  async function confirmRemoveCategory(type: 'income' | 'expense', name: string) {
    if (!(await confirm(tp('confirm.deleteCat', { name })))) return;
    store.removeCategory(type, name);
  }

  async function confirmDeleteRecurring(id: string) {
    if (!(await confirm(t('confirm.deleteRecurring')))) return;
    store.deleteRecurring(id);
  }

  return (
    <CurrencyProvider currency={store.currency}>
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar screen={store.screen} setScreen={store.setScreen} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {!isMobile && (
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--bg)',
              borderBottom: '1px solid var(--border)',
              padding: '12px 36px',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <UndoRedoBar
              canUndo={store.canUndo}
              canRedo={store.canRedo}
              undoLabel={store.undoLabel}
              redoLabel={store.redoLabel}
              onUndo={store.undo}
              onRedo={store.redo}
            />
          </div>
        )}
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: isMobile
              ? 'max(56px, calc(env(safe-area-inset-top) + 36px)) 14px calc(72px + env(safe-area-inset-bottom)) 14px'
              : '32px 36px',
          }}
        >
          {effectiveScreen === 'dashboard' && (
            <Dashboard transactions={store.data.tx} setScreen={store.setScreen} />
          )}
          {effectiveScreen === 'transactions' && (
            <Transactions
              transactions={store.data.tx}
              categories={store.data.cats}
              onAdd={store.addTx}
              onEdit={store.editTx}
              onDelete={confirmDelete}
              onAddRecurring={store.addRecurring}
              onAddAttachment={store.addAttachment}
              onRemoveAttachment={store.removeAttachment}
            />
          )}
          {effectiveScreen === 'recurring' && (
            <RecurringScreen
              rules={store.data.recurring}
              categories={store.data.cats}
              onAdd={store.addRecurring}
              onEdit={store.editRecurring}
              onDelete={confirmDeleteRecurring}
            />
          )}
          {effectiveScreen === 'categories' && (
            <CategoriesScreen
              categories={store.data.cats}
              onAdd={store.addCategory}
              onRemove={confirmRemoveCategory}
            />
          )}
          {effectiveScreen === 'history' && (
            <HistoryScreen history={store.history} onRestore={store.restoreSnapshot} />
          )}
          {effectiveScreen === 'import-export' && (
            <ImportExportScreen data={store.data} onImport={store.importData} />
          )}
          {effectiveScreen === 'settings' && (
            <SettingsScreen
              currency={store.currency ?? 'EUR'}
              onSetCurrency={store.setCurrency}
            />
          )}
        </div>
      </main>
      {pendingUpdate && !updateDismissed && (
        <UpdateModal update={pendingUpdate} onDismiss={() => setUpdateDismissed(true)} />
      )}
      {store.isFirstRun && <FirstRunModal onComplete={store.completeFirstRun} />}
    </div>
    </CurrencyProvider>
  );
}
