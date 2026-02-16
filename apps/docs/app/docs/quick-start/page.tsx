import { Callout } from '../../../components/docs/Callout'
import { CodeBlock } from '../../../components/docs/CodeBlock'
import { DocsShell } from '../../../components/docs/DocsShell'
import {
  QUICK_START_ADAPTERS,
  QUICK_START_MACROS,
  QUICK_START_BERRYPICKR,
  QUICK_START_BASIC,
  QUICK_START_CONTROLLED,
  QUICK_START_EMOJI_PICKER,
  QUICK_START_FILE_MANAGER,
  QUICK_START_HTML_MODE,
  QUICK_START_INSTALL,
  QUICK_START_NEXT_APP_ROUTER,
  QUICK_START_TOOLBAR_ITEMS
} from '../../../lib/docs/quick-start-content'

const toc = [
  { id: 'install', label: 'Install' },
  { id: 'basic', label: 'Basic React Usage' },
  { id: 'next', label: 'Next App Router' },
  { id: 'state', label: 'Controlled State' },
  { id: 'toolbar-items', label: 'Toolbar Item Visibility' },
  { id: 'emoji-picker', label: 'Emoji Picker Options' },
  { id: 'adapters', label: 'Adapters' },
  { id: 'macros', label: 'Macros' },
  { id: 'file-manager', label: 'File Upload and Manager Integration' },
  { id: 'berrypickr', label: 'BerryPickr Color Picker Integration' },
  { id: 'html-mode', label: 'HTML Mode and Sanitization' }
] as const

export default function QuickStartPage() {
  return (
    <DocsShell
      title="Quick Start"
      lead="Get BerryEditor running with React or Next App Router, then layer in adapters, macros, and HTML mode behavior."
      toc={toc}
    >
      <section id="install">
        <h2>Install</h2>
        <CodeBlock code={QUICK_START_INSTALL} language="bash" />
        <p>
          Import the stylesheet once in your app shell:
          <code> @appberry/berryeditor/styles.css</code>.
        </p>
      </section>

      <section id="basic">
        <h2>Basic React Usage</h2>
        <CodeBlock code={QUICK_START_BASIC} />
      </section>

      <section id="next">
        <h2>Next App Router</h2>
        <p>
          For App Router, use the client entrypoint in a <code>'use client'</code> component.
        </p>
        <CodeBlock code={QUICK_START_NEXT_APP_ROUTER} />
      </section>

      <section id="state">
        <h2>Controlled State</h2>
        <p>
          Use controlled mode when your app owns the HTML state source of truth. Uncontrolled mode
          is usually enough for direct form submissions.
        </p>
        <CodeBlock code={QUICK_START_CONTROLLED} />
      </section>

      <section id="toolbar-items">
        <h2>Toolbar Item Visibility</h2>
        <p>
          Use <code>toolbarItems.showOnly</code> to whitelist controls, or{' '}
          <code>toolbarItems.hideOnly</code> to hide specific controls while keeping everything else
          visible by default.
        </p>
        <ul>
          <li>
            <code>showOnly</code> is useful for role-specific editors and simplified authoring
            flows.
          </li>
          <li>
            <code>hideOnly</code> is useful when you want the default toolbar minus a few controls.
          </li>
          <li>
            If both are set, <code>hideOnly</code> wins.
          </li>
        </ul>
        <CodeBlock code={QUICK_START_TOOLBAR_ITEMS} />
      </section>

      <section id="emoji-picker">
        <h2>Emoji Picker Options</h2>
        <p>
          Use <code>emojiPicker.useTwemoji</code> to control how picker tiles render, and{' '}
          <code>emojiPicker.insertMode</code> to control what gets inserted into editor content.
        </p>
        <ul>
          <li>
            <code>useTwemoji: true</code> renders Twemoji image assets in picker tiles.
          </li>
          <li>
            <code>useTwemoji: false</code> renders native Unicode glyphs in picker tiles.
          </li>
          <li>
            <code>insertMode: &apos;twemojiImage&apos;</code> inserts Twemoji image HTML.
          </li>
          <li>
            <code>insertMode: &apos;unicode&apos;</code> inserts plain Unicode text.
          </li>
        </ul>
        <CodeBlock code={QUICK_START_EMOJI_PICKER} />
      </section>

      <section id="adapters">
        <h2>Adapters</h2>
        <p>
          File uploads are app-defined. BerryEditor inserts placeholders, tracks progress, and
          resolves attachment HTML from your adapter result.
        </p>
        <CodeBlock code={QUICK_START_ADAPTERS} />
      </section>

      <section id="macros">
        <h2>Macros</h2>
        <p>
          Pass <code>macroAdapter</code> to enable macro search in the Insert toolbar. The editor
          calls <code>search(query)</code> for flyout results and <code>resolve(macroId)</code> when
          a macro is selected.
        </p>
        <CodeBlock code={QUICK_START_MACROS} />
        <Callout title="Macro Content" tone="info">
          Macro HTML is sanitized before insertion. Keep backend validation rules if macro output
          includes user-provided values.
        </Callout>
      </section>

      <section id="file-manager">
        <h2>File Upload and Manager Integration</h2>
        <p>
          Use <code>imageAdapter</code> and <code>documentAdapter</code> for uploads, then connect
          your own asset manager/CMS picker for selecting existing files and inserting them with the
          editor ref command API.
        </p>
        <CodeBlock code={QUICK_START_FILE_MANAGER} />
      </section>

      <section id="berrypickr">
        <h2>BerryPickr Color Picker Integration</h2>
        <p>
          You can mount your own color picker through <code>colorPicker.render</code> or{' '}
          <code>colorPicker.adapter</code>. The example below wires BerryPickr as the custom picker.
          BerryPickr docs:{' '}
          <a href="https://appberry-dev.github.io/BerryPickr/" target="_blank" rel="noreferrer">
            appberry-dev.github.io/BerryPickr
          </a>
          .
        </p>
        <CodeBlock code={QUICK_START_BERRYPICKR} />
      </section>

      <section id="html-mode">
        <h2>HTML Mode and Sanitization</h2>
        <p>
          The toolbar can switch between rich editing and raw HTML. Unsafe HTML is sanitized before
          applying to rich mode and before returning from <code>ref.getHTML()</code> in HTML mode.
        </p>
        <CodeBlock code={QUICK_START_HTML_MODE} />
        <Callout title="Production Guidance" tone="warning">
          Treat persisted editor HTML as user content. Keep your server-side sanitization and output
          encoding policies in place even with client-side sanitization enabled.
        </Callout>
      </section>
    </DocsShell>
  )
}
