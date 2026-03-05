import { ComponentType } from 'react';

/**
 * Base interface for all plugins
 * Plugins should implement this interface to provide their functionality
 */
export interface IPlugin {
  /**
   * Plugin metadata
   */
  name: string;
  version: string;
  displayName: { en: string; zh: string };

  /**
   * Optional: Dialog component for this plugin
   * If provided, the plugin can open a dialog UI
   */
  dialogComponent?: ComponentType<PluginDialogProps>;

  /**
   * Initialize the plugin
   * Called when the plugin is loaded
   */
  initialize(context: PluginContext): void;

  /**
   * Execute a plugin action
   * @param actionId - The action ID to execute
   * @param params - Optional parameters for the action
   */
  executeAction(actionId: string, params?: any): Promise<void>;

  /**
   * Cleanup when plugin is unloaded
   */
  destroy?(): void;
}

/**
 * Props passed to plugin dialog components
 */
export interface PluginDialogProps {
  open: boolean;
  assetId?: string | null;
  onClose: () => void;
  [key: string]: any;
}

/**
 * Context provided to plugins
 */
export interface PluginContext {
  api: {
    invoke: (command: string, args?: any) => Promise<any>;
    getAsset: (id: string | number) => Promise<any>;
    updateAsset: (id: string | number, data: any) => Promise<void>;
  };
  ui: {
    showNotification: (options: {
      type: 'success' | 'error' | 'info' | 'warning';
      message: string;
    }) => void;
    openDialog: (props?: any) => void;
  };
  i18n: {
    t: (key: string) => string;
    locale: string;
  };
}
