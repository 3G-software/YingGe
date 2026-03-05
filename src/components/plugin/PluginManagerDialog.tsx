import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { pluginLoader } from '../../services/pluginLoader';
import type { LoadedPlugin } from '../../types/plugin';

interface PluginManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PluginManagerDialog({ open, onClose }: PluginManagerDialogProps) {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadPlugins();
    }
  }, [open]);

  const loadPlugins = () => {
    setPlugins(pluginLoader.getPlugins());
  };

  const handleImportPlugin = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [
          {
            name: 'Plugin',
            extensions: ['zip'],
          },
        ],
      });

      if (selected) {
        setLoading(true);
        await pluginLoader.importPlugin(selected as string);
        loadPlugins();
      }
    } catch (error) {
      console.error('Failed to import plugin:', error);
      alert(t('pluginImportFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async (name: string) => {
    if (!confirm(t('confirmUninstallPlugin'))) {
      return;
    }

    try {
      setLoading(true);
      await pluginLoader.uninstallPlugin(name);
      loadPlugins();
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      alert(t('pluginUninstallFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-900 rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border bg-gray-800">
          <h2 className="text-lg font-semibold">{t('pluginManager')}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {plugins.length === 0 ? (
            <div className="text-center text-text-secondary py-8">
              {t('noPluginsInstalled')}
            </div>
          ) : (
            <div className="space-y-3">
              {plugins.map((plugin) => (
                <div
                  key={plugin.manifest.name}
                  className="border border-border rounded-lg p-4 bg-surface"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {plugin.manifest.name}
                        {plugin.isBuiltin && (
                          <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">
                            {t('builtin')}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">
                        {plugin.manifest.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-text-secondary">
                        <span>v{plugin.manifest.version}</span>
                        <span>{plugin.manifest.author}</span>
                        <span>{plugin.manifest.license}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUninstall(plugin.manifest.name)}
                      disabled={loading || plugin.isBuiltin}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title={plugin.isBuiltin ? t('cannotUninstallBuiltin') : ''}
                    >
                      {t('uninstall')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-gray-800 flex justify-between">
          <button
            onClick={handleImportPlugin}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary-hover rounded disabled:opacity-50"
          >
            {t('importPlugin')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface hover:bg-surface-hover rounded"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
