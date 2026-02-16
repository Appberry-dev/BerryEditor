import type { ApiRow } from '../../lib/docs/api-reference'

export function ApiTable({
  rows,
  showDefault = true
}: {
  rows: ReadonlyArray<ApiRow>
  showDefault?: boolean
}) {
  return (
    <div className="docs-table-wrap">
      <table className="docs-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Type</th>
            {showDefault ? <th scope="col">Default</th> : null}
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">
                <code>{row.name}</code>
              </th>
              <td>
                <code>{row.type}</code>
              </td>
              {showDefault ? <td>{row.defaultValue ?? '-'}</td> : null}
              <td>{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
