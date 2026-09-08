export const requestPermission = async (
  permission: chrome.runtime.ManifestPermissions,
): Promise<boolean> => {
  try {
    return await chrome.permissions.request({ permissions: [permission] })
  } catch {
    return false
  }
}
