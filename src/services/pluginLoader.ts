import { invoke } from '@tauri-apps/api/core';
import type {
  PluginManifest,
  LoadedPlugin,
  PluginContext,
  PluginAPI,
  PluginUI,
  PluginI18n,
} from '../types/plugin';

class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private currentLocale: string = 'en';

  async loadPlugins(): Promise<void> {
    try {
      // Get list of plugins from backend
      console.log('[PluginLoader] Loading plugins...');
      const pluginDirs: string[] = await invoke('list_plugins');
      console.log('[PluginLoader] Found plugin directories:', pluginDirs);

      for (const pluginDir of pluginDirs) {
        await this.loadPlugin(pluginDir);
      }

      console.log('[PluginLoader] Loaded plugins:', Array.from(this.plugins.keys()));
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  }

  async loadPlugin(pluginDir: string): Promise<void> {
    try {
      console.log('[PluginLoader] Loading plugin from:', pluginDir);
      // Read manifest
      const manifestPath = `${pluginDir}/manifest.json`;
      const manifestContent: string = await invoke('read_plugin_file', {
        path: manifestPath,
      });
      const manifest: PluginManifest = JSON.parse(manifestContent);
      console.log('[PluginLoader] Loaded manifest:', manifest.name);

      // Read entry file
      const entryPath = `${pluginDir}/${manifest.entry}`;
      const entryContent: string = await invoke('read_plugin_file', {
        path: entryPath,
      });

      // Create plugin context
      const context = this.createPluginContext(manifest);

      // Execute plugin code in isolated scope
      const pluginModule = this.executePluginCode(entryContent, context);

      // Store loaded plugin
      this.plugins.set(manifest.name, {
        manifest,
        module: pluginModule,
        enabled: true,
      });

      console.log(`Plugin loaded: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      console.error(`Failed to load plugin from ${pluginDir}:`, error);
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
        // This will be connected to the app's notification system
        window.dispatchEvent(
          new CustomEvent('plugin-notification', { detail: options })
        );
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
    return Array.from(this.plugins.values());
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
