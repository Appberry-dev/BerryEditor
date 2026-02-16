import overridesJson from './api-overrides.json'
import {
  GENERATED_EDITOR_COMMANDS,
  GENERATED_INTERFACE_MEMBERS,
  GENERATED_MAIN_EXPORTS,
  GENERATED_NEXT_EXPORTS,
  GENERATED_SYMBOL_TYPES,
  type GeneratedInterfaceMember
} from './generated/api.generated'

export type ApiRow = {
  name: string
  type: string
  defaultValue?: string
  description: string
}

export type CommandRow = {
  command: string
  payload: string
  notes: string
}

export type ExportGroup = {
  title: string
  exports: ReadonlyArray<string>
}

type Overrides = {
  descriptions: Record<string, string>
  defaults: Record<string, string>
  commandPayloads: Record<string, string>
  commandNotes: Record<string, string>
}

const overrides = overridesJson as Overrides
const generatedMembers = GENERATED_INTERFACE_MEMBERS as Readonly<
  Record<string, ReadonlyArray<GeneratedInterfaceMember>>
>
const generatedSymbolTypes = GENERATED_SYMBOL_TYPES as Readonly<Record<string, string>>

function getMembers(interfaceName: string, kind?: GeneratedInterfaceMember['kind']) {
  const members = generatedMembers[interfaceName] ?? []
  if (!kind) return members
  return members.filter((member: GeneratedInterfaceMember) => member.kind === kind)
}

function descriptionFor(scope: string, name: string): string {
  return overrides.descriptions[`${scope}.${name}`] ?? 'No description provided.'
}

function defaultFor(scope: string, name: string): string | undefined {
  return overrides.defaults[`${scope}.${name}`]
}

function symbolType(symbol: string): string {
  if (symbol === 'EditorCommand') return 'string union'
  return generatedSymbolTypes[symbol] ?? 'unknown'
}

function rowFromProperty(scope: string, member: GeneratedInterfaceMember): ApiRow {
  const base: ApiRow = {
    name: member.name,
    type: member.type,
    description: descriptionFor(scope, member.name)
  }
  const defaultValue = defaultFor(scope, member.name)
  if (defaultValue !== undefined) {
    base.defaultValue = defaultValue
  }
  return base
}

function rowFromSymbol(symbol: string, displayName?: string, scopeName?: string): ApiRow {
  const name = displayName ?? symbol
  const scopeKey = scopeName ?? name
  const base: ApiRow = {
    name,
    type: symbolType(symbol),
    description: descriptionFor('Type', scopeKey)
  }
  const defaultValue = defaultFor('Type', scopeKey)
  if (defaultValue !== undefined) {
    base.defaultValue = defaultValue
  }
  return base
}

function rowFromTypeMember(owner: string, memberName: string): ApiRow {
  const member = getMembers(owner, 'property').find(
    (candidate: GeneratedInterfaceMember) => candidate.name === memberName
  )
  const displayName = `${owner}.${memberName}`

  const base: ApiRow = {
    name: displayName,
    type: member?.type ?? 'unknown',
    description: descriptionFor('Type', displayName)
  }

  const defaultValue = defaultFor('Type', displayName)
  if (defaultValue !== undefined) {
    base.defaultValue = defaultValue
  }

  return base
}

export const BERRY_EDITOR_PROPS: ReadonlyArray<ApiRow> = getMembers('BerryEditorProps', 'property').map(
  (member) => rowFromProperty('BerryEditorProps', member)
)

export const BERRY_EDITOR_HANDLE: ReadonlyArray<ApiRow> = getMembers('BerryEditorHandle', 'method').map(
  (member) => {
    const displayName = `${member.name}(${member.parameters.join(', ')})`
    const description =
      overrides.descriptions[`BerryEditorHandle.${displayName}`] ??
      overrides.descriptions[`BerryEditorHandle.${member.name}`] ??
      'No description provided.'
    return {
      name: displayName,
      type: member.type,
      description
    }
  }
)

export const BERRY_TOOLBAR_PROPS: ReadonlyArray<ApiRow> = getMembers(
  'BerryToolbarProps',
  'property'
).map((member) => rowFromProperty('BerryToolbarProps', member))

export const ADAPTER_TYPES: ReadonlyArray<ApiRow> = [
  rowFromSymbol('UploadContext'),
  rowFromSymbol('UploadResult'),
  rowFromSymbol('ImageAdapter'),
  rowFromSymbol('DocumentAdapter'),
  rowFromSymbol('MacroAdapter')
]

