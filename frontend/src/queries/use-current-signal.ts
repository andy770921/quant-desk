import { useQuery } from '@tanstack/react-query';
import type { CurrentSignal } from '@repo/shared';

/** Live "what to hold right now" signal for a strategy, computed from latest data. */
export function useCurrentSignal(id: string) {
  return useQuery<CurrentSignal>({
    queryKey: ['api', 'signals', id],
    enabled: Boolean(id),
  });
}
