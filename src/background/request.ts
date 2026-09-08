import { formatAcceptLanguage } from '@/config'

const LANGUAGE_RULE_ID = 1

const removeLanguageRule = async (): Promise<void> => {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [LANGUAGE_RULE_ID] })
}

export const requestHeaderValue = ({ settings, ipInfo }: ExtensionStorage): string => {
  const languages = settings.ipEnabled && settings.autoLanguages ? ipInfo?.languages : undefined
  return languages == null ? '' : formatAcceptLanguage(languages)
}

export const syncRequestHeader = async (storage: ExtensionStorage): Promise<void> => {
  const value = requestHeaderValue(storage)
  if (value === '') {
    await removeLanguageRule()
    return
  }

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
