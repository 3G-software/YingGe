import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-bg-secondary rounded-lg border border-border shadow-xl w-[400px]">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-base font-medium">{t("about.title")}</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 text-center">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-primary mb-2">YingGe</h1>
            <p className="text-sm text-text-secondary">{t("about.subtitle")}</p>
          </div>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              <span className="font-medium text-text-primary">{t("about.version")}:</span> 0.1.0
            </p>
            <p className="mt-4">
              {t("about.description")}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-xs text-text-secondary">
              © 2026 YingGe. {t("about.rights")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
