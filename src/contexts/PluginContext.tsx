import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { pluginLoader } from '../services/pluginLoader';
import type { PluginAction, LoadedPlugin } from '../types/plugin';
import { useTranslation } from 'react-i18next';

interface PluginContextType {
  plugins: LoadedPlugin[];
  getActionsForContext: (context: string) => PluginActionWithHandler[];
  executeAction: (actionId: string, assetId?: string | number) => Promise<void>;
  executePluginByName: (pluginName: string, assetId?: string | number) => Promise<void>;
}

interface PluginActionWithHandler extends PluginAction {
  pluginName: string;
  handler: (assetId?: string | number) => Promise<void>;
}

const PluginContext = createContext<PluginContextType | null>(null);

export function PluginProvider({ children }: { children: ReactNode }) {
  console.log('[PluginProvider] Component mounting/rendering');
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { i18n } = useTranslation();
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    console.log('[PluginProvider] useEffect triggered');
    console.log('[PluginProvider] loadingRef.current:', loadingRef.current);
    console.log('[PluginProvider] loadedRef.current:', loadedRef.current);

    // Prevent duplicate loading in StrictMode
    if (loadingRef.current || loadedRef.current) {
      console.log('[PluginProvider] Already loading or loaded, skipping');
      return;
    }

    loadingRef.current = true;
    console.log('[PluginProvider] Starting plugin load');

    loadPlugins().catch(err => {
      console.error('[PluginProvider] loadPlugins failed:', err);
      loadingRef.current = false;
    });
  }, []);

  // Debug: Log plugins state whenever it changes
  useEffect(() => {
    console.log('[PluginContext] Plugins state updated:', plugins.length, 'plugins');
    plugins.forEach(p => {
      console.log('[PluginContext] Plugin:', p.manifest.name, 'isBuiltin:', p.isBuiltin, 'enabled:', p.enabled);
    });
  }, [plugins]);

  useEffect(() => {
    // Update plugin locale when app locale changes
    pluginLoader.setLocale(i18n.language);
  }, [i18n.language]);

  const loadPlugins = async () => {
    console.log('[PluginContext] Loading plugins... START');
    setIsLoading(true);
    try {
      console.log('[PluginContext] Calling pluginLoader.loadPlugins()...');
      await pluginLoader.loadPlugins();
      console.log('[PluginContext] pluginLoader.loadPlugins() completed');

      const loadedPlugins = pluginLoader.getPlugins();
      console.log('[PluginContext] Plugins loaded:', loadedPlugins.length);
      console.log('[PluginContext] Plugin details:', loadedPlugins.map(p => ({
        name: p.manifest.name,
        actions: p.manifest.actions.map(a => ({ id: a.id, context: a.context })),
        hasModule: !!p.module
      })));

      console.log('[PluginContext] Setting plugins state...');
      setPlugins(loadedPlugins);
      console.log('[PluginContext] Plugins state set');
      loadedRef.current = true;
    } catch (error) {
      console.error('[PluginContext] Error loading plugins:', error);
      console.error('[PluginContext] Error type:', typeof error);
      console.error('[PluginContext] Error details:', JSON.stringify(error, null, 2));
      if (error instanceof Error) {
        console.error('[PluginContext] Error message:', error.message);
        console.error('[PluginContext] Error stack:', error.stack);
      }
    } finally {
      console.log('[PluginContext] Setting isLoading to false');
      setIsLoading(false);
      loadingRef.current = false;
      console.log('[PluginContext] Plugin loading complete');
    }
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

  const executePluginByName = async (pluginName: string, assetId?: string | number) => {
    console.log('[PluginContext] executePluginByName called with:', pluginName, 'assetId:', assetId);
    console.log('[PluginContext] isLoading:', isLoading);
    console.log('[PluginContext] Available plugins:', plugins.map(p => p.manifest.name));

    // Wait for plugins to load by checking the pluginLoader directly
    if (pluginLoader.getPlugins().length === 0) {
      console.log('[PluginContext] Plugins not loaded yet, waiting...');
      // Wait up to 5 seconds for plugins to load
      let attempts = 0;
      while (pluginLoader.getPlugins().length === 0 && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (pluginLoader.getPlugins().length === 0) {
        console.error('[PluginContext] Timeout waiting for plugins to load');
        return;
      }
      console.log('[PluginContext] Plugins loaded, continuing...');
    }

    // Get fresh plugin list from loader
    const currentPlugins = pluginLoader.getPlugins();
    console.log('[PluginContext] Current plugins from loader:', currentPlugins.length);

    const plugin = currentPlugins.find((p) => p.manifest.name === pluginName);
    if (!plugin) {
      console.warn(`Plugin ${pluginName} not found`);
      console.warn('Available plugins:', currentPlugins);
      return;
    }

    console.log('[PluginContext] Found plugin:', plugin.manifest.name);
    console.log('[PluginContext] Plugin actions:', plugin.manifest.actions);
    console.log('[PluginContext] Plugin module:', plugin.module);

    // If assetId is provided, try to find and execute the asset-single action
    // Otherwise, find and execute the global action
    let actionToExecute;
    if (assetId) {
      actionToExecute = plugin.manifest.actions.find((a) => a.context === 'asset-single');
      console.log('[PluginContext] Looking for asset-single action, found:', actionToExecute?.id);
    }

    if (!actionToExecute) {
      actionToExecute = plugin.manifest.actions.find((a) => a.context === 'global');
      console.log('[PluginContext] Looking for global action, found:', actionToExecute?.id);
    }

    if (actionToExecute && plugin.module && plugin.module[actionToExecute.id]) {
      console.log('[PluginContext] Executing action:', actionToExecute.id, 'with assetId:', assetId);
      await plugin.module[actionToExecute.id](assetId);
    } else {
      console.warn(`No suitable action found for plugin ${pluginName}`);
      console.warn('Action to execute:', actionToExecute);
      console.warn('Module has action?', plugin.module && actionToExecute && plugin.module[actionToExecute.id]);
    }
  };

  return (
    <PluginContext.Provider
      value={{
        plugins,
        getActionsForContext,
        executeAction,
        executePluginByName,
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