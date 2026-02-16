import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const CHECK_MODE = process.argv.includes('--check')

const PATHS = {
  index: path.join(ROOT, 'packages/berryeditor/src/index.ts'),
  nextClient: path.join(ROOT, 'packages/berryeditor/src/next/client.ts'),
  overrides: path.join(ROOT, 'apps/docs/lib/docs/api-overrides.json'),
  generated: path.join(ROOT, 'apps/docs/lib/docs/generated/api.generated.ts'),
  readme: path.join(ROOT, 'packages/berryeditor/README.md')
}

const README_MARKERS = {
  start: '<!-- GENERATED:API_START -->',
  end: '<!-- GENERATED:API_END -->'
}

const SECTION_SYMBOLS = {
  adapter: ['UploadContext', 'UploadResult', 'ImageAdapter', 'DocumentAdapter', 'MacroAdapter'],
  picker: [
    'EmojiInsertMode',
    'EmojiTone',
    'EmojiGender',
    'EmojiInsertPayload',
    'ColorPickerKind'
  ],
  toolbar: [
    'BerryToolbarCategoryKey',
    'BerryToolbarCategoryLayout',
    'BerryToolbarLayout',
    'BerryToolbarItemKey',
    'BerryToolbarItemsConfig',
    'FontFamilyOption',
    'SelectionRange',
    'HTMLSanitizeNoticeEvent'
  ],
  htmlModel: [
    'parseHTML',
    'serializeHTML',
    'sanitizeHTML',
    'createEmptyDocument',
    'documentFromHTML',
    'documentToHTML'
  ],
  model: ['InlineMark', 'AttachmentNode', 'InlineNode', 'ListType', 'BlockNode', 'EditorDocument'],
  engine: ['EditorEngine', 'EditorCommand'],
  emojiConstants: [
    'UNICODE_EMOJI_VERSION',
    'UNICODE_FULLY_QUALIFIED_COUNT',
    'TWEMOJI_VERSION',
    'DEFAULT_TWEMOJI_BASE_URL'
  ]
}

const INTERFACES = [
  'BerryEditorProps',
  'BerryEditorHandle',
  'BerryToolbarProps',
  'EmojiPickerOptions',
  'ColorPickerOptions',
  'ColorPickerAdapter',
  'ColorPickerAdapterHandle'
]

function normalizeText(value) {
  return value
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\|\s*/, '')
    .replace(/import\("[^"]+"\)\./g, '')
}

function sortObjectKeys(value) {
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(entries)
}

function toTsLiteral(value) {
  return JSON.stringify(value, null, 2)
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function collectSourceFiles(dirPath) {
  const out = []
  const stack = [dirPath]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(absolutePath)
        continue
      }
      if (!absolutePath.endsWith('.ts') && !absolutePath.endsWith('.tsx')) continue
      out.push(absolutePath)
    }
  }

  return out
}

function hasExportModifier(node) {
  return !!node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
}

function findSourceFile(program, filePath) {
  const normalized = path.normalize(filePath)
  return program.getSourceFiles().find((sourceFile) => path.normalize(sourceFile.fileName) === normalized)
}

function parseNamedReExports(sourceFilePath) {
  const sourceText = readFile(sourceFilePath)
  const sourceFile = ts.createSourceFile(sourceFilePath, sourceText, ts.ScriptTarget.ES2022, true)

  const exports = []

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue
    if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue

    for (const specifier of statement.exportClause.elements) {
      exports.push(specifier.name.text)
    }
  }

  return exports
}

function formatParameterName(parameter, index) {
  const rawName = ts.isIdentifier(parameter.name) ? parameter.name.text : `arg${index + 1}`
  const optionalToken = parameter.questionToken ? '?' : ''
  return `${rawName}${optionalToken}`
}

function formatParameter(parameter, index) {
  const nameText = formatParameterName(parameter, index)
  const optionalToken = parameter.questionToken ? '?' : ''
  const restPrefix = parameter.dotDotDotToken ? '...' : ''
  const typeText = parameter.type ? normalizeText(parameter.type.getText()) : 'unknown'
  const formattedName = optionalToken && nameText.endsWith('?') ? nameText : `${nameText}${optionalToken}`
  return `${restPrefix}${formattedName}: ${typeText}`
}

