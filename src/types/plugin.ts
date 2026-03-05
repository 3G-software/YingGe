export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  entry: string;
  dialog?: string; // Optional: path to dialog component file
  permissions: string[];
  actions: PluginAction[];
  i18n?: Record<string, Record<string, string>>;
  settings?: PluginSetting[];
}

export interface PluginInfo {
  path: string;
  is_builtin: boolean;
}

export interface PluginAction {
  id: string;
  label: string | Record<string, string>;
  description?: string | Record<string, string>;
  icon?: string;
  context: 'asset-single' | 'asset-multiple' | 'global';
}

export interface PluginSetting {
  id: string;
  label: string | Record<string, string>;
  type: 'text' | 'number' | 'boolean' | 'select';
  default?: any;
  options?: Array<{ label: string; value: any }>;
}

export interface PluginContext {
  api: PluginAPI;
  ui: PluginUI;
  i18n: PluginI18n;
}

export interface PluginAPI {
  invoke: (command: string, args?: any) => Promise<any>;
  getAsset: (id: string | number) => Promise<any>;
  updateAsset: (id: string | number, data: any) => Promise<void>;
}

export interface PluginUI {
  showNotification: (options: {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }) => void;
  showDialog: (component: any) => void;
}

export interface PluginI18n {
  t: (key: string) => string;
  locale: string;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  module: any;
  enabled: boolean;
  isBuiltin: boolean;
}
