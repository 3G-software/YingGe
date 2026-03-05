import { invoke } from '@tauri-apps/api/core';
import type {
  PluginManifest,
  LoadedPlugin,
  PluginContext,
  PluginAPI,
  PluginUI,
  PluginI18n,
  PluginInfo,
} from '../types/plugin';

class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private currentLocale: string = 'en';

  async loadPlugins(): Promise<void> {
    try {
      // Get list of plugins from backend
      console.log('[PluginLoader] Loading plugins...');
      const pluginInfos: PluginInfo[] = await invoke('list_plugins');
      console.log('[PluginLoader] Found plugin directories:', pluginInfos);
      console.log('[PluginLoader] Plugin infos type:', typeof pluginInfos, Array.isArray(pluginInfos));
      console.log('[PluginLoader] Plugin infos length:', pluginInfos?.length);

      if (!Array.isArray(pluginInfos)) {
        console.error('[PluginLoader] list_plugins did not return an array:', pluginInfos);
        return;
      }

      for (const pluginInfo of pluginInfos) {
        console.log('[PluginLoader] Processing plugin info:', pluginInfo);
        await this.loadPlugin(pluginInfo.path, pluginInfo.is_builtin);
      }

      console.log('[PluginLoader] Loaded plugins:', Array.from(this.plugins.keys()));
      console.log('[PluginLoader] Total plugins in map:', this.plugins.size);
    } catch (error) {
      console.error('[PluginLoader] Failed to load plugins:', error);
      console.error('[PluginLoader] Error stack:', error instanceof Error ? error.stack : 'No stack');
    }
  }

  async loadPlugin(pluginDir: string, isBuiltin: boolean = false): Promise<void> {
    try {
      console.log('[PluginLoader] Loading plugin from:', pluginDir);
      // Read manifest
      const manifestPath = `${pluginDir}/manifest.json`;
      console.log('[PluginLoader] Reading manifest from:', manifestPath);
      const manifestContent: string = await invoke('read_plugin_file', {
        path: manifestPath,
      });
      console.log('[PluginLoader] Manifest content:', manifestContent);
      const manifest: PluginManifest = JSON.parse(manifestContent);
      console.log('[PluginLoader] Loaded manifest:', manifest.name);

      // Read entry file
      const entryPath = `${pluginDir}/${manifest.entry}`;
      console.log('[PluginLoader] Reading entry file from:', entryPath);
      const entryContent: string = await invoke('read_plugin_file', {
        path: entryPath,
      });
      console.log('[PluginLoader] Entry file loaded, length:', entryContent.length);

      // Create plugin context
      const context = this.createPluginContext(manifest);

      // Execute plugin code in isolated scope
      console.log('[PluginLoader] Executing plugin code...');
      const pluginModule = this.executePluginCode(entryContent, context);
      console.log('[PluginLoader] Plugin module:', pluginModule);

      // Store loaded plugin
      this.plugins.set(manifest.name, {
        manifest,
        module: pluginModule,
        enabled: true,
        isBuiltin,
      });

      console.log(`[PluginLoader] Plugin loaded successfully: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      console.error(`[PluginLoader] Failed to load plugin from ${pluginDir}:`, error);
      console.error('[PluginLoader] Error details:', error);
    }
  }

  private executePluginCode(code: string, context: PluginContext): any {
    // Create a sandboxed environment for plugin execution
    const sandbox = {
      console,
      context,
      exports: {},
    };

    // Wrap code in function to create scope
    const wrappedCode = `
      (function(context, exports) {
        ${code}
        return exports;
      })
    `;

    try {
      // eslint-disable-next-line no-eval
      const fn = eval(wrappedCode);
      return fn(context, sandbox.exports);
    } catch (error) {
      console.error('Plugin execution error:', error);
      throw error;
    }
  }

  private createPluginContext(manifest: PluginManifest): PluginContext {
    const api: PluginAPI = {
      invoke: (command: string, args?: any) => invoke(command, args),
      getAsset: (id: string | number) => invoke('get_asset', { id }),
      updateAsset: (id: string | number, data: any) =>
        invoke('update_asset', { id, ...data }),
    };

    const ui: PluginUI = {
      showNotification: (options) => {
        console.log('[PluginLoader] showNotification called with:', options);
        // This will be connected to the app's notification system
        const event = new CustomEvent('plugin-notification', { detail: options });
        console.log('[PluginLoader] Dispatching event:', event);
        window.dispatchEvent(event);
        console.log('[PluginLoader] Event dispatched');
      },
      showDialog: (component) => {
        window.dispatchEvent(
          new CustomEvent('plugin-dialog', { detail: component })
        );
      },
    };

    const i18n: PluginI18n = {
      t: (key: string) => {
        const translations = manifest.i18n?.[this.currentLocale];
        return translations?.[key] || key;
      },
      locale: this.currentLocale,
    };

    return { api, ui, i18n };
  }

  setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  getPlugins(): LoadedPlugin[] {
    const plugins = Array.from(this.plugins.values());
    console.log('[PluginLoader] getPlugins called, returning:', plugins.length, 'plugins');
    console.log('[PluginLoader] Plugins map size:', this.plugins.size);
    console.log('[PluginLoader] Plugins map keys:', Array.from(this.plugins.keys()));
    return plugins;
  }

  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  async importPlugin(zipPath: string): Promise<void> {
    try {
      await invoke('import_plugin', { zipPath });
      // Reload plugins after import
      await this.loadPlugins();
    } catch (error) {
      console.error('Failed to import plugin:', error);
      throw error;
    }
  }

  async uninstallPlugin(name: string): Promise<void> {
    try {
      await invoke('uninstall_plugin', { name });
      this.plugins.delete(name);
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      throw error;
    }
  }
}

export const pluginLoader = new PluginLoader();
