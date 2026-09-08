export const requestPermission = async (
  permission: chrome.runtime.ManifestPermission,
): Promise<boolean> => {
  try {
    return await chrome.permissions.request({ permissions: [permission] })
  } catch {
    return false
  }
}
