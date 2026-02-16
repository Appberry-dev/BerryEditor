import type { CommandRow } from '../../../lib/docs/api-reference'
import { ApiTable } from '../../../components/docs/ApiTable'
import { Callout } from '../../../components/docs/Callout'
import { CodeBlock } from '../../../components/docs/CodeBlock'
import { DocsShell } from '../../../components/docs/DocsShell'
import {
  BERRY_TOOLBAR_PROPS,
  ADAPTER_TYPES,
  BERRY_EDITOR_HANDLE,
  BERRY_EDITOR_PROPS,
  EMOJI_CONSTANT_EXPORTS,
  ENGINE_EXPORTS,
  EDITOR_COMMANDS,
  EXPORT_GROUPS,
  HTML_MODEL_EXPORTS,
  MODEL_TYPES,
  PICKER_TYPES,
  TOOLBAR_TYPES
} from '../../../lib/docs/api-reference'

const toc = [
  { id: 'imports', label: 'Import Paths' },
  { id: 'props', label: 'BerryEditor Props' },
  { id: 'handle', label: 'Imperative Handle' },
  { id: 'toolbar-props', label: 'BerryToolbar Props' },
  { id: 'adapters', label: 'Adapters and Upload Types' },
  { id: 'pickers', label: 'Emoji and Color Pickers' },
  { id: 'toolbar', label: 'Toolbar Layout Types' },
  { id: 'commands', label: 'Editor Commands' },
  { id: 'engine', label: 'Engine Exports' },
  { id: 'html-model', label: 'HTML and Model Helpers' },
  { id: 'model-types', label: 'Model Types' },
  { id: 'emoji-constants', label: 'Emoji Constants' }
] as const

const mainImport = `import { BerryEditor } from '@appberry/berryeditor'
import '@appberry/berryeditor/styles.css'`

const nextImport = `'use client'
import { BerryEditor } from '@appberry/berryeditor/next'
import '@appberry/berryeditor/styles.css'`

function CommandTable({ rows }: { rows: ReadonlyArray<CommandRow> }) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            <th scope="col">Command</th>
            <th scope="col">Payload</th>
            <th scope="col">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.command}>
              <th scope="row">
                <code>{row.command}</code>
              </th>
              <td>
                <code>{row.payload}</code>
              </td>
              <td>{row.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ApiPage() {
  return (
    <DocsShell
      title="API Reference"
      lead="Comprehensive reference for public exports, props, types, and commands from BerryEditor."
      toc={toc}
    >
      <section id="imports">
        <h2>Import Paths</h2>
        <CodeBlock code={mainImport} />
        <CodeBlock code={nextImport} />
        <div className="docs-export-groups">
          {EXPORT_GROUPS.map((group) => (
            <section key={group.title} className="docs-export-group">
              <h3>{group.title}</h3>
              <ul>
                {group.exports.map((entry) => (
                  <li key={entry}>
                    <code>{entry}</code>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section id="props">
        <h2>BerryEditor Props</h2>
        <ApiTable rows={BERRY_EDITOR_PROPS} />
      </section>

      <section id="handle">
        <h2>Imperative Handle</h2>
        <ApiTable rows={BERRY_EDITOR_HANDLE} showDefault={false} />
      </section>

      <section id="toolbar-props">
        <h2>BerryToolbar Props</h2>
        <p>
          <code>BerryToolbar</code> is exported for advanced host integrations. It expects a
          command bridge and host-managed state.
        </p>
        <ApiTable rows={BERRY_TOOLBAR_PROPS} />
      </section>

      <section id="adapters">
        <h2>Adapters and Upload Types</h2>
        <ApiTable rows={ADAPTER_TYPES} showDefault={false} />
      </section>

      <section id="pickers">
        <h2>Emoji and Color Picker Types</h2>
        <ApiTable rows={PICKER_TYPES} />
      </section>

      <section id="toolbar">
        <h2>Toolbar Layout and Shared Types</h2>
        <ApiTable rows={TOOLBAR_TYPES} showDefault={false} />
      </section>

      <section id="commands">
        <h2>Editor Commands</h2>
        <CommandTable rows={EDITOR_COMMANDS} />
      </section>

      <section id="engine">
        <h2>Engine Exports</h2>
        <ApiTable rows={ENGINE_EXPORTS} showDefault={false} />
      </section>

      <section id="html-model">
        <h2>HTML and Model Helpers</h2>
        <ApiTable rows={HTML_MODEL_EXPORTS} showDefault={false} />
        <Callout title="Command Safety" tone="info">
          Command payloads such as URLs, colors, line-height, font family, and font size are
          validated internally before execution.
        </Callout>
      </section>

      <section id="model-types">
        <h2>Model Types</h2>
        <ApiTable rows={MODEL_TYPES} showDefault={false} />
      </section>

      <section id="emoji-constants">
        <h2>Emoji Catalog Constants</h2>
        <ApiTable rows={EMOJI_CONSTANT_EXPORTS} showDefault={false} />
      </section>
    </DocsShell>
  )
}