export const PICKER_TYPES: ReadonlyArray<ApiRow> = [
  rowFromSymbol('EmojiInsertMode'),
  rowFromSymbol('EmojiTone'),
  rowFromSymbol('EmojiGender'),
  rowFromSymbol('EmojiInsertPayload'),
  rowFromTypeMember('EmojiPickerOptions', 'insertMode'),
  rowFromTypeMember('EmojiPickerOptions', 'twemojiBaseUrl'),
  rowFromTypeMember('EmojiPickerOptions', 'useTwemoji'),
  rowFromTypeMember('EmojiPickerOptions', 'searchMaxResults'),
  rowFromTypeMember('EmojiPickerOptions', 'recentLimit'),
  rowFromTypeMember('EmojiPickerOptions', 'persistPreferences'),
  rowFromTypeMember('EmojiPickerOptions', 'persistRecents'),
  rowFromTypeMember('EmojiPickerOptions', 'showCategories'),
  rowFromTypeMember('ColorPickerOptions', 'swatches'),
  rowFromTypeMember('ColorPickerOptions', 'render'),
  rowFromTypeMember('ColorPickerOptions', 'adapter'),
  rowFromSymbol('ColorPickerKind'),
  rowFromTypeMember('ColorPickerAdapter', 'mount'),
  rowFromTypeMember('ColorPickerAdapterHandle', 'update'),
  rowFromTypeMember('ColorPickerAdapterHandle', 'destroy')
]

export const TOOLBAR_TYPES: ReadonlyArray<ApiRow> = [
  rowFromSymbol('BerryToolbarCategoryKey'),
  rowFromSymbol('BerryToolbarCategoryLayout'),
  rowFromSymbol('BerryToolbarLayout'),
  rowFromSymbol('BerryToolbarItemKey'),
  rowFromSymbol('BerryToolbarItemsConfig'),
  rowFromSymbol('FontFamilyOption'),
  rowFromSymbol('SelectionRange'),
  rowFromSymbol('HTMLSanitizeNoticeEvent')
]

export const EDITOR_COMMANDS: ReadonlyArray<CommandRow> = GENERATED_EDITOR_COMMANDS.map((command) => ({
  command,
  payload: overrides.commandPayloads[command] ?? '-',
  notes: overrides.commandNotes[command] ?? 'No command notes provided.'
}))

export const HTML_MODEL_EXPORTS: ReadonlyArray<ApiRow> = [
  rowFromSymbol('parseHTML', 'parseHTML(html)', 'parseHTML(html)'),
  rowFromSymbol('serializeHTML', 'serializeHTML(document)', 'serializeHTML(document)'),
  rowFromSymbol('sanitizeHTML', 'sanitizeHTML(html)', 'sanitizeHTML(html)'),
  rowFromSymbol('createEmptyDocument', 'createEmptyDocument()', 'createEmptyDocument()'),
  rowFromSymbol('documentFromHTML', 'documentFromHTML(html)', 'documentFromHTML(html)'),
  rowFromSymbol('documentToHTML', 'documentToHTML(document)', 'documentToHTML(document)')
]

export const MODEL_TYPES: ReadonlyArray<ApiRow> = [
  rowFromSymbol('InlineMark'),
  rowFromSymbol('AttachmentNode'),
  rowFromSymbol('InlineNode'),
  rowFromSymbol('ListType'),
  rowFromSymbol('BlockNode'),
  rowFromSymbol('EditorDocument')
]

export const ENGINE_EXPORTS: ReadonlyArray<ApiRow> = [
  rowFromSymbol('EditorEngine'),
  rowFromSymbol('EditorCommand')
]

export const EMOJI_CONSTANT_EXPORTS: ReadonlyArray<ApiRow> = [
  rowFromSymbol('UNICODE_EMOJI_VERSION'),
  rowFromSymbol('UNICODE_FULLY_QUALIFIED_COUNT'),
  rowFromSymbol('TWEMOJI_VERSION'),
  rowFromSymbol('DEFAULT_TWEMOJI_BASE_URL')
]

export const EXPORT_GROUPS: ReadonlyArray<ExportGroup> = [
  {
    title: 'Main package (`@appberry/berryeditor`)',
    exports: [...GENERATED_MAIN_EXPORTS]
  },
  {
    title: 'Next client entry (`@appberry/berryeditor/next`)',
    exports: [...GENERATED_NEXT_EXPORTS]
  },
  {
    title: 'Styles entry (`@appberry/berryeditor/styles.css`)',
    exports: ['BerryEditor base theme and component class styles']
  }
]
