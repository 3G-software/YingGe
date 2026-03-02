/**
 * YingGe Crop Image Plugin
 *
 * This plugin adds image cropping functionality to YingGe.
 */

// Define the crop-image action handler
exports['crop-image'] = async function(assetId) {
  const { api, ui, i18n } = context;

  console.log('[CropPlugin] Crop action triggered for asset:', assetId);

  try {
    if (!assetId) {
      ui.showNotification({
        type: 'error',
        message: 'No asset selected'
      });
      return;
    }

    // Get asset details
    const asset = await api.getAsset(assetId);
    console.log('[CropPlugin] Asset details:', asset);

    // For now, show a notification that the crop dialog would open
    // In a full implementation, this would open the CropImageDialog
    ui.showNotification({
      type: 'info',
      message: `Crop functionality for asset ${asset.name || assetId} - Dialog integration coming soon`
    });

    // TODO: Integrate with CropImageDialog component
    // This would require:
    // 1. A way to dynamically load React components from plugins
    // 2. Or a way to trigger the existing CropImageDialog from the plugin

  } catch (error) {
    console.error('[CropPlugin] Failed to crop image:', error);
    ui.showNotification({
      type: 'error',
      message: `${i18n.t('cropFailed')}: ${error.message}`
    });
  }
};

console.log('[CropPlugin] Plugin loaded successfully');