function formatMethodType(method) {
  const parameters = method.parameters.map((parameter, index) => formatParameter(parameter, index))
  const returnType = method.type ? normalizeText(method.type.getText()) : 'void'
  return {
    type: `(${parameters.join(', ')}) => ${returnType}`,
    parameters: method.parameters.map((parameter, index) => formatParameterName(parameter, index))
  }
}

function collectDeclarations(program, checker) {
  const declarationMap = new Map()
  const interfaceMap = new Map()

  for (const sourceFile of program.getSourceFiles()) {
    const fileName = path.normalize(sourceFile.fileName)
    if (fileName.includes(`${path.sep}node_modules${path.sep}`)) continue
    if (!fileName.includes(`${path.sep}packages${path.sep}berryeditor${path.sep}src${path.sep}`)) continue

    for (const statement of sourceFile.statements) {
      if (ts.isInterfaceDeclaration(statement) && hasExportModifier(statement) && statement.name) {
        interfaceMap.set(statement.name.text, statement)
        declarationMap.set(statement.name.text, statement)
        continue
      }

      if (ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement) && statement.name) {
        declarationMap.set(statement.name.text, statement)
        continue
      }

      if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement) && statement.name) {
        declarationMap.set(statement.name.text, statement)
        continue
      }

      if (ts.isClassDeclaration(statement) && hasExportModifier(statement) && statement.name) {
        declarationMap.set(statement.name.text, statement)
        continue
      }

      if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) continue
          declarationMap.set(declaration.name.text, declaration)
        }
      }
    }
  }

  function formatInterfaceType(interfaceDeclaration) {
    const parts = []

    for (const member of interfaceDeclaration.members) {
      if (ts.isPropertySignature(member) && member.name) {
        const memberName = member.name.getText()
        const optionalToken = member.questionToken ? '?' : ''
        const typeText = member.type ? normalizeText(member.type.getText()) : 'unknown'
        parts.push(`${memberName}${optionalToken}: ${typeText}`)
        continue
      }

      if (ts.isMethodSignature(member) && member.name) {
        const memberName = member.name.getText()
        const optionalToken = member.questionToken ? '?' : ''
        const methodType = formatMethodType(member)
        parts.push(`${memberName}${optionalToken}: ${methodType.type}`)
      }
    }

    return `{ ${parts.join('; ')} }`
  }

  function getTypeText(symbolName) {
    const declaration = declarationMap.get(symbolName)
    if (!declaration) return 'unknown'

    if (ts.isClassDeclaration(declaration)) {
      return 'class'
    }

    if (ts.isInterfaceDeclaration(declaration)) {
      return formatInterfaceType(declaration)
    }

    if (ts.isTypeAliasDeclaration(declaration)) {
      return normalizeText(declaration.type.getText())
    }

    if (ts.isFunctionDeclaration(declaration)) {
      const parameters = declaration.parameters.map((parameter, index) =>
        formatParameter(parameter, index)
      )
      const returnType = declaration.type
        ? normalizeText(declaration.type.getText())
        : checker.typeToString(checker.getTypeAtLocation(declaration), declaration)
      return `(${parameters.join(', ')}) => ${returnType}`
    }

    if (ts.isVariableDeclaration(declaration)) {
      if (declaration.type) {
        return normalizeText(declaration.type.getText())
      }

      const type = checker.getTypeAtLocation(declaration)
      return checker.typeToString(type, declaration, ts.TypeFormatFlags.NoTruncation)
    }

    return 'unknown'
  }

  function getInterfaceMembers(interfaceName) {
    const interfaceDeclaration = interfaceMap.get(interfaceName)
    if (!interfaceDeclaration) return []

    const members = []

    for (const member of interfaceDeclaration.members) {
      if (ts.isPropertySignature(member) && member.name) {
        members.push({
          name: member.name.getText(),
          type: member.type ? normalizeText(member.type.getText()) : 'unknown',
          optional: !!member.questionToken,
          kind: 'property',
          parameters: []
        })
        continue
      }

      if (ts.isMethodSignature(member) && member.name) {
        const methodType = formatMethodType(member)
        members.push({
          name: member.name.getText(),
          type: methodType.type,
          optional: !!member.questionToken,
          kind: 'method',
          parameters: methodType.parameters
        })
      }
    }

    return members
  }

  return {
    getTypeText,
    getInterfaceMembers
  }
}

