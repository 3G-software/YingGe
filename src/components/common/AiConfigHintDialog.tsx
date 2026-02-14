import { AlertCircle, Settings, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";

type DialogMode = "not_configured" | "connection_failed";

interface AiConfigHintDialogProps {
  open: boolean;
  mode?: DialogMode;
  onGoToSettings: () => void;
  onContinue: () => void;
  onDontShowAgain: () => void;
}

export function AiConfigHintDialog({
  open,
  mode = "not_configured",
  onGoToSettings,
  onContinue,
  onDontShowAgain,
}: AiConfigHintDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  const isNotConfigured = mode === "not_configured";
  const title = isNotConfigured ? t("import.aiNotConfigured") : t("import.aiConnectionFailed");
  const message = isNotConfigured ? t("import.aiNotConfiguredMessage") : t("import.aiConnectionFailedMessage");
  const Icon = isNotConfigured ? AlertCircle : WifiOff;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary rounded-lg border border-border shadow-xl w-[400px]">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <Icon size={20} className={isNotConfigured ? "text-yellow-500" : "text-red-500"} />
          <h3 className="text-base font-medium">{title}</h3>
        </div>
        <div className="p-4">
          <p className="text-sm text-text-secondary mb-4">
            {message}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onGoToSettings}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
            >
              <Settings size={16} />
              {t("import.goToSettings")}
            </button>
            {isNotConfigured ? (
              <button
                onClick={onContinue}
                className="px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-border transition-colors"
              >
                {t("import.continueImport")}
              </button>
            ) : (
              <button
                onClick={onContinue}
                className="px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg hover:bg-border transition-colors"
              >
                {t("import.ok")}
              </button>
            )}
            <button
              onClick={onDontShowAgain}
              className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              {t("import.dontShowAgain")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
