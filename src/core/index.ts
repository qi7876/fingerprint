declare const coreInject: (args: CoreArguments) => void
declare const _args: unknown

type CoreArguments = {
  storage: ExtensionStorage
  fun?: (args: CoreArguments) => void
}

type RuntimeGlobal = typeof globalThis & {
  Navigator?: typeof Navigator
  WorkerNavigator?: typeof WorkerNavigator
  window?: Window & typeof globalThis
}

const args = _args as CoreArguments

const install = (runtime: RuntimeGlobal, storage: ExtensionStorage): void => {
  const marker = '__fingerprint_injected__'
  if ((runtime as unknown as Record<string, unknown>)[marker]) return
  Object.defineProperty(runtime, marker, { value: true })

  const proxyTargets = new WeakMap<Function, Function>()
  const wrap = <T extends Function>(target: T, handler: ProxyHandler<T>): T => {
    const proxy = new Proxy(target, handler)
    proxyTargets.set(proxy, target)
    return proxy
  }

  const nativeToString = runtime.Function.prototype.toString
  runtime.Function.prototype.toString = wrap(nativeToString, {
    apply(target, thisArg, callArgs) {
      return Reflect.apply(target, proxyTargets.get(thisArg as Function) ?? thisArg, callArgs)
    },
  })

  const { settings, ipInfo } = storage
  const languages = settings.ipEnabled && settings.autoLanguages ? ipInfo?.languages : undefined
  const timezone = settings.ipEnabled && settings.autoTimezone ? ipInfo?.timezone : undefined

  if (languages != null && languages.length > 0) {
    const navigatorPrototype = runtime.Navigator?.prototype ?? runtime.WorkerNavigator?.prototype
    if (navigatorPrototype != null) {
      Object.defineProperties(navigatorPrototype, {
        language: {
          configurable: true,
          enumerable: true,
          get: wrap(function language(): string {
            return languages[0]
          }, {}),
        },
        languages: {
          configurable: true,
          enumerable: true,
          get: wrap(function languagesGetter(): readonly string[] {
            return Object.freeze([...languages])
          }, {}),
        },
      })
    }
  }

  if (timezone) {
    const NativeDate = runtime.Date
    const NativeDateTimeFormat = runtime.Intl.DateTimeFormat
    const withDefaults = (
      formatterArgs: ConstructorParameters<typeof Intl.DateTimeFormat>,
    ): ConstructorParameters<typeof Intl.DateTimeFormat> => {
      const [locales, options] = formatterArgs
      return [
        locales ?? languages,
        { timeZone: timezone, ...options },
      ]
    }

    runtime.Intl.DateTimeFormat = wrap(NativeDateTimeFormat, {
      construct(target, formatterArgs, newTarget) {
        return Reflect.construct(
          target,
          withDefaults(formatterArgs as ConstructorParameters<typeof Intl.DateTimeFormat>),
          newTarget,
        )
      },
      apply(target, thisArg, formatterArgs) {
        return Reflect.apply(
          target,
          thisArg,
          withDefaults(formatterArgs as ConstructorParameters<typeof Intl.DateTimeFormat>),
        )
      },
    })

    const offsetFormatter = new NativeDateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    })
    const partsFormatter = new NativeDateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    const displayFormatter = new NativeDateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'longOffset',
    })

    const dateParts = (date: Date): Record<string, string> => (
      Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]))
    )
    const datePrototype = runtime.Date.prototype
    const nativeGetTimezoneOffset = datePrototype.getTimezoneOffset
    const offset = (date: Date): number => {
      const name = offsetFormatter.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value
      if (name == null || name === 'GMT') return 0
      const match = name.match(/GMT([+-])(\d{2}):(\d{2})/)
      if (match == null) return Reflect.apply(nativeGetTimezoneOffset, date, [])
      const minutes = Number(match[2]) * 60 + Number(match[3])
      return match[1] === '+' ? -minutes : minutes
    }

    datePrototype.getTimezoneOffset = wrap(nativeGetTimezoneOffset, {
      apply(_target, thisArg: Date) {
        return offset(thisArg)
      },
    })

    const numericGetters: Array<[keyof Date, string, number]> = [
      ['getFullYear', 'year', 0],
      ['getMonth', 'month', -1],
      ['getDate', 'day', 0],
      ['getHours', 'hour', 0],
      ['getMinutes', 'minute', 0],
      ['getSeconds', 'second', 0],
    ]
    for (const [key, part, adjustment] of numericGetters) {
      const target = datePrototype[key]
      if (typeof target !== 'function') continue
      Object.defineProperty(datePrototype, key, {
        configurable: true,
        writable: true,
        value: wrap(target, {
          apply(_target, thisArg: Date) {
            return Number(dateParts(thisArg)[part]) + adjustment
          },
        }),
      })
    }

    const weekdays: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    datePrototype.getDay = wrap(datePrototype.getDay, {
      apply(_target, thisArg: Date) {
        return weekdays[dateParts(thisArg).weekday] ?? 0
      },
    })

    const displayParts = (date: Date): Record<string, string> => (
      Object.fromEntries(displayFormatter.formatToParts(date).map((part) => [part.type, part.value]))
    )
    const displayMethods: Record<string, (parts: Record<string, string>) => string> = {
      toString: (parts: Record<string, string>) => (
        `${parts.weekday} ${parts.month} ${parts.day} ${parts.year} `
        + `${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName.replace(':', '')}`
      ),
      toDateString: (parts: Record<string, string>) => `${parts.weekday} ${parts.month} ${parts.day} ${parts.year}`,
      toTimeString: (parts: Record<string, string>) => (
        `${parts.hour}:${parts.minute}:${parts.second} ${parts.timeZoneName.replace(':', '')}`
      ),
    }
    for (const [key, format] of Object.entries(displayMethods)) {
      const dateKey = key as keyof Date
      const target = datePrototype[dateKey]
      if (typeof target !== 'function' || format == null) continue
      Object.defineProperty(datePrototype, dateKey, {
        configurable: true,
        writable: true,
        value: wrap(target, {
          apply(_target, thisArg: Date) {
            return format(displayParts(thisArg))
          },
        }),
      })
    }

    for (const key of ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'] as const) {
      const target = datePrototype[key]
      datePrototype[key] = wrap(target, {
        apply(_target, thisArg: Date, callArgs: Parameters<typeof target>) {
          const [locales, options] = callArgs
          return Reflect.apply(target, thisArg, [
            locales ?? languages,
            { timeZone: timezone, ...options },
          ])
        },
      }) as typeof target
    }

    runtime.Date = wrap(NativeDate, {
      construct(target, dateArgs, newTarget) {
        return Reflect.construct(target, dateArgs, newTarget)
      },
      apply() {
        return new NativeDate().toString()
      },
    })
  }

  if (!settings.webrtcEnabled && runtime.window != null) {
    const win = runtime.window
    const disableProperty = (target: object, key: string): void => {
      try {
        Object.defineProperty(target, key, {
          configurable: true,
          enumerable: false,
          value: undefined,
        })
      } catch {
        // Some browser-owned properties are not configurable.
      }
    }
    const navigatorKeys = ['mediaDevices', 'getUserMedia', 'mozGetUserMedia', 'webkitGetUserMedia']
    for (const key of navigatorKeys) {
      disableProperty(win.navigator, key)
      disableProperty(win.Navigator.prototype, key)
    }
    const windowKeys = [
      'RTCDataChannel', 'RTCIceCandidate', 'RTCConfiguration', 'MediaStreamTrack',
      'RTCPeerConnection', 'RTCSessionDescription', 'mozRTCPeerConnection',
      'mozRTCSessionDescription', 'webkitRTCPeerConnection', 'webkitRTCSessionDescription',
    ]
    for (const key of windowKeys) {
      if (key in win) disableProperty(win, key)
    }
  }

  if (runtime.window != null) {
    const win = runtime.window
    const injectFrame = (frame: HTMLIFrameElement): void => {
      try {
        if (frame.contentWindow != null) install(frame.contentWindow as unknown as RuntimeGlobal, storage)
      } catch {
        // Cross-origin frames are covered by allFrames injection.
      }
    }
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLIFrameElement) injectFrame(node)
          if (node instanceof Element) {
            node.querySelectorAll('iframe').forEach(injectFrame)
          }
        }
      }
    })
    observer.observe(win.document.documentElement, { childList: true, subtree: true })
    win.addEventListener('load', () => observer.disconnect(), { once: true })

    const blobs = new Map<string, Blob>()
    const nativeCreateObjectUrl = win.URL.createObjectURL
    win.URL.createObjectURL = wrap(nativeCreateObjectUrl, {
      apply(target, thisArg, callArgs) {
        const url = Reflect.apply(target, thisArg, callArgs)
        if (callArgs[0] instanceof Blob) blobs.set(url, callArgs[0])
        return url
      },
    })
    const nativeRevokeObjectUrl = win.URL.revokeObjectURL
    win.URL.revokeObjectURL = wrap(nativeRevokeObjectUrl, {
      apply(target, thisArg, callArgs) {
        blobs.delete(callArgs[0])
        return Reflect.apply(target, thisArg, callArgs)
      },
    })

    const makeWorkerProxy = <T extends typeof Worker | typeof SharedWorker>(NativeWorker: T): T => (
      wrap(NativeWorker, {
        construct(target, workerArgs, newTarget) {
          const source = workerArgs[0]
          if (typeof source === 'string' && source.startsWith('blob:')) {
            const original = blobs.get(source)
            const inject = args.fun ?? coreInject
            if (original != null && inject != null) {
              const blob = new Blob([
                `(${inject.toString()})({storage:${JSON.stringify(storage)}});\n`,
                original,
              ], { type: 'application/javascript' })
              workerArgs[0] = URL.createObjectURL(blob)
            }
          }
          return Reflect.construct(target, workerArgs, newTarget)
        },
      }) as T
    )
    if (win.Worker != null) win.Worker = makeWorkerProxy(win.Worker)
    if (win.SharedWorker != null) win.SharedWorker = makeWorkerProxy(win.SharedWorker)
  }
}

install(globalThis as RuntimeGlobal, args.storage)
