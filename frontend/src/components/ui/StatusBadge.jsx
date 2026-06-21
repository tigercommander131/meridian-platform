import { Badge } from './kit';
import { statusTone, statusLabel } from '@/services/data';

// Course / compliance status pill with a status-coloured dot.
export default function StatusBadge({ status, className }) {
  return (
    <Badge tone={statusTone(status)} dot className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
