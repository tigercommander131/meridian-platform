import { render, screen } from '@testing-library/react';
import ScoresPanel from '../ScoresPanel';

// Mock the data layer so the panel renders against a fixed set of scores.
jest.mock('@/services/data', () => ({
  sessionsApi: { scores: jest.fn() },
  scoringApi: { approve: jest.fn(), release: jest.fn(), dispute: jest.fn(), reopen: jest.fn(), detail: jest.fn() },
  SCORE_STATES: {
    pending_approval: { label: 'Pending approval', cls: '' },
    approved: { label: 'Approved', cls: '' },
    released: { label: 'Released', cls: '' },
    disputed: { label: 'Disputed', cls: '' },
  },
}));
jest.mock('@/stores/toastStore', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { sessionsApi } from '@/services/data';

describe('ScoresPanel', () => {
  it('renders scores and offers the right actions per state', async () => {
    sessionsApi.scores.mockResolvedValue({
      scores: [
        { id: 's1', participantId: 'p1', learnerName: 'Grace Hopper', role: 'team_lead', totalScore: 24, state: 'pending_approval' },
        { id: 's2', participantId: 'p2', learnerName: 'Alan Turing', role: 'compressor', totalScore: 18, state: 'approved' },
      ],
    });

    render(<ScoresPanel sessionId="sess_1" />);

    // Both learners show up once data loads.
    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();

    // pending_approval → Approve only; approved → Release + Dispute.
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispute' })).toBeInTheDocument();
    // No Release offered for the pending row's state set (only one Release button total).
    expect(screen.getAllByRole('button', { name: 'Release' })).toHaveLength(1);
  });

  it('shows an empty state when there are no scores', async () => {
    sessionsApi.scores.mockResolvedValue({ scores: [] });
    render(<ScoresPanel sessionId="sess_empty" />);
    expect(await screen.findByText(/no scores submitted yet/i)).toBeInTheDocument();
  });
});
