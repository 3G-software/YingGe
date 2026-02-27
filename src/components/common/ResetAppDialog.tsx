import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resetApplication } from "../../services/tauriBridge";

interface ResetAppDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ResetAppDialog({ open, onClose }: ResetAppDialogProps) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  if (!open) return null;

  const handleReset = async () => {
    if (confirmText !== "RESET") return;

    setProcessing(true);
    setResult(null);

    try {
      await resetApplication();
      setResult({ success: true });
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : String(e) });
    }

    setProcessing(false);
  };

  const handleClose = () => {
    if (result?.success) {
      // Reload the app after successful reset
      window.location.reload();
    }
    setConfirmText("");
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div
        className="relative rounded-lg shadow-xl w-full max-w-md mx-4 border border-border"
        style={{ backgroundColor: "var(--color-bg-secondary, #1e1e1e)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2 text-red-500">
            <AlertTriangle size={20} />
            <h2 className="text-lg font-semibold">{t("resetApp.title")}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {!result && (
            <>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-sm text-red-400">{t("resetApp.warning")}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("resetApp.inputConfirm")}
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm focus:outline-none focus:border-primary font-mono"
                />
              </div>
            </>
          )}

          {result && (
            <div
              className={`p-3 rounded-lg border ${
                result.success
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-red-500/50 bg-red-500/10"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  result.success ? "text-green-500" : "text-red-500"
                }`}
              >
                {result.success ? t("resetApp.success") : t("common.error")}
              </p>
              {result.success && (
                <p className="text-sm text-text-secondary mt-1">
                  {t("resetApp.successMessage")}
                </p>
              )}
              {result.error && (
                <p className="text-sm text-red-400 mt-1">{result.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-bg-tertiary transition-colors"
            disabled={processing}
          >
            {result ? t("common.close") : t("common.cancel")}
          </button>
          {!result && (
            <button
              onClick={handleReset}
              disabled={confirmText !== "RESET" || processing}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("resetApp.resetting")}
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  {t("resetApp.confirm")}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
