import { createFileRoute } from '@tanstack/react-router';
import { core } from '~/core.server';

// Configure this exact URL in Waffo Pancake, including order.completed and refund.* events.
export const Route = createFileRoute('/api/webhooks/waffo')({
  server: { handlers: { POST: ({ request }) => core.billing.webhook(request) } },
});
