import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { LegalPage, SUPPORT_EMAIL } from '~/site/legal';
import site from '../../site.config';

export const Route = createFileRoute('/acceptable-use')({
  head: () =>
    pageHead(site, {
      title: m.legal_aup_meta_title({ siteName: site.name }),
      description: m.legal_aup_meta_description({ siteName: site.name }),
      path: '/acceptable-use',
    }),
  component: AcceptableUsePage,
});

function AcceptableUsePage() {
  return (
    <LegalPage title={m.legal_aup_title()} intro={m.legal_aup_intro({ siteName: site.name })}>
      <h2>{m.legal_aup_sexual_heading()}</h2>
      <p>{m.legal_aup_sexual_body()}</p>

      <h2>{m.legal_aup_violence_heading()}</h2>
      <p>{m.legal_aup_violence_body()}</p>

      <h2>{m.legal_aup_hate_heading()}</h2>
      <p>{m.legal_aup_hate_body()}</p>

      <h2>{m.legal_aup_csam_heading()}</h2>
      <p>{m.legal_aup_csam_body()}</p>

      <h2>{m.legal_aup_deepfake_heading()}</h2>
      <p>{m.legal_aup_deepfake_body()}</p>

      <h2>{m.legal_aup_ip_heading()}</h2>
      <p>{m.legal_aup_ip_body()}</p>

      <h2>{m.legal_aup_report_heading()}</h2>
      <p>{m.legal_aup_report_body()}</p>
      <p>Report concerns to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

      <h2>{m.legal_aup_changes_heading()}</h2>
      <p>{m.legal_aup_changes_body()}</p>
    </LegalPage>
  );
}
