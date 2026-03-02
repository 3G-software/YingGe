import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { pluginLoader } from '../services/pluginLoader';
import type { PluginAction, LoadedPlugin } from '../types/plugin';
import { useTranslation } from 'react-i18next';

interface PluginContextType {
  plugins: LoadedPlugin[];
  getActionsForContext: (context: string) => PluginActionWithHandler[];
  executeAction: (actionId: string, assetId?: string | number) => Promise<void>;
}

interface PluginActionWithHandler extends PluginAction {
  pluginName: string;
  handler: (assetId?: string | number) => Promise<void>;
}

const PluginContext = createContext<PluginContextType | null>(null);

export function PluginProvider({ children }: { children: ReactNode }) {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const { i18n } = useTranslation();

  useEffect(() => {
    loadPlugins();
  }, []);

  useEffect(() => {
    // Update plugin locale when app locale changes
    pluginLoader.setLocale(i18n.language);
  }, [i18n.language]);

  const loadPlugins = async () => {
    console.log('[PluginContext] Loading plugins...');
    await pluginLoader.loadPlugins();
    const loadedPlugins = pluginLoader.getPlugins();
    console.log('[PluginContext] Plugins loaded:', loadedPlugins.length);
    setPlugins(loadedPlugins);
  };

  const getActionsForContext = (context: string): PluginActionWithHandler[] => {
    const actions: PluginActionWithHandler[] = [];
    console.log('[PluginContext] Getting actions for context:', context, 'from', plugins.length, 'plugins');

    for (const plugin of plugins) {
      if (!plugin.enabled) continue;

      for (const action of plugin.manifest.actions) {
        if (action.context === context || action.context === 'global') {
          actions.push({
            ...action,
            pluginName: plugin.manifest.name,
            handler: async (assetId?: string | number) => {
              // Execute the action from the plugin module
              if (plugin.module && plugin.module[action.id]) {
                await plugin.module[action.id](assetId);
              }
            },
          });
        }
      }
    }

    return actions;
  };

  const executeAction = async (actionId: string, assetId?: string | number) => {
    for (const plugin of plugins) {
      const action = plugin.manifest.actions.find((a) => a.id === actionId);
      if (action && plugin.module && plugin.module[actionId]) {
        await plugin.module[actionId](assetId);
        return;
      }
    }
    console.warn(`Action ${actionId} not found in any plugin`);
  };

  return (
    <PluginContext.Provider
      value={{
        plugins,
        getActionsForContext,
        executeAction,
      }}
    >
      {children}
    </PluginContext.Provider>
  );
}

export function usePlugins() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugins must be used within PluginProvider');
  }
  return context;
}