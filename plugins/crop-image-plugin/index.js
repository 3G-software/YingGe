/**
 * YingGe Crop Image Plugin
 *
 * This plugin adds image cropping functionality to YingGe.
 * It creates its own UI using vanilla JavaScript and communicates with the backend via API.
 */

// Define the crop-image action handler (for context menu on selected asset)
exports['crop-image'] = async function(assetId) {
  const { api, ui } = context;

  console.log('[CropPlugin] Crop action triggered for asset:', assetId);

  try {
    if (!assetId) {
      ui.showNotification({
        type: 'error',
        message: 'No asset selected'
      });
      return;
    }

    // Open the crop dialog
    await openCropDialog(assetId);

  } catch (error) {
    console.error('[CropPlugin] Failed to open crop dialog:', error);
    ui.showNotification({
      type: 'error',
      message: `Failed to open crop dialog: ${error.message}`
    });
  }
};

// Define the open-crop-dialog action handler (for menu click)
exports['open-crop-dialog'] = async function(assetId) {
  const { ui, api } = context;

  console.log('[CropPlugin] Open crop dialog action triggered from menu, assetId:', assetId);

  // Check if assetId is valid (not undefined, null, or empty string)
  if (!assetId || assetId === '') {
    console.log('[CropPlugin] No asset selected, showing notification');
    // No asset selected, show a message
    ui.showNotification({
      type: 'info',
      message: '请先选择一张图片，然后右键选择"裁剪图片"'
    });
    console.log('[CropPlugin] Notification dispatched');
    return;
  }

  // Verify the asset exists before opening dialog
  try {
    await api.invoke('get_asset_file_path', { id: assetId });
    await openCropDialog(assetId);
  } catch (error) {
    console.error('[CropPlugin] Failed to open crop dialog:', error);
    ui.showNotification({
      type: 'error',
      message: `Failed to open crop dialog: ${error.message}`
    });
  }
};

/**
 * Open the crop dialog with custom UI
 */
