export const coreInject: (args: {
  config: InjectionConfig
  fun?: (args: { config: InjectionConfig }) => void
}) => void
