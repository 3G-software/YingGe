import { useState, useEffect } from "react";
import { Save, TestTube, Check, X, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AiConfigInput } from "../../types/asset";
import {
  getAiConfig,
  saveAiConfig,
  testAiConnection,
} from "../../services/tauriBridge";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [config, setConfig] = useState<AiConfigInput>({
    provider_name: "openai",
    api_endpoint: "https://api.openai.com/v1",
    api_key: "",
    model_id: "gpt-4o",
    embedding_model: "text-embedding-3-small",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    getAiConfig().then((cfg) => {
      if (cfg) {
        setConfig({
          provider_name: cfg.provider_name,
          api_endpoint: cfg.api_endpoint,
          api_key: cfg.api_key,
          model_id: cfg.model_id,
          embedding_model: cfg.embedding_model,
        });
      }
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveAiConfig(config);
    } catch (e) {
      console.error("Failed to save config:", e);
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAiConnection(config);
      setTestResult(result);
    } catch {
      setTestResult(false);
    }
    setTesting(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
      <h1 className="text-xl font-semibold mb-6">{t('settings.title')}</h1>

      {/* Language Settings */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-4">{t('settings.language')}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              {t('settings.selectLanguage')}
            </label>
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            >
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </section>

      {/* AI Configuration */}
      <section className="mb-8">
        <h2 className="text-lg font-medium mb-4">AI Configuration</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Provider
            </label>
            <select
              value={config.provider_name}
              onChange={(e) =>
                setConfig({ ...config, provider_name: e.target.value })
              }
              className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            >
              <option value="openai">OpenAI</option>
              <option value="custom">Custom (OpenAI-Compatible)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              API Endpoint
            </label>
            <input
              type="text"
              value={config.api_endpoint}
              onChange={(e) =>
                setConfig({ ...config, api_endpoint: e.target.value })
              }
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              API Key
            </label>
            <input
              type="password"
              value={config.api_key}
              onChange={(e) =>
                setConfig({ ...config, api_key: e.target.value })
              }
              placeholder="sk-..."
              className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Vision Model (for tagging)
            </label>
            <input
              type="text"
              value={config.model_id}
              onChange={(e) =>
                setConfig({ ...config, model_id: e.target.value })
              }
              placeholder="gpt-4o"
              className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">
              Embedding Model (for semantic search)
            </label>
            <input
              type="text"
              value={config.embedding_model}
              onChange={(e) =>
                setConfig({ ...config, embedding_model: e.target.value })
              }
              placeholder="text-embedding-3-small"
              className="w-full px-3 py-2 text-sm bg-bg rounded border border-border focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              <Save size={14} />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded hover:bg-bg-tertiary disabled:opacity-50 transition-colors"
            >
              <TestTube size={14} />
              {testing ? "Testing..." : "Test Connection"}
            </button>
            {testResult !== null && (
              <span
                className={`flex items-center gap-1 text-sm ${
                  testResult ? "text-green-400" : "text-red-400"
                }`}
              >
                {testResult ? <Check size={14} /> : <X size={14} />}
                {testResult ? "Connected" : "Failed"}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
