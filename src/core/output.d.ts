export const coreInject: (args: {
  storage: ExtensionStorage
  fun?: (args: { storage: ExtensionStorage }) => void
}) => void
