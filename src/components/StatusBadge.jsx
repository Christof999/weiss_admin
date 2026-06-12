import { statusLabel } from '../lib/utils'

const CLASS = {
  neu: 'badge badge-neu',
  bearbeitung: 'badge badge-bearbeitung',
  erledigt: 'badge badge-erledigt',
}

export default function StatusBadge({ status }) {
  return <span className={CLASS[status] || CLASS.neu}>{statusLabel(status)}</span>
}