function collectEditorCommands(program) {
  const commandsPath = path.join(ROOT, 'packages/berryeditor/src/core/commands.ts')
  const sourceFile = findSourceFile(program, commandsPath)
  if (!sourceFile) {
    throw new Error(`Unable to load ${commandsPath}`)
  }

  for (const statement of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(statement)) continue
    if (statement.name.text !== 'EditorCommand') continue
    if (!ts.isUnionTypeNode(statement.type)) continue

    return statement.type.types
      .filter((typeNode) => ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal))
      .map((typeNode) => typeNode.literal.text)
  }

  throw new Error('EditorCommand type union not found in commands.ts')
}

function buildReadmeTable(headers, rows) {
  const sanitizeCell = (value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim()

  const headerLine = `| ${headers.map((value) => sanitizeCell(value)).join(' | ')} |`
  const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`
  const rowLines = rows.map((row) => `| ${row.map((value) => sanitizeCell(value)).join(' | ')} |`)

  return [headerLine, dividerLine, ...rowLines].join('\n')
}

function buildGeneratedReadmeSection(data, overrides) {
  const editorPropRows = data.interfaceMembers.BerryEditorProps.map((member) => {
    const key = `BerryEditorProps.${member.name}`
    const defaultValue = overrides.defaults[key] ?? '-'
    const description = overrides.descriptions[key] ?? 'No description provided.'
    return [
      `\`${member.name}\``,
      `\`${member.type}\``,
      defaultValue === '-' ? '-' : `\`${defaultValue}\``,
      description
    ]
  })

  const toolbarPropRows = data.interfaceMembers.BerryToolbarProps.map((member) => {
    const key = `BerryToolbarProps.${member.name}`
    const defaultValue = overrides.defaults[key] ?? '-'
    const description = overrides.descriptions[key] ?? 'No description provided.'
    return [
      `\`${member.name}\``,
      `\`${member.type}\``,
      defaultValue === '-' ? '-' : `\`${defaultValue}\``,
      description
    ]
  })

  const handleRows = data.interfaceMembers.BerryEditorHandle.map((member) => {
    const displayName = `${member.name}(${member.parameters.join(', ')})`
    const descriptionKey = `BerryEditorHandle.${displayName}`
    const fallbackDescriptionKey = `BerryEditorHandle.${member.name}`
    const description =
      overrides.descriptions[descriptionKey] ??
      overrides.descriptions[fallbackDescriptionKey] ??
      'No description provided.'

    return [`\`${displayName}\``, `\`${member.type}\``, description]
  })

  const commandRows = data.commands.map((command) => [
    `\`${command}\``,
    `\`${overrides.commandPayloads[command] ?? '-'}\``,
    overrides.commandNotes[command] ?? 'No command notes provided.'
  ])

  const lines = []
  lines.push('### Main Package Exports')
  lines.push('')
  lines.push(data.mainExports.map((entry) => `- ` + '`' + entry + '`').join('\n'))
  lines.push('')
  lines.push('### Next Client Entry Exports')
  lines.push('')
  lines.push(data.nextExports.map((entry) => `- ` + '`' + entry + '`').join('\n'))
  lines.push('')
  lines.push('### BerryEditor Props')
  lines.push('')
  lines.push(buildReadmeTable(['Prop', 'Type', 'Default', 'Notes'], editorPropRows))
  lines.push('')
  lines.push('### BerryToolbar Props')
  lines.push('')
  lines.push(buildReadmeTable(['Prop', 'Type', 'Default', 'Notes'], toolbarPropRows))
  lines.push('')
  lines.push('### BerryEditor Handle')
  lines.push('')
  lines.push(buildReadmeTable(['Method', 'Signature', 'Notes'], handleRows))
  lines.push('')
  lines.push('### Editor Commands')
  lines.push('')
  lines.push(buildReadmeTable(['Command', 'Payload', 'Notes'], commandRows))

  return lines.join('\n')
}

function replaceReadmeGeneratedSection(readmeText, generatedSection) {
  const startMarker = README_MARKERS.start
  const endMarker = README_MARKERS.end
  const markerBlock = `${startMarker}\n${generatedSection}\n${endMarker}`

  if (readmeText.includes(startMarker) && readmeText.includes(endMarker)) {
    const startIndex = readmeText.indexOf(startMarker)
    const endIndex = readmeText.indexOf(endMarker)
    const before = readmeText.slice(0, startIndex)
    const after = readmeText.slice(endIndex + endMarker.length)
    return `${before}${markerBlock}${after}`
  }

  const apiStartMatch = readmeText.indexOf('## API Reference')
  const securityStartMatch = readmeText.indexOf('## Security and Sanitization')

  if (apiStartMatch === -1 || securityStartMatch === -1 || securityStartMatch <= apiStartMatch) {
    throw new Error('Unable to locate README API section for generated marker insertion.')
  }

  const before = readmeText.slice(0, apiStartMatch)
  const after = readmeText.slice(securityStartMatch)

  return `${before}## API Reference\n\n${markerBlock}\n\n${after}`
}

