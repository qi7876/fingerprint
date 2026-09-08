export const sendToBackground: BackgroundMessage.Sender = (message) => (
  chrome.runtime.sendMessage(message)
)
