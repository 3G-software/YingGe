# YingGe Testing Checklist

## Critical Functionality Tests

### 1. Asset Import
**Issue History**: Import operations were being triggered multiple times (2-3x)

**Test Steps**:
1. Open the application
2. Create or select a library
3. Import a single image file via drag-and-drop
4. Check console logs for `[DropZone] Starting import` - should appear ONLY ONCE
5. Verify the asset appears in the grid ONLY ONCE
6. Check database to confirm only one record was created

**Expected Result**: Asset is imported exactly once

**How to Verify**:
- Console log shows only one "Starting import" message
- Asset grid shows the file once
- Database query: `SELECT COUNT(*) FROM assets WHERE file_name = 'test.png'` returns 1

---

### 2. Root Directory Asset Count
**Issue History**: Root directory count was not including all subdirectories

**Test Steps**:
1. Create a library with the following structure:
   ```
   /root
     - image1.png
     /subfolder1
       - image2.png
       - image3.png
     /subfolder2
       - image4.png
   ```
2. Check the number displayed next to "/" in the sidebar

**Expected Result**: Shows "4" (total of all images in root and subdirectories)

---

### 3. AI Tagging
**Issue History**:
- Network errors not properly logged
- Request body too large in logs
- URL path concatenation issues

**Test Steps**:
1. Configure AI endpoint in Settings (use complete URL including path)
2. Import an image file
3. Check console logs for AI tagging process
4. Verify logs show:
   - URL being used (should be correct)
   - Request status (success/failure)
   - NOT the full request body (too large)

**Expected Result**:
- AI tagging completes successfully
- Logs are concise and informative
- Network errors are clearly reported with diagnostic info

---

### 4. Folder Management
**Test Steps**:
1. Create a new folder in the sidebar
2. Import assets to that folder
3. Verify folder shows correct asset count
4. Rename the folder
5. Verify assets are still accessible

**Expected Result**: All folder operations work correctly

---

## Quick Smoke Test (Run After Any Change)

1. **Launch**: Application starts without errors
2. **Library**: Can create and select a library
3. **Import**: Can import a single file (check it imports only once)
4. **Display**: Asset appears in grid
5. **Detail**: Can click asset to view details
6. **Tags**: Can add/remove tags
7. **Search**: Keyword search works
8. **Folders**: Can create folders and navigate

---

## Known Issues to Watch For

### Import Duplication
- **Symptom**: Same file appears multiple times after single import
- **Cause**: React StrictMode + multiple event listeners
- **Fix**: Global import flag in DropZone.tsx
- **Test**: Always verify import count in logs

### AI Request Logging
- **Symptom**: Console flooded with large JSON payloads
- **Fix**: Removed detailed request body logging
- **Test**: Check logs are concise during AI tagging

### URL Path Issues
- **Symptom**: 404 errors when calling AI API
- **Cause**: Incorrect path concatenation
- **Fix**: Smart URL detection in provider.rs
- **Test**: Verify URL in logs matches expected endpoint

---

## Automated Testing (Future)

### Unit Tests Needed
- [ ] Import deduplication logic
- [ ] URL path construction
- [ ] Folder count calculation
- [ ] Asset filtering by folder

### Integration Tests Needed
- [ ] End-to-end import flow
- [ ] AI tagging workflow
- [ ] Search functionality
- [ ] Folder operations

### E2E Tests Needed
- [ ] Complete user workflow: create library → import → tag → search
- [ ] Multi-file import
- [ ] Folder hierarchy operations

---

## Running Tests

### Manual Testing
1. Follow the test steps above
2. Check console logs for errors
3. Verify database state if needed

### Future: Automated Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

---

## Regression Prevention

Before committing changes:
1. Run the Quick Smoke Test
2. If touching import logic: Test import duplication
3. If touching folder logic: Test folder counts
4. If touching AI logic: Test with real API endpoint
5. Check console for unexpected errors or warnings

---

## Debug Tips

### Import Issues
- Check console for `[DropZone]` logs
- Look for `globalImportInProgress` flag state
- Verify `useImportAssets` mutation is called once

### AI Issues
- Check `=== AI Vision Request ===` logs
- Verify URL is correct
- Check for network error details

### Folder Count Issues
- Check query in Sidebar.tsx
- Verify `rootAssetsData?.total` value
- Check backend SQL query in queries.rs
