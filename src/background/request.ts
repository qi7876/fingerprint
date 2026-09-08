import { getStorage } from './storage'
import { formatAcceptLanguage } from '@/config'

const LANGUAGE_RULE_ID = 1

const removeLanguageRule = async (): Promise<void> => {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [LANGUAGE_RULE_ID] })
}

export const reRequestHeader = async (): Promise<void> => {
  const { settings, ipInfo } = await getStorage()
  const languages = settings.ipEnabled && settings.autoLanguages ? ipInfo?.languages : undefined
  if (languages == null || languages.length === 0) {
    await removeLanguageRule()
    return
  }

  const value = formatAcceptLanguage(languages)

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [LANGUAGE_RULE_ID],
    addRules: [{
      id: LANGUAGE_RULE_ID,
      priority: 1,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders: [{
          header: 'Accept-Language',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value,
        }],
      },
      condition: {
        resourceTypes: Object.values(chrome.declarativeNetRequest.ResourceType),
      },
    }],
  })
}
