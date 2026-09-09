declare const _args: unknown

type CoreArguments = {
  config: InjectionConfig
}

type RuntimeGlobal = typeof globalThis & {
  Navigator?: typeof Navigator
  window?: Window & typeof globalThis
}

const args = _args as CoreArguments

const install = (runtime: RuntimeGlobal, config: InjectionConfig): void => {
  const marker = '__fingerprint_injected__'
  try {
    if ((runtime as unknown as Record<string, unknown>)[marker]) return
    Object.defineProperty(runtime, marker, { value: true })
  } catch {
    return
  }

  const wrap = <T extends Function>(target: T, handler: ProxyHandler<T>): T => (
    new Proxy(target, handler)
  )

  const { disableWebRtc, languages, timezone } = config

  const installLanguages = (): void => {
    if (languages == null || languages.length === 0) return
    try {
      const navigatorPrototype = runtime.Navigator?.prototype
      if (navigatorPrototype == null) return
      const stableLanguages = Object.freeze([...languages])
      const languageDescriptor = Object.getOwnPropertyDescriptor(navigatorPrototype, 'language')
      const languagesDescriptor = Object.getOwnPropertyDescriptor(navigatorPrototype, 'languages')
      if (languageDescriptor?.get != null) {
        Object.defineProperty(navigatorPrototype, 'language', {
          ...languageDescriptor,
          get: wrap(languageDescriptor.get, {
            apply(target, thisArg, callArgs) {
              Reflect.apply(target, thisArg, callArgs)
              return stableLanguages[0]
            },
          }),
        })
      }
      if (languagesDescriptor?.get != null) {
        Object.defineProperty(navigatorPrototype, 'languages', {
          ...languagesDescriptor,
          get: wrap(languagesDescriptor.get, {
            apply(target, thisArg, callArgs) {
              Reflect.apply(target, thisArg, callArgs)
              return stableLanguages
            },
          }),
        })
      }
    } catch {
      // Keep the native language APIs when the host does not allow patching them.
    }
  }

  const installTimezone = (): void => {
    if (timezone == null) return
    try {
      const NativeDateTimeFormat = runtime.Intl.DateTimeFormat
      const withTimezone = (options: unknown): Intl.DateTimeFormatOptions => {
        if (options === undefined) return { timeZone: timezone }
        const target = Object(options) as Intl.DateTimeFormatOptions
        return new Proxy(target, {
          get(optionTarget, property) {
            const value = Reflect.get(optionTarget, property, optionTarget)
            return property === 'timeZone' && value === undefined ? timezone : value
          },
        })
      }
      const withDefaults = (
        formatterArgs: ConstructorParameters<typeof Intl.DateTimeFormat>,
      ): ConstructorParameters<typeof Intl.DateTimeFormat> => {
        const [locales, options] = formatterArgs as unknown as [unknown, unknown]
        if (options === null) return formatterArgs
        return [
          locales === undefined ? languages : locales,
          withTimezone(options),
        ] as ConstructorParameters<typeof Intl.DateTimeFormat>
      }

      const DateTimeFormat = wrap(NativeDateTimeFormat, {
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

      const datePrototype = runtime.Date.prototype
      const nativeGetTime = datePrototype.getTime
      const nativeGetTimezoneOffset = datePrototype.getTimezoneOffset
      const offsetFormatter = new NativeDateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset',
      })

      const getTimezoneOffset = wrap(nativeGetTimezoneOffset, {
        apply(target, thisArg: Date) {
          const timestamp = Reflect.apply(nativeGetTime, thisArg, [])
          if (!Number.isFinite(timestamp)) return Reflect.apply(target, thisArg, [])
          try {
            const name = offsetFormatter.formatToParts(thisArg)
              .find((part) => part.type === 'timeZoneName')?.value
            if (name == null || name === 'GMT') return 0
            const match = name.match(/GMT([+-])(\d{2}):(\d{2})/)
            if (match == null) return Reflect.apply(target, thisArg, [])
            const minutes = Number(match[2]) * 60 + Number(match[3])
            return match[1] === '+' ? -minutes : minutes
          } catch {
            return Reflect.apply(target, thisArg, [])
          }
        },
      })

      const localeMethods = ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'] as const
      const localeProxies = localeMethods.map((key) => {
        const target = datePrototype[key]
        const proxy = wrap(target, {
          apply(_target, thisArg: Date, callArgs: Parameters<typeof target>) {
            const [locales, options] = callArgs as unknown as [unknown, unknown]
            if (options === null) return Reflect.apply(target, thisArg, callArgs)
            return Reflect.apply(target, thisArg, [
              locales === undefined ? languages : locales,
              withTimezone(options),
            ])
          },
        }) as typeof target
        return [key, proxy] as const
      })

      try {
        runtime.Intl.DateTimeFormat = DateTimeFormat
      } catch {
        return
      }
      if (runtime.Intl.DateTimeFormat !== DateTimeFormat) return

      try {
        const constructorDescriptor = Object.getOwnPropertyDescriptor(
          NativeDateTimeFormat.prototype,
          'constructor',
        )
        if (constructorDescriptor != null) {
          Object.defineProperty(NativeDateTimeFormat.prototype, 'constructor', {
            ...constructorDescriptor,
            value: DateTimeFormat,
          })
        }
      } catch {
        // Constructor identity is best-effort on locked-down runtimes.
      }
      try {
        datePrototype.getTimezoneOffset = getTimezoneOffset
      } catch {
        // Leave the native offset method in place when it is read-only.
      }
      for (const [key, proxy] of localeProxies) {
        try {
          datePrototype[key] = proxy
        } catch {
          // Leave individual native locale methods in place when they are read-only.
        }
      }
    } catch {
      // A failed timezone patch must not escape into the host page.
    }
  }

  const disablePeerConnection = (): void => {
    if (!disableWebRtc || runtime.window == null) return
    const win = runtime.window
    const peerConnectionKeys = [
      'RTCPeerConnection',
      'mozRTCPeerConnection',
      'webkitRTCPeerConnection',
    ]
    for (const key of peerConnectionKeys) {
      if (!(key in win)) continue
      try {
        Object.defineProperty(win, key, {
          configurable: true,
          enumerable: false,
          value: undefined,
        })
      } catch {
        // Keep an individual native alias when the host does not allow patching it.
      }
    }
  }

  installLanguages()
  installTimezone()
  disablePeerConnection()
}

install(globalThis as RuntimeGlobal, args.config)
