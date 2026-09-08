declare namespace BackgroundMessage {
  type Event = {
    type: 'storage.get'
    $: ExtensionStorage
  } | {
    type: 'settings.set'
    settings: FingerprintSettings
    $: ExtensionStorage
  } | {
    type: 'ip.refresh'
    $: { ok: true; storage: ExtensionStorage } | { ok: false; message: string }
  } | {
    type: 'api.check'
    api: 'userScripts'
    $: boolean
  }

  type ResultField = '$'
  type Type = Event['type']
  type EventByType<T extends Type> = Extract<Event, { type: T }>
  type Param<T extends Event = Event> = T extends unknown ? Omit<T, ResultField> : never
  type ParamByType<T extends Type> = Param<EventByType<T>>
  type ResultByType<T extends Type> = EventByType<T> extends { $: infer R } ? R : never
  type Sender = <T extends Param>(message: T) => Promise<ResultByType<T['type']>>
  type Listener = (
    message: Param,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => boolean | void
}