function writeOrCheck(filePath, nextContent, failures) {
  const previousContent = fs.existsSync(filePath) ? readFile(filePath) : ''
  const changed = previousContent !== nextContent

  if (CHECK_MODE) {
    if (changed) {
      failures.push(path.relative(ROOT, filePath))
    }
    return
  }

  if (!changed) return
  ensureDir(filePath)
  fs.writeFileSync(filePath, nextContent)
  console.log(`updated ${path.relative(ROOT, filePath)}`)
}

function main() {
  const overrides = JSON.parse(readFile(PATHS.overrides))

  const sourceFiles = collectSourceFiles(path.join(ROOT, 'packages/berryeditor/src'))
  const program = ts.createProgram(sourceFiles, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    jsx: ts.JsxEmit.Preserve,
    skipLibCheck: true,
    noEmit: true,
    allowJs: false
  })
  const checker = program.getTypeChecker()

  const mainExports = parseNamedReExports(PATHS.index)
  const nextExports = parseNamedReExports(PATHS.nextClient)

  const declarationCollector = collectDeclarations(program, checker)

  const interfaceMembers = {}
  for (const interfaceName of INTERFACES) {
    interfaceMembers[interfaceName] = declarationCollector.getInterfaceMembers(interfaceName)
  }

  const commands = collectEditorCommands(program)

  const allSymbols = new Set([
    ...mainExports,
    ...nextExports,
    ...SECTION_SYMBOLS.adapter,
    ...SECTION_SYMBOLS.picker,
    ...SECTION_SYMBOLS.toolbar,
    ...SECTION_SYMBOLS.htmlModel,
    ...SECTION_SYMBOLS.model,
    ...SECTION_SYMBOLS.engine,
    ...SECTION_SYMBOLS.emojiConstants
  ])

  const symbolTypes = {}
  for (const symbolName of allSymbols) {
    symbolTypes[symbolName] = declarationCollector.getTypeText(symbolName)
  }
  const unknownSymbols = Object.entries(symbolTypes)
    .filter(([, type]) => type === 'unknown')
    .map(([symbol]) => symbol)
  if (unknownSymbols.length > 0) {
    throw new Error(`Unable to resolve declaration types for: ${unknownSymbols.join(', ')}`)
  }

  const generatedData = {
    mainExports,
    nextExports,
    commands,
    interfaceMembers,
    symbolTypes: sortObjectKeys(symbolTypes)
  }

  const generatedFileContent = `/* This file is auto-generated by scripts/generate-docs-api.mjs. */\n\nexport type GeneratedInterfaceMember = {\n  name: string\n  type: string\n  optional: boolean\n  kind: 'property' | 'method'\n  parameters: readonly string[]\n}\n\nexport const GENERATED_MAIN_EXPORTS = ${toTsLiteral(generatedData.mainExports)} as const\n\nexport const GENERATED_NEXT_EXPORTS = ${toTsLiteral(generatedData.nextExports)} as const\n\nexport const GENERATED_EDITOR_COMMANDS = ${toTsLiteral(generatedData.commands)} as const\n\nexport const GENERATED_INTERFACE_MEMBERS = ${toTsLiteral(generatedData.interfaceMembers)} as const\n\nexport const GENERATED_SYMBOL_TYPES = ${toTsLiteral(generatedData.symbolTypes)} as const\n`

  const readmeSection = buildGeneratedReadmeSection(generatedData, overrides)
  const nextReadme = replaceReadmeGeneratedSection(readFile(PATHS.readme), readmeSection)

  const failures = []
  writeOrCheck(PATHS.generated, generatedFileContent, failures)
  writeOrCheck(PATHS.readme, nextReadme, failures)

  if (CHECK_MODE && failures.length > 0) {
    console.error('Documentation artifacts are out of date:')
    for (const file of failures) {
      console.error(`- ${file}`)
    }
    process.exit(1)
  }

  if (CHECK_MODE) {
    console.log('Documentation artifacts are up to date.')
  }
}

main()
