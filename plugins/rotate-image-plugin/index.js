/**
 * YingGe Rotate Image Plugin (Hybrid Architecture)
 *
 * Demonstrates hybrid architecture:
 * - Frontend: Rotate image in canvas
 * - Backend: Save via generic API
 */

// Rotate 90 degrees clockwise
exports['rotate-90'] = async function(assetId) {
  await rotateImage(assetId, 90);
};

// Rotate 180 degrees
exports['rotate-180'] = async function(assetId) {
  await rotateImage(assetId, 180);
};

// Rotate 270 degrees (90 degrees counter-clockwise)
exports['rotate-270'] = async function(assetId) {
  await rotateImage(assetId, 270);
};

/**
 * Rotate image by specified angle
 * All processing done in browser, only save via API
 */
async function rotateImage(assetId, angle) {
  const { api, ui, i18n } = context;

  try {
    if (!assetId) {
      ui.showNotification({
        type: 'error',
        message: 'No asset selected'
      });
      return;
    }

    // Get asset file path
    const filePath = await api.invoke('get_asset_file_path', { id: assetId });
    // Add cache busting to prevent loading old image
    const assetUrl = window.__TAURI__.core.convertFileSrc(filePath) + `?t=${Date.now()}`;

    // Load image
    const img = await loadImage(assetUrl);

    // Rotate in canvas (frontend processing)
    const rotatedImageData = rotateInCanvas(img, angle);

    // Save via generic API (backend only saves)
    await api.invoke('save_edited_image', {
      assetId: assetId,
      imageData: rotatedImageData
    });

    // Wait a bit for file system to sync and thumbnail to be generated
    await new Promise(resolve => setTimeout(resolve, 100));

    // Dispatch asset-updated event to refresh the workspace
    window.dispatchEvent(new CustomEvent('asset-updated', {
      detail: { assetId: assetId }
    }));

    ui.showNotification({
      type: 'success',
      message: i18n.t('rotateSuccess')
    });

  } catch (error) {
    console.error('[RotatePlugin] Rotate failed:', error);
    ui.showNotification({
      type: 'error',
      message: i18n.t('rotateFailed') + ': ' + error.message
    });
  }
}

/**
 * Load image from URL
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Rotate image in canvas
 * Pure frontend processing - no backend dependency
 */
function rotateInCanvas(img, angle) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Calculate new dimensions after rotation
  if (angle === 90 || angle === 270) {
    canvas.width = img.height;
    canvas.height = img.width;
  } else {
    canvas.width = img.width;
    canvas.height = img.height;
  }

  // Translate and rotate
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((angle * Math.PI) / 180);

  // Draw image (always draw from center)
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  // Convert to base64
  return canvas.toDataURL('image/png');
}
