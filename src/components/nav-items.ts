import type { ComponentType } from 'react';
import type { Screen } from '../types';
import type { MessageKey } from '../i18n/messages';
import {
  ICats,
  IDash,
  IHistory,
  IImportExport,
  IRecurring,
  ISettings,
  ITrans,
} from './icons';

export const NAV_ITEMS: ReadonlyArray<{
  id: Screen;
  labelKey: MessageKey;
  Icon: ComponentType<{ s?: number }>;
}> = [
  { id: 'dashboard', labelKey: 'nav.dashboard', Icon: IDash },
  { id: 'transactions', labelKey: 'nav.transactions', Icon: ITrans },
  { id: 'recurring', labelKey: 'nav.recurring', Icon: IRecurring },
  { id: 'categories', labelKey: 'nav.categories', Icon: ICats },
  { id: 'history', labelKey: 'nav.history', Icon: IHistory },
  { id: 'import-export', labelKey: 'nav.importExport', Icon: IImportExport },
  { id: 'settings', labelKey: 'nav.settings', Icon: ISettings },
];

// Phase 0/5: hidden on the mobile breakpoint.
// - history: complex DAG UI that doesn't earn its small-screen cost in v1.
// - import-export: dialog.open returns content URIs on Android that
//   plugin-fs.readFile can't consume; plus the xlsx bundle is heavy.
export const MOBILE_HIDDEN_SCREENS: ReadonlyArray<Screen> = ['history', 'import-export'];