async function openCropDialog(assetId) {
  const { api, ui, i18n } = context;

  // Check if dialog already exists
  const existingDialog = document.getElementById('crop-plugin-dialog');
  if (existingDialog) {
    console.log('[CropPlugin] Dialog already exists, removing old one');
    document.body.removeChild(existingDialog);
  }

  // Get asset file path
  const filePath = await api.invoke('get_asset_file_path', { id: assetId });

  // Convert to asset URL
  const assetUrl = window.__TAURI__.core.convertFileSrc(filePath);

  // Create dialog container
  const dialogContainer = document.createElement('div');
  dialogContainer.id = 'crop-plugin-dialog';
  dialogContainer.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  // Create dialog content
  dialogContainer.innerHTML = `
    <div style="
      background: #1f2937;
      border-radius: 8px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      width: 90vw;
      height: 90vh;
      display: flex;
      flex-direction: column;
      color: white;
    ">
      <!-- Header -->
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid #374151;
        background: #111827;
        border-radius: 8px 8px 0 0;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
          <h2 style="font-size: 18px; font-weight: 600; margin: 0;">裁剪图片</h2>
        </div>
        <button id="crop-close-btn" style="
          padding: 4px;
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.2s;
        " onmouseover="this.style.background='#374151'" onmouseout="this.style.background='transparent'">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Canvas Area -->
      <div style="
        flex: 1;
        overflow: auto;
        background: #0f172a;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      ">
        <canvas id="crop-canvas" style="
          cursor: crosshair;
          image-rendering: pixelated;
        "></canvas>
      </div>

      <!-- Controls -->
      <div style="
        padding: 16px;
        border-top: 1px solid #374151;
        background: #111827;
        border-radius: 0 0 8px 8px;
      ">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div id="crop-info" style="font-size: 14px; color: #9ca3af;">
              请在图片上拖动鼠标选择裁剪区域
            </div>
            <div id="crop-size-inputs" style="display: none; align-items: center; gap: 8px;">
              <label style="font-size: 14px; color: #9ca3af;">宽度:</label>
              <input id="crop-width-input" type="number" min="1" style="
                width: 80px;
                padding: 4px 8px;
                background: #1f2937;
                border: 1px solid #374151;
                border-radius: 4px;
                color: white;
                font-size: 14px;
              " />
              <label style="font-size: 14px; color: #9ca3af;">高度:</label>
              <input id="crop-height-input" type="number" min="1" style="
                width: 80px;
                padding: 4px 8px;
                background: #1f2937;
                border: 1px solid #374151;
                border-radius: 4px;
                color: white;
                font-size: 14px;
              " />
              <button id="crop-apply-size-btn" style="
                padding: 4px 12px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: background 0.2s;
              " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
                应用
              </button>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="crop-reset-btn" style="
              padding: 8px 16px;
              background: #374151;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
              transition: background 0.2s;
            " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#374151'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              重置
            </button>
            <button id="crop-save-btn" style="
              padding: 8px 16px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 8px;
              transition: background 0.2s;
            " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'" disabled>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              保存
            </button>
          </div>
        </div>
        <div id="crop-result" style="margin-top: 12px; display: none;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(dialogContainer);

  // Initialize canvas
  const canvas = document.getElementById('crop-canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.crossOrigin = 'anonymous';

  let cropRegion = null;
  let isDragging = false;
  let dragStart = null;
  let dragMode = null; // 'create', 'move', 'resize-tl', 'resize-tr', 'resize-bl', 'resize-br', 'resize-t', 'resize-b', 'resize-l', 'resize-r'
  let dragOffset = null;
  const HANDLE_SIZE = 10; // Size of resize handles in canvas pixels

  img.onload = () => {
    // Calculate the display size to fit within the container while maintaining aspect ratio
    const container = canvas.parentElement;
    const containerWidth = container.clientWidth - 32; // Account for padding
    const containerHeight = container.clientHeight - 32;

    const imageAspect = img.width / img.height;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth, displayHeight;

    if (imageAspect > containerAspect) {
      // Image is wider than container
      displayWidth = Math.min(containerWidth, img.width);
      displayHeight = displayWidth / imageAspect;
    } else {
      // Image is taller than container
      displayHeight = Math.min(containerHeight, img.height);
      displayWidth = displayHeight * imageAspect;
    }

    // Set canvas size to original image dimensions
    canvas.width = img.width;
    canvas.height = img.height;

    // Set canvas display size to maintain aspect ratio
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    drawImage();
  };

  img.src = assetUrl;

  function drawImage(region = null) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    if (region) {
      // Darken outside crop region
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvas.width, region.y);
      ctx.fillRect(0, region.y, region.x, region.height);
      ctx.fillRect(region.x + region.width, region.y, canvas.width - region.x - region.width, region.height);
      ctx.fillRect(0, region.y + region.height, canvas.width, canvas.height - region.y - region.height);

      // Draw crop region border
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      // Draw resize handles
      ctx.fillStyle = '#3b82f6';
      const handles = [
        { x: region.x, y: region.y }, // top-left
        { x: region.x + region.width, y: region.y }, // top-right
        { x: region.x, y: region.y + region.height }, // bottom-left
        { x: region.x + region.width, y: region.y + region.height }, // bottom-right
        { x: region.x + region.width / 2, y: region.y }, // top
        { x: region.x + region.width / 2, y: region.y + region.height }, // bottom
        { x: region.x, y: region.y + region.height / 2 }, // left
        { x: region.x + region.width, y: region.y + region.height / 2 }, // right
      ];
      handles.forEach(handle => {
        ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      });
    }
  }

  function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function getHitTest(point, region) {
    if (!region || region.width === 0 || region.height === 0) return null;

    const { x, y } = point;
    const { x: rx, y: ry, width: rw, height: rh } = region;

    // Check resize handles (corners first, then edges)
    if (Math.abs(x - rx) <= HANDLE_SIZE && Math.abs(y - ry) <= HANDLE_SIZE) return 'resize-tl';
    if (Math.abs(x - (rx + rw)) <= HANDLE_SIZE && Math.abs(y - ry) <= HANDLE_SIZE) return 'resize-tr';
    if (Math.abs(x - rx) <= HANDLE_SIZE && Math.abs(y - (ry + rh)) <= HANDLE_SIZE) return 'resize-bl';
    if (Math.abs(x - (rx + rw)) <= HANDLE_SIZE && Math.abs(y - (ry + rh)) <= HANDLE_SIZE) return 'resize-br';

    if (Math.abs(y - ry) <= HANDLE_SIZE && x >= rx && x <= rx + rw) return 'resize-t';
    if (Math.abs(y - (ry + rh)) <= HANDLE_SIZE && x >= rx && x <= rx + rw) return 'resize-b';
    if (Math.abs(x - rx) <= HANDLE_SIZE && y >= ry && y <= ry + rh) return 'resize-l';
    if (Math.abs(x - (rx + rw)) <= HANDLE_SIZE && y >= ry && y <= ry + rh) return 'resize-r';

    // Check if inside region
    if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) return 'move';

    return null;
  }

  function getCursorStyle(hitTest) {
    const cursors = {
      'move': 'move',
      'resize-tl': 'nw-resize',
      'resize-tr': 'ne-resize',
      'resize-bl': 'sw-resize',
      'resize-br': 'se-resize',
      'resize-t': 'n-resize',
      'resize-b': 's-resize',
      'resize-l': 'w-resize',
      'resize-r': 'e-resize',
    };
    return cursors[hitTest] || 'crosshair';
  }

  function updateInfo() {
    const infoEl = document.getElementById('crop-info');
    const sizeInputsEl = document.getElementById('crop-size-inputs');
    const widthInput = document.getElementById('crop-width-input');
    const heightInput = document.getElementById('crop-height-input');
    const saveBtn = document.getElementById('crop-save-btn');

    if (!cropRegion || cropRegion.width === 0 || cropRegion.height === 0) {
      infoEl.style.display = 'block';
      sizeInputsEl.style.display = 'none';
      infoEl.textContent = '请在图片上拖动鼠标选择裁剪区域';
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.5';
      saveBtn.style.cursor = 'not-allowed';
    } else {
      infoEl.style.display = 'none';
      sizeInputsEl.style.display = 'flex';
      widthInput.value = Math.round(cropRegion.width);
      heightInput.value = Math.round(cropRegion.height);
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
      saveBtn.style.cursor = 'pointer';
    }
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e) => {
    const point = getCanvasPoint(e);
    const hitTest = getHitTest(point, cropRegion);

    if (hitTest) {
      // Interacting with existing region
      isDragging = true;
      dragStart = point;
      dragMode = hitTest;
      if (hitTest === 'move') {
        dragOffset = {
          x: point.x - cropRegion.x,
          y: point.y - cropRegion.y
        };
      }
    } else {
      // Creating new region
      isDragging = true;
      dragStart = point;
      dragMode = 'create';
      cropRegion = { x: point.x, y: point.y, width: 0, height: 0 };
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const point = getCanvasPoint(e);

    if (!isDragging) {
      // Update cursor based on hit test
      const hitTest = getHitTest(point, cropRegion);
      canvas.style.cursor = getCursorStyle(hitTest);
      return;
    }

    if (!dragStart || !dragMode) return;

    if (dragMode === 'create') {
      // Creating new region
      const x = Math.min(dragStart.x, point.x);
      const y = Math.min(dragStart.y, point.y);
      const width = Math.abs(point.x - dragStart.x);
      const height = Math.abs(point.y - dragStart.y);
      cropRegion = { x, y, width, height };
    } else if (dragMode === 'move') {
      // Moving region
      let newX = point.x - dragOffset.x;
      let newY = point.y - dragOffset.y;

      // Constrain to canvas bounds
      newX = Math.max(0, Math.min(newX, canvas.width - cropRegion.width));
      newY = Math.max(0, Math.min(newY, canvas.height - cropRegion.height));

      cropRegion.x = newX;
      cropRegion.y = newY;
    } else if (dragMode.startsWith('resize-')) {
      // Resizing region
      const dx = point.x - dragStart.x;
      const dy = point.y - dragStart.y;

      let newX = cropRegion.x;
      let newY = cropRegion.y;
      let newWidth = cropRegion.width;
      let newHeight = cropRegion.height;

      if (dragMode.includes('l')) {
        newX = Math.min(point.x, cropRegion.x + cropRegion.width - 10);
        newWidth = cropRegion.x + cropRegion.width - newX;
      }
      if (dragMode.includes('r')) {
        newWidth = Math.max(10, point.x - cropRegion.x);
      }
      if (dragMode.includes('t')) {
        newY = Math.min(point.y, cropRegion.y + cropRegion.height - 10);
        newHeight = cropRegion.y + cropRegion.height - newY;
      }
      if (dragMode.includes('b')) {
        newHeight = Math.max(10, point.y - cropRegion.y);
      }

      // Constrain to canvas bounds
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);
      newWidth = Math.min(newWidth, canvas.width - newX);
      newHeight = Math.min(newHeight, canvas.height - newY);

      cropRegion = { x: newX, y: newY, width: newWidth, height: newHeight };
      dragStart = point;
    }

    drawImage(cropRegion);
    updateInfo();
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    dragStart = null;
    dragMode = null;
    dragOffset = null;
  });

  canvas.addEventListener('mouseleave', () => {
    if (!isDragging) {
      canvas.style.cursor = 'crosshair';
    }
  });

  // Button events
  const closeDialog = () => {
    const dialog = document.getElementById('crop-plugin-dialog');
    if (dialog && dialog.parentNode) {
      dialog.parentNode.removeChild(dialog);
    }
  };

  document.getElementById('crop-close-btn').addEventListener('click', closeDialog);

  // Also allow closing by clicking outside the dialog
  dialogContainer.addEventListener('click', (e) => {
    if (e.target === dialogContainer) {
      closeDialog();
    }
  });

  document.getElementById('crop-reset-btn').addEventListener('click', () => {
    cropRegion = null;
    drawImage();
    updateInfo();
  });

  document.getElementById('crop-apply-size-btn').addEventListener('click', () => {
    if (!cropRegion) return;

    const widthInput = document.getElementById('crop-width-input');
    const heightInput = document.getElementById('crop-height-input');

    let newWidth = parseInt(widthInput.value);
    let newHeight = parseInt(heightInput.value);

    // Validate inputs
    if (isNaN(newWidth) || newWidth < 1) newWidth = 1;
    if (isNaN(newHeight) || newHeight < 1) newHeight = 1;

    // Keep the top-left corner (x, y) as anchor point
    const newX = cropRegion.x;
    const newY = cropRegion.y;

    // Constrain to canvas bounds
    newWidth = Math.min(newWidth, canvas.width - newX);
    newHeight = Math.min(newHeight, canvas.height - newY);

    // Update crop region
    cropRegion = { x: newX, y: newY, width: newWidth, height: newHeight };

    // Redraw and update inputs
    drawImage(cropRegion);
    updateInfo();
  });

  // Allow pressing Enter in input fields to apply size
  const applySize = () => {
    document.getElementById('crop-apply-size-btn').click();
  };
  document.getElementById('crop-width-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applySize();
  });
  document.getElementById('crop-height-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') applySize();
  });

  document.getElementById('crop-save-btn').addEventListener('click', async () => {
    if (!cropRegion || cropRegion.width === 0 || cropRegion.height === 0) return;

    const saveBtn = document.getElementById('crop-save-btn');
    const resultEl = document.getElementById('crop-result');

    saveBtn.disabled = true;
    saveBtn.textContent = '处理中...';

    try {
      // Perform cropping in browser canvas
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = Math.round(cropRegion.width);
      croppedCanvas.height = Math.round(cropRegion.height);
      const croppedCtx = croppedCanvas.getContext('2d');

      // Draw the cropped region
      croppedCtx.drawImage(
        img,
        Math.round(cropRegion.x),
        Math.round(cropRegion.y),
        Math.round(cropRegion.width),
        Math.round(cropRegion.height),
        0,
        0,
        Math.round(cropRegion.width),
        Math.round(cropRegion.height)
      );

      // Convert to base64
      const imageData = croppedCanvas.toDataURL('image/png');

      // Call generic save API
      await api.invoke('save_edited_image', {
        assetId: assetId,
        imageData: imageData
      });

      // Show success message
      resultEl.style.display = 'block';
      resultEl.style.cssText = `
        margin-top: 12px;
        padding: 12px;
        background: rgba(34, 197, 94, 0.1);
        color: #22c55e;
        border-radius: 6px;
        font-size: 14px;
      `;
      resultEl.textContent = '✓ 裁剪成功';

      ui.showNotification({
        type: 'success',
        message: '图片裁剪成功'
      });

      // Trigger asset refresh event
      window.dispatchEvent(new CustomEvent('asset-updated', {
        detail: { assetId: assetId }
      }));

      // Close dialog after 1.5 seconds
      setTimeout(() => {
        closeDialog();
      }, 1500);

    } catch (error) {
      console.error('[CropPlugin] Crop failed:', error);

      resultEl.style.display = 'block';
      resultEl.style.cssText = `
        margin-top: 12px;
        padding: 12px;
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border-radius: 6px;
        font-size: 14px;
      `;
      resultEl.textContent = '✗ 裁剪失败: ' + error.message;

      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
          <polyline points="17 21 17 13 7 13 7 21"></polyline>
          <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
        保存
      `;
    }
  });
}

console.log('[CropPlugin] Plugin loaded successfully');

